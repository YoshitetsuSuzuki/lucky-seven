import { useState } from 'react';
import { act } from '../lib/api';
import { formatCode } from '../lib/code';
import { loadName, saveName, saveSession } from '../lib/session';

export default function JoinForm({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState(loadName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const r = await act('join', { code, payload: { name }, anonymous: true });
      if (typeof r.playerId !== 'string' || typeof r.token !== 'string') {
        throw new Error('サーバー応答が不正です');
      }
      saveSession(code, { playerId: r.playerId, token: r.token });
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-slate-400">ルーム <span className="font-mono text-2xl text-amber-400">{formatCode(code)}</span></div>
      <label className="block w-full max-w-sm">
        <span className="text-sm text-slate-400">ニックネーム</span>
        <input
          className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 ring-amber-400"
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="w-full max-w-sm rounded-xl bg-amber-400 text-slate-900 font-bold py-3 text-lg disabled:opacity-40"
        disabled={!name.trim() || busy}
        onClick={join}
      >
        参加する
      </button>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
