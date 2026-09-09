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
  /** クライアントが分岐に使う機械可読なコード（例: AUTH_INVALID） */
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface ActRequest {
  action: string;
  code?: string;
  playerId?: string;
  token?: string;
  payload?: Record<string, unknown>;
}

interface RoomRow {
  id: string;
  code: string;
  host_player_id: string | null;
  status: 'lobby' | 'playing' | 'finished';
  settings: Settings;
  state: PublicState | null;
  version: number;
  updated_at: string;
}

interface PlayerRow {
  id: string;
  room_id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

interface SecretsRow {
  room_id: string;
  deck: Card[];
  lucky_player_ids: string[];
}

const MAX_PLAYERS = 12;
const CPU_NAMES = [
  'CPU・タロウ', 'CPU・ハナコ', 'CPU・ジロウ', 'CPU・ミサキ', 'CPU・ケン', 'CPU・アヤ',
  'CPU・ゴロウ', 'CPU・リン', 'CPU・ダイ', 'CPU・ユイ', 'CPU・シン',
];

const CODE_ATTEMPTS = 5;
const SEAT_RETRIES = 3;
const COMMIT_RETRIES = 3;
const NAME_MAX = 12;
/** ホスト不在とみなすまでの卓の無更新時間 */
const STALE_MS = 30_000;
const AUTH_INVALID = 'AUTH_INVALID';

function db(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('環境変数 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function genToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (name.length < 1 || name.length > NAME_MAX) throw new ApiError(`名前は1〜${NAME_MAX}文字で入力してください`);
  return name;
}

async function loadRoom(sb: SupabaseClient, code: string | undefined): Promise<RoomRow> {
  if (!code) throw new ApiError('ルームコードが必要です');
  const { data, error } = await sb.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('ルームが見つかりません');
  return data as RoomRow;
}

async function loadPlayers(sb: SupabaseClient, roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await sb
    .from('players')
    .select('id, room_id, name, seat, is_cpu')
    .eq('room_id', roomId)
    .order('seat', { ascending: true, nullsFirst: false })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
}

async function loadSecrets(sb: SupabaseClient, roomId: string): Promise<SecretsRow> {
  const { data, error } = await sb.from('room_secrets').select('*').eq('room_id', roomId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('ルームの内部情報が見つかりません');
  return data as SecretsRow;
}

async function authPlayer(
  sb: SupabaseClient,
  room: RoomRow,
  playerId: string | undefined,
  token: string | undefined,
): Promise<PlayerRow> {
  if (!playerId || !token) throw new ApiError('参加情報がありません', AUTH_INVALID);
  const { data: t } = await sb.from('player_tokens').select('token').eq('player_id', playerId).maybeSingle();
  if (!t || t.token !== token) throw new ApiError('参加情報が無効です', AUTH_INVALID);
  const { data: p } = await sb.from('players').select('id, room_id, name, seat, is_cpu').eq('id', playerId).maybeSingle();
  if (!p || p.room_id !== room.id) throw new ApiError('このルームの参加者ではありません', AUTH_INVALID);
  return p as PlayerRow;
}

function requireHost(room: RoomRow, me: PlayerRow) {
  if (room.host_player_id !== me.id) throw new ApiError('ホストのみ操作できます');
}

/** 卓が STALE_MS 以上更新されていないか（ホスト離脱で進行が止まった状態） */
function isStale(room: RoomRow, now: number): boolean {
  const updated = new Date(room.updated_at).getTime();
  return Number.isFinite(updated) && now - updated > STALE_MS;
}

/**
 * ホストなら常に許可。ホストが離脱して卓が STALE_MS 以上止まっている場合は、
 * 人間の着席プレイヤーなら誰でも進行できる（ホスト不在で詰むのを防ぐ）。
 */
function requireHostOrStale(room: RoomRow, me: PlayerRow) {
  if (room.host_player_id === me.id) return;
  if (!me.is_cpu && me.seat !== null && isStale(room, Date.now())) return;
  throw new ApiError('ホストのみ操作できます');
}

/** 空いている座席のうち最小のもの（0..MAX_PLAYERS-1、穴があれば埋める）。満員なら null（＝観戦） */
export function freeSeatOrNull(players: PlayerRow[]): number | null {
  const used = new Set(players.map((p) => p.seat).filter((s): s is number => s !== null));
  for (let seat = 0; seat < MAX_PLAYERS; seat++) {
    if (!used.has(seat)) return seat;
  }
  return null;
}

function nextFreeSeat(players: PlayerRow[]): number {
  const seat = freeSeatOrNull(players);
  if (seat === null) throw new ApiError('満員です（12人まで）');
  return seat;
}

/** 座席の一意制約（players_room_seat_uniq）に当たったか */
function isSeatConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}

/** 座席の一意制約に当たったら読み直して取り直す、共通のリトライラッパー */
async function withSeatRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < SEAT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isSeatConflict(e)) throw e;
    }
  }
  throw new ApiError('席の確保に失敗しました。もう一度お試しください');
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
    if (e2) {
      // token の作成に失敗した場合、宙に浮いた players 行を残さないよう削除してから再送出する
      await sb.from('players').delete().eq('id', data.id);
      throw e2;
    }
  }
  return { playerId: data.id, token };
}

// ---------- create / join ----------

async function create(sb: SupabaseClient, payload: Record<string, unknown> | undefined) {
  const name = cleanName(payload?.name);
  let room: { id: string; code: string } | null = null;
  for (let i = 0; i < CODE_ATTEMPTS && !room; i++) {
    const { data, error } = await sb.from('rooms').insert({ code: genCode() }).select('id, code').single();
    if (!error) room = data;
    else if (error.code !== '23505') throw error;
  }
  if (!room) throw new ApiError('ルームを作成できませんでした');
  const { playerId, token } = await insertPlayer(sb, room.id, name, 0, false);
  const { error: eHost } = await sb.from('rooms').update({ host_player_id: playerId }).eq('id', room.id);
  if (eHost) throw eHost;
  const { error: eSecrets } = await sb.from('room_secrets').insert({ room_id: room.id });
  if (eSecrets) throw eSecrets;
  return { code: room.code, playerId, token, seat: 0 };
}

async function join(sb: SupabaseClient, req: ActRequest) {
  const room = await loadRoom(sb, req.code);
  if (req.playerId && req.token) {
    const me = await authPlayer(sb, room, req.playerId, req.token);
    return { code: room.code, playerId: me.id, token: req.token, seat: me.seat };
  }
  const name = cleanName(req.payload?.name);
  return withSeatRetry(async () => {
    const players = await loadPlayers(sb, room.id);
    // ロビーでも満員なら観戦者（seat null）として登録する
    const seat = room.status === 'lobby' ? freeSeatOrNull(players) : null;
    const { playerId, token } = await insertPlayer(sb, room.id, name, seat, false);
    return { code: room.code, playerId, token, seat };
  });
}

// ---------- dispatcher ----------

function optStr(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new ApiError('リクエストが不正です');
  return v;
}

function validateRequest(req: ActRequest): ActRequest {
  if (typeof req.action !== 'string') throw new ApiError('リクエストが不正です');
  const code = optStr(req.code, 'code');
  const playerId = optStr(req.playerId, 'playerId');
  const token = optStr(req.token, 'token');
  if (req.payload !== undefined && (typeof req.payload !== 'object' || req.payload === null)) {
    throw new ApiError('リクエストが不正です');
  }
  return { action: req.action, code, playerId, token, payload: req.payload };
}

export async function handle(rawReq: ActRequest): Promise<Record<string, unknown>> {
  const req = validateRequest(rawReq);
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

export function validateSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  // turnSeconds は「不明な値なら安全側（20秒）」に倒す。無制限は null を明示した場合のみ
  const turnSeconds = s.turnSeconds === 20 || s.turnSeconds === 60 || s.turnSeconds === null ? s.turnSeconds : 20;
  const endMode = s.endMode === 'rounds' ? 'rounds' : 'points';
  const allowed = endMode === 'points' ? [100, 200, 300] : [3, 5, 10];
  const target = allowed.includes(Number(s.target)) ? Number(s.target) : allowed[1];
  return { turnSeconds, endMode, target };
}

/** rooms.state と room_secrets.deck を1トランザクションで更新する（version の compare-and-set 付き） */
async function commitRoom(
  sb: SupabaseClient,
  room: RoomRow,
  state: PublicState,
  status: RoomRow['status'],
  deck: Card[],
): Promise<boolean> {
  const { data, error } = await sb.rpc('commit_room', {
    p_id: room.id,
    p_version: room.version,
    p_state: state,
    p_status: status,
    p_deck: deck,
  });
  if (error) throw error;
  return data === true;
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
    luckySeats(secretsRow, players),
  );
  const ok = await commitRoom(sb, room, state, 'playing', secrets.deck);
  if (!ok) throw new ApiError('他の操作と重なりました。もう一度お試しください');
  return {};
}

async function addCpu(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ追加できます');
  return withSeatRetry(async () => {
    const players = await loadPlayers(sb, room.id);
    const seat = nextFreeSeat(players);
    const cpuCount = players.filter((p) => p.is_cpu).length;
    const name = CPU_NAMES[cpuCount % CPU_NAMES.length];
    await insertPlayer(sb, room.id, name, seat, true);
    return {};
  });
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
  requireHostOrStale(room, me);
  if (room.status !== 'finished') throw new ApiError('ゲーム終了後のみ再開できます');
  const players = await loadPlayers(sb, room.id);
  // 観戦者に空席を割り当てる。この関数は status === 'finished' のときにしか呼ばれず、
  // その状態で seat を書き込む経路は他に無いため、トランザクション無しのループでも安全
  // （途中で失敗しても再試行すれば同じ割当に収束する＝冪等）。
  for (const p of players) {
    if (p.seat !== null) continue;
    const seat = freeSeatOrNull(players);
    if (seat === null) break;
    p.seat = seat;
    const { error } = await sb.from('players').update({ seat }).eq('id', p.id);
    if (error) throw error;
  }
  return launch(sb, room, players);
}

async function toggleLucky(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  // 読み取り→書き込みを1文にまとめ、同時操作で取りこぼさないようにする
  const { data, error } = await sb.rpc('toggle_lucky', { p_room_id: room.id, p_player_id: me.id });
  if (error) throw error;
  return { lucky: data === true };
}

// ---------- game ----------

async function saveGame(sb: SupabaseClient, room: RoomRow, state: PublicState, deck: Card[]): Promise<boolean> {
  const status: RoomRow['status'] = state.phase === 'game_end' ? 'finished' : 'playing';
  return commitRoom(sb, room, state, status, deck);
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
    requireHostOrStale(room, me);
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
  for (let attempt = 0; attempt < COMMIT_RETRIES; attempt++) {
    const room = await loadRoom(sb, code);
    if (room.status !== 'playing' || !room.state) {
      // 終了後に届いた tick は無視する（クライアントのタイマーが遅れて届くことがある）
      if (action === 'tick') return { noop: true };
      throw new ApiError('ゲーム中ではありません');
    }
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
