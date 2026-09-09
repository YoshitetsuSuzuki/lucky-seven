import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Card, PublicState, Settings } from '../_shared/engine/index.ts';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ActRequest {
  action: string;
  code?: string;
  playerId?: string;
  token?: string;
  payload?: Record<string, unknown>;
}

export interface RoomRow {
  id: string;
  code: string;
  host_player_id: string | null;
  status: 'lobby' | 'playing' | 'finished';
  settings: Settings;
  state: PublicState | null;
  version: number;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

export interface SecretsRow {
  room_id: string;
  deck: Card[];
  lucky_player_ids: string[];
}

export const MAX_PLAYERS = 12;
export const CPU_NAMES = [
  'CPU・タロウ', 'CPU・ハナコ', 'CPU・ジロウ', 'CPU・ミサキ', 'CPU・ケン', 'CPU・アヤ',
  'CPU・ゴロウ', 'CPU・リン', 'CPU・ダイ', 'CPU・ユイ', 'CPU・シン',
];

export function db(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function genToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (name.length < 1 || name.length > 12) throw new ApiError('名前は1〜12文字で入力してください');
  return name;
}

export async function loadRoom(sb: SupabaseClient, code: string | undefined): Promise<RoomRow> {
  if (!code) throw new ApiError('ルームコードが必要です');
  const { data, error } = await sb.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('ルームが見つかりません');
  return data as RoomRow;
}

export async function loadPlayers(sb: SupabaseClient, roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await sb
    .from('players')
    .select('id, room_id, name, seat, is_cpu')
    .eq('room_id', roomId)
    .order('seat', { ascending: true, nullsFirst: false })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
}

export async function loadSecrets(sb: SupabaseClient, roomId: string): Promise<SecretsRow> {
  const { data, error } = await sb.from('room_secrets').select('*').eq('room_id', roomId).single();
  if (error) throw error;
  return data as SecretsRow;
}

export async function authPlayer(
  sb: SupabaseClient,
  room: RoomRow,
  playerId: string | undefined,
  token: string | undefined,
): Promise<PlayerRow> {
  if (!playerId || !token) throw new ApiError('参加情報がありません');
  const { data: t } = await sb.from('player_tokens').select('token').eq('player_id', playerId).maybeSingle();
  if (!t || t.token !== token) throw new ApiError('参加情報が無効です');
  const { data: p } = await sb.from('players').select('id, room_id, name, seat, is_cpu').eq('id', playerId).maybeSingle();
  if (!p || p.room_id !== room.id) throw new ApiError('このルームの参加者ではありません');
  return p as PlayerRow;
}

export function requireHost(room: RoomRow, me: PlayerRow) {
  if (room.host_player_id !== me.id) throw new ApiError('ホストのみ操作できます');
}

export function nextFreeSeat(players: PlayerRow[]): number {
  const seated = players.filter((p) => p.seat !== null);
  if (seated.length >= MAX_PLAYERS) throw new ApiError('満員です（12人まで）');
  return seated.length === 0 ? 0 : Math.max(...seated.map((p) => p.seat!)) + 1;
}

async function insertPlayer(
  sb: SupabaseClient,
  roomId: string,
  name: string,
  seat: number | null,
  isCpu: boolean,
): Promise<{ playerId: string; token: string }> {
  const { data, error } = await sb
    .from('players')
    .insert({ room_id: roomId, name, seat, is_cpu: isCpu })
    .select('id')
    .single();
  if (error) throw error;
  const token = genToken();
  if (!isCpu) {
    const { error: e2 } = await sb.from('player_tokens').insert({ player_id: data.id, token });
    if (e2) throw e2;
  }
  return { playerId: data.id, token };
}

// ---------- create / join ----------

async function create(sb: SupabaseClient, payload: Record<string, unknown> | undefined) {
  const name = cleanName(payload?.name);
  let room: { id: string; code: string } | null = null;
  for (let i = 0; i < 5 && !room; i++) {
    const { data, error } = await sb.from('rooms').insert({ code: genCode() }).select('id, code').single();
    if (!error) room = data;
    else if (error.code !== '23505') throw error;
  }
  if (!room) throw new ApiError('ルームを作成できませんでした');
  const { playerId, token } = await insertPlayer(sb, room.id, name, 0, false);
  await sb.from('rooms').update({ host_player_id: playerId }).eq('id', room.id);
  await sb.from('room_secrets').insert({ room_id: room.id });
  return { code: room.code, playerId, token, seat: 0 };
}

async function join(sb: SupabaseClient, req: ActRequest) {
  const room = await loadRoom(sb, req.code);
  if (req.playerId && req.token) {
    const me = await authPlayer(sb, room, req.playerId, req.token);
    return { code: room.code, playerId: me.id, token: req.token, seat: me.seat };
  }
  const name = cleanName(req.payload?.name);
  const players = await loadPlayers(sb, room.id);
  const seat = room.status === 'lobby' ? nextFreeSeat(players) : null;
  const { playerId, token } = await insertPlayer(sb, room.id, name, seat, false);
  return { code: room.code, playerId, token, seat };
}

// ---------- dispatcher ----------

export async function handle(req: ActRequest): Promise<Record<string, unknown>> {
  const sb = db();
  if (req.action === 'create') return create(sb, req.payload);
  if (req.action === 'join') return join(sb, req);

  const room = await loadRoom(sb, req.code);
  const me = await authPlayer(sb, room, req.playerId, req.token);
  switch (req.action) {
    case 'add_cpu':
      return addCpu(sb, room, me);
    case 'remove_cpu':
      return removeCpu(sb, room, me, String(req.payload?.playerId ?? ''));
    case 'update_settings':
      return updateSettings(sb, room, me, req.payload?.settings);
    case 'start':
      return startRoom(sb, room, me);
    case 'next_game':
      return nextGame(sb, room, me);
    case 'toggle_lucky':
      return toggleLucky(sb, room, me);
    case 'hit':
    case 'stay':
    case 'choose_target':
    case 'next_round':
    case 'tick':
      return gameAction(sb, room.code, me, req.action, req.payload ?? {});
    default:
      throw new ApiError('不明な操作です');
  }
}

// Task 11 / 12 で実装
async function addCpu(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function removeCpu(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow, _id: string): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function updateSettings(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow, _s: unknown): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function startRoom(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function nextGame(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function toggleLucky(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function gameAction(_sb: SupabaseClient, _code: string, _me: PlayerRow, _action: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
