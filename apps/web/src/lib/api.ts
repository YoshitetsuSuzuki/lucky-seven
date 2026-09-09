import { supabase } from './supabase';
import { loadSession } from './session';

export type ActResult = Record<string, unknown> & { ok: true };

export async function act(
  action: string,
  opts: { code?: string; payload?: Record<string, unknown>; anonymous?: boolean } = {},
): Promise<ActResult> {
  const session = opts.code && !opts.anonymous ? loadSession(opts.code) : null;
  const { data, error } = await supabase.functions.invoke('act', {
    body: { action, code: opts.code, playerId: session?.playerId, token: session?.token, payload: opts.payload ?? {} },
  });
  if (error) {
    // FunctionsHttpError の場合は本文の error を取り出す
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        throw new Error(body.error ?? error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) throw e;
      }
    }
    throw new Error(error.message);
  }
  if (!data?.ok) throw new Error(data?.error ?? '不明なエラー');
  return data as ActResult;
}
