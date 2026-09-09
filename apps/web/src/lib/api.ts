import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { loadSession } from './session';

export type ActResult = Record<string, unknown> & { ok: true };

/** サーバーが返すエラー。code は機械可読な分岐用（例: AUTH_INVALID） */
export class ActError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ActError';
    this.code = code;
  }
}

/** FunctionsHttpError の本文（{ok:false,error,code}）からメッセージとコードを取り出す */
async function toActError(error: Error): Promise<ActError> {
  if (!(error instanceof FunctionsHttpError)) return new ActError(error.message);
  try {
    const body = (await error.context.json()) as { error?: unknown; code?: unknown } | null;
    const msg = typeof body?.error === 'string' && body.error ? body.error : error.message;
    return new ActError(msg, typeof body?.code === 'string' ? body.code : undefined);
  } catch {
    return new ActError(error.message);
  }
}

export async function act(
  action: string,
  opts: { code?: string; payload?: Record<string, unknown>; anonymous?: boolean } = {},
): Promise<ActResult> {
  const session = opts.code && !opts.anonymous ? loadSession(opts.code) : null;
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; code?: string }>('act', {
    body: { action, code: opts.code, playerId: session?.playerId, token: session?.token, payload: opts.payload ?? {} },
  });
  if (error) throw await toActError(error);
  if (!data?.ok) throw new ActError(data?.error ?? '不明なエラー', data?.code);
  return data as unknown as ActResult;
}
