import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  applyAction,
  cpuDecide,
  randomRng,
  startGame,
  waitingOn,
  type Action,
  type Card,
  type PublicState,
  type Secrets,
  type Settings,
} from '../_shared/engine/index.ts';

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

// ---------- lobby ----------

function validateSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const turnSeconds = s.turnSeconds === 20 || s.turnSeconds === 60 ? s.turnSeconds : null;
  const endMode = s.endMode === 'rounds' ? 'rounds' : 'points';
  const allowed = endMode === 'points' ? [100, 200, 300] : [3, 5, 10];
  const target = allowed.includes(Number(s.target)) ? Number(s.target) : allowed[1];
  return { turnSeconds, endMode, target };
}

async function saveNewGame(sb: SupabaseClient, room: RoomRow, state: PublicState, deck: Card[]) {
  const { data, error } = await sb
    .from('rooms')
    .update({ state, status: 'playing', version: room.version + 1, updated_at: new Date().toISOString() })
    .eq('id', room.id)
    .eq('version', room.version)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError('他の操作と重なりました。もう一度お試しください');
  const { error: e2 } = await sb.from('room_secrets').update({ deck }).eq('room_id', room.id);
  if (e2) throw e2;
}

function luckySeats(secrets: SecretsRow, players: PlayerRow[]): number[] {
  return players
    .filter((p) => p.seat !== null && secrets.lucky_player_ids.includes(p.id))
    .map((p) => p.seat!);
}

async function launch(sb: SupabaseClient, room: RoomRow, players: PlayerRow[]) {
  const seated = players.filter((p) => p.seat !== null);
  if (seated.length < 2) throw new ApiError('2人以上必要です');
  const secretsRow = await loadSecrets(sb, room.id);
  const { state, secrets } = startGame(
    seated.map((p) => ({ seat: p.seat!, isCpu: p.is_cpu })),
    room.settings,
    randomRng(),
    Date.now(),
  );
  secrets.luckySeats = luckySeats(secretsRow, players);
  await saveNewGame(sb, room, state, secrets.deck);
  return {};
}

async function addCpu(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ追加できます');
  const players = await loadPlayers(sb, room.id);
  const seat = nextFreeSeat(players);
  const cpuCount = players.filter((p) => p.is_cpu).length;
  const name = CPU_NAMES[cpuCount % CPU_NAMES.length];
  await insertPlayer(sb, room.id, name, seat, true);
  return {};
}

async function removeCpu(sb: SupabaseClient, room: RoomRow, me: PlayerRow, playerId: string) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ削除できます');
  const { error } = await sb.from('players').delete().eq('id', playerId).eq('room_id', room.id).eq('is_cpu', true);
  if (error) throw error;
  return {};
}

async function updateSettings(sb: SupabaseClient, room: RoomRow, me: PlayerRow, raw: unknown) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ変更できます');
  const settings = validateSettings(raw);
  const { error } = await sb.from('rooms').update({ settings, updated_at: new Date().toISOString() }).eq('id', room.id);
  if (error) throw error;
  return { settings };
}

async function startRoom(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('すでに開始しています');
  const players = await loadPlayers(sb, room.id);
  return launch(sb, room, players);
}

async function nextGame(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'finished') throw new ApiError('ゲーム終了後のみ再開できます');
  const players = await loadPlayers(sb, room.id);
  // 観戦者に空席を割り当てる
  let next = players.filter((p) => p.seat !== null).length === 0 ? 0 : Math.max(...players.filter((p) => p.seat !== null).map((p) => p.seat!)) + 1;
  for (const p of players) {
    if (p.seat !== null) continue;
    if (players.filter((q) => q.seat !== null).length >= MAX_PLAYERS) break;
    p.seat = next++;
    const { error } = await sb.from('players').update({ seat: p.seat }).eq('id', p.id);
    if (error) throw error;
  }
  return launch(sb, room, players);
}

async function toggleLucky(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  const secrets = await loadSecrets(sb, room.id);
  const ids = new Set(secrets.lucky_player_ids);
  const lucky = !ids.has(me.id);
  if (lucky) ids.add(me.id);
  else ids.delete(me.id);
  const { error } = await sb.from('room_secrets').update({ lucky_player_ids: [...ids] }).eq('room_id', room.id);
  if (error) throw error;
  return { lucky };
}

// ---------- game ----------

async function saveGame(sb: SupabaseClient, room: RoomRow, state: PublicState, deck: Card[]): Promise<boolean> {
  const status = state.phase === 'game_end' ? 'finished' : 'playing';
  const { data, error } = await sb
    .from('rooms')
    .update({ state, status, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq('id', room.id)
    .eq('version', room.version)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return false;
  const { error: e2 } = await sb.from('room_secrets').update({ deck }).eq('room_id', room.id);
  if (e2) throw e2;
  return true;
}

function buildAction(
  state: PublicState,
  players: PlayerRow[],
  me: PlayerRow,
  room: RoomRow,
  action: string,
  payload: Record<string, unknown>,
  now: number,
): Action | null {
  if (action === 'tick') {
    const w = waitingOn(state);
    if (!w) return null;
    const waiting = players.find((p) => p.seat === w.seat);
    if (waiting?.is_cpu) {
      return state.autoAt !== null && state.autoAt <= now ? cpuDecide(state, w.seat) : null;
    }
    return state.deadline !== null && state.deadline <= now ? { type: 'timeout' } : null;
  }
  if (action === 'next_round') {
    requireHost(room, me);
    return { type: 'next_round' };
  }
  if (me.seat === null) throw new ApiError('観戦中は操作できません');
  if (action === 'hit' || action === 'stay') return { type: action, seat: me.seat };
  if (action === 'choose_target') {
    const targetSeat = Number(payload.targetSeat);
    if (!Number.isInteger(targetSeat)) throw new ApiError('対象が不正です');
    return { type: 'choose_target', seat: me.seat, targetSeat };
  }
  throw new ApiError('不明な操作です');
}

async function gameAction(
  sb: SupabaseClient,
  code: string,
  me: PlayerRow,
  action: string,
  payload: Record<string, unknown>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await loadRoom(sb, code);
    if (room.status !== 'playing' || !room.state) throw new ApiError('ゲーム中ではありません');
    const players = await loadPlayers(sb, room.id);
    const secretsRow = await loadSecrets(sb, room.id);
    const secrets: Secrets = { deck: secretsRow.deck, luckySeats: luckySeats(secretsRow, players) };
    const now = Date.now();
    const engineAction = buildAction(room.state, players, me, room, action, payload, now);
    if (!engineAction) return { noop: true };
    const result = applyAction(room.state, secrets, engineAction, randomRng(), now);
    if (await saveGame(sb, room, result.state, result.secrets.deck)) return {};
  }
  throw new ApiError('混み合っています。もう一度お試しください');
}
