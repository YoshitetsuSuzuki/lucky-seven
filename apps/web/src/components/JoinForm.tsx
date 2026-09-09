import { useState } from 'react';
import { act } from '../lib/api';
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
      saveSession(code, { playerId: r.playerId as string, token: r.token as string });
      onJoined();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-slate-400">ルーム <span className="font-mono text-2xl text-amber-400">{code}</span></div>
      <input
        className="w-full max-w-sm rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 ring-amber-400"
        value={name}
        maxLength={12}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
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
