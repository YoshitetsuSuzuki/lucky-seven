import { useCallback, useState } from 'react';
import { act } from '../lib/api';

/** act 呼び出しの busy / error を各画面で共通化する */
export function useAct(code: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await act(action, { code, payload });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [code]);

  return { busy, error, run, setError };
}
