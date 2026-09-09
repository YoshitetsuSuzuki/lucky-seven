import { useEffect } from 'react';
import type { PublicState } from '@lucky7/engine';
import { act } from '../lib/api';

const RETRY_MS = 1000;

/**
 * autoAt / deadline を過ぎたら tick を送る（全クライアントが送るが冪等）。
 * クライアント時計が進んでいるとサーバーは noop を返すため、
 * noop / 失敗時は deps が変わるまで 1 秒間隔で再送する。
 */
export function useTicker(code: string, state: PublicState | null, enabled: boolean) {
  const autoAt = state?.autoAt ?? null;
  const deadline = state?.deadline ?? null;
  useEffect(() => {
    if (!enabled) return;
    const target = autoAt ?? deadline;
    if (target === null) return;

    let cancelled = false;
    let id: number | null = null;

    const schedule = (delay: number) => {
      id = window.setTimeout(run, delay);
    };

    const run = async () => {
      id = null;
      if (cancelled) return;
      let again = true;
      try {
        const r = await act('tick', { code });
        // noop なら（サーバー側でまだ期限が来ていない）再送する
        again = r.noop === true;
      } catch {
        again = true;
      }
      if (cancelled) return;
      // 状態が進んだ場合は room の更新で deps が変わり、この effect は破棄される
      if (again) schedule(RETRY_MS);
    };

    const jitter = Math.random() * 400;
    schedule(Math.max(0, target - Date.now()) + 50 + jitter);

    return () => {
      cancelled = true;
      if (id !== null) window.clearTimeout(id);
    };
  }, [code, autoAt, deadline, enabled]);
}
