import { useEffect } from 'react';
import type { PublicState } from '@lucky7/engine';
import { act } from '../lib/api';

/** autoAt / deadline を過ぎたら tick を送る（全クライアントが送るが冪等） */
export function useTicker(code: string, state: PublicState | null, enabled: boolean) {
  const autoAt = state?.autoAt ?? null;
  const deadline = state?.deadline ?? null;
  useEffect(() => {
    if (!enabled) return;
    const target = autoAt ?? deadline;
    if (target === null) return;
    const jitter = Math.random() * 400;
    const delay = Math.max(0, target - Date.now()) + 50 + jitter;
    const id = setTimeout(() => { void act('tick', { code }).catch(() => {}); }, delay);
    return () => clearTimeout(id);
  }, [code, autoAt, deadline, enabled]);
}
