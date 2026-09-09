import { useEffect, useState } from 'react';

/** ISO 文字列からの経過ミリ秒。1 秒ごとに更新する */
export function useElapsed(since: string): number {
  const base = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!Number.isFinite(base)) return 0;
  return Math.max(0, now - base);
}
