import { useState } from 'react';
import { act } from '../lib/api';
import { unlock } from '../lib/audio';
import { formatCode } from '../lib/code';
import { loadName, saveName, saveSession } from '../lib/session';
import SoundToggle from './SoundToggle';
import { CardBack } from './CardView';

export default function JoinForm({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState(loadName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    unlock();
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
    <div className="relative mx-auto flex min-h-full max-w-lg flex-col justify-center gap-7 p-6">
      <div className="absolute right-5 top-5">
        <SoundToggle />
      </div>

      <div className="felt flex items-center gap-4 rounded-3xl p-4">
        <div className="relative shrink-0" style={{ width: 56, height: 78 }}>
          <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(-7deg) translateX(-4px)', opacity: 0.75 }} />
          <CardBack size="md" className="absolute inset-0" style={{ transform: 'rotate(4deg)' }} />
        </div>
        <div className="min-w-0">
          <div className="font-display text-[10px] font-extrabold tracking-[0.3em] text-cream/45">ルーム</div>
          <div className="font-display text-[30px] font-extrabold leading-tight tracking-[0.12em] text-gold">{formatCode(code)}</div>
        </div>
      </div>

      <label className="block">
        <span className="font-display text-[11px] font-extrabold tracking-[0.24em] text-cream/40">ニックネーム</span>
        <input
          className="mt-1.5 w-full rounded-2xl border border-white/10 bg-ink2/90 px-4 py-3.5 text-lg outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/25"
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="gold-foil w-full rounded-2xl py-4 font-display text-lg font-extrabold text-[#3a2a06] shadow-[0_16px_40px_-16px_rgba(242,193,78,.9)] transition active:scale-[.98] disabled:opacity-40"
        disabled={!name.trim() || busy}
        onClick={join}
      >
        参加する
      </button>
      {error && <p className="text-sm text-rose">{error}</p>}
    </div>
  );
}
