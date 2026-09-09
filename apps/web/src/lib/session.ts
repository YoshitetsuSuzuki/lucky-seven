export interface Session {
  playerId: string;
  token: string;
}

const key = (code: string) => `lucky7:session:${code.toUpperCase()}`;
const NAME_KEY = 'lucky7:name';
const luckyKey = (code: string, playerId: string) => `lucky7:lucky:${code.toUpperCase()}:${playerId}`;

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(code: string, s: Session) {
  try { localStorage.setItem(key(code), JSON.stringify(s)); } catch { /* ignore */ }
}
export function clearSession(code: string) {
  try { localStorage.removeItem(key(code)); } catch { /* ignore */ }
}
export function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

/** 「7」の演出フラグ（端末内のみ。サーバーにも他人にも一切送らない） */
export function loadLucky(code: string, playerId: string): boolean {
  try { return localStorage.getItem(luckyKey(code, playerId)) === '1'; } catch { return false; }
}
export function saveLucky(code: string, playerId: string, on: boolean) {
  try { localStorage.setItem(luckyKey(code, playerId), on ? '1' : '0'); } catch { /* ignore */ }
}
