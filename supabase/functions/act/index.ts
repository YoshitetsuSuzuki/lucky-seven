import { ApiError, handle } from './api.ts';
import { EngineError } from '../_shared/engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const result = await handle(body);
    return json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof EngineError || e instanceof ApiError) return json({ ok: false, error: e.message }, 400);
    console.error(e);
    return json({ ok: false, error: 'サーバーエラー' }, 500);
  }
});
