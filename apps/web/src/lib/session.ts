export interface Session {
  playerId: string;
  token: string;
}

const key = (code: string) => `lucky7:session:${code.toUpperCase()}`;
const NAME_KEY = 'lucky7:name';

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
