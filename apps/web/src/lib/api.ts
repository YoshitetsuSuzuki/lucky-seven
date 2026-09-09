import { supabase } from './supabase';
import { loadSession } from './session';

export type ActResult = Record<string, unknown> & { ok: true };

/** FunctionsHttpError の本文（{ok:false,error}）からメッセージを取り出す */
async function errorMessage(error: Error): Promise<string> {
  const ctx = (error as { context?: unknown }).context as Response | undefined;
  if (!ctx || typeof ctx.json !== 'function') return error.message;
  try {
    const body = (await ctx.json()) as { error?: unknown } | null;
    const msg = body?.error;
    return typeof msg === 'string' && msg ? msg : error.message;
  } catch {
    return error.message;
  }
}

export async function act(
  action: string,
  opts: { code?: string; payload?: Record<string, unknown>; anonymous?: boolean } = {},
): Promise<ActResult> {
  const session = opts.code && !opts.anonymous ? loadSession(opts.code) : null;
  const { data, error } = await supabase.functions.invoke('act', {
    body: { action, code: opts.code, playerId: session?.playerId, token: session?.token, payload: opts.payload ?? {} },
  });
  if (error) throw new Error(await errorMessage(error));
  if (!data?.ok) throw new Error(data?.error ?? '不明なエラー');
  return data as ActResult;
}
