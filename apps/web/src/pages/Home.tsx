import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { act } from '../lib/api';
import { loadName, saveName, saveSession } from '../lib/session';

export default function Home() {
  const nav = useNavigate();
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const r = await act('create', { payload: { name }, anonymous: true });
      if (typeof r.code !== 'string' || typeof r.playerId !== 'string' || typeof r.token !== 'string') {
        throw new Error('サーバー応答が不正です');
      }
      saveSession(r.code, { playerId: r.playerId, token: r.token });
      nav(`/r/${r.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    saveName(name);
    if (code.trim().length !== 6) { setError('ルームコードは6文字です'); return; }
    nav(`/r/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
      <h1 className="text-5xl font-black tracking-tight">
        ラッキー<span className="text-amber-400">7</span>
      </h1>
      <div className="w-full max-w-sm space-y-4">
        <label className="block">
          <span className="text-sm text-slate-400">ニックネーム</span>
          <input
            className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 ring-amber-400"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: よしてつ"
          />
        </label>
        <button
          className="w-full rounded-xl bg-amber-400 text-slate-900 font-bold py-3 text-lg disabled:opacity-40"
          disabled={!name.trim() || busy}
          onClick={create}
        >
          ルームを作る
        </button>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-lg tracking-widest uppercase outline-none focus:ring-2 ring-amber-400"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="コード"
          />
          <button
            className="rounded-xl bg-slate-700 px-5 font-bold disabled:opacity-40"
            disabled={!name.trim() || busy}
            onClick={join}
          >
            参加
          </button>
        </div>
        {error && <p className="text-rose-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
