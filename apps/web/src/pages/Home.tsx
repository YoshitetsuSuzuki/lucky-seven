import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { act } from '../lib/api';
import { unlock } from '../lib/audio';
import { normalizeCode } from '../lib/code';
import { loadName, saveName, saveSession } from '../lib/session';
import { CardBack } from '../components/CardView';
import SoundControls from '../components/SoundControls';

export default function Home() {
  const nav = useNavigate();
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    unlock();
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
    unlock();
    saveName(name);
    if (code.trim().length !== 6) {
      setError('ルームコードは6文字です');
      return;
    }
    nav(`/r/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="relative mx-auto flex min-h-full max-w-lg flex-col justify-center gap-9 p-6">
      <div className="absolute right-5 top-5">
        <SoundControls />
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative h-[92px] w-[150px]" aria-hidden>
          <CardBack size="lg" className="absolute left-1/2 top-0" style={{ transform: 'translateX(-50%) rotate(-14deg) translateX(-30px)', opacity: 0.8 }} />
          <CardBack size="lg" className="absolute left-1/2 top-0" style={{ transform: 'translateX(-50%) rotate(13deg) translateX(30px)', opacity: 0.8 }} />
          <CardBack size="lg" className="absolute left-1/2 top-0" style={{ transform: 'translateX(-50%) rotate(-1deg) translateY(-6px)' }} />
        </div>
        <div className="pt-8 text-center">
          <p className="font-display text-[10px] font-extrabold tracking-[0.45em] text-gold/50">MIDNIGHT CARD SALON</p>
          <h1 className="mt-1 font-display text-[46px] font-extrabold leading-none tracking-tight">
            ラッキー<span className="text-gold [text-shadow:0_0_34px_rgba(242,193,78,.5)]">7</span>
          </h1>
        </div>
      </div>

      <div className="w-full space-y-3">
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
          onClick={create}
        >
          ルームを作る
        </button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-display text-[10px] font-extrabold tracking-[0.3em] text-cream/25">または</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-ink2/90 px-4 py-3.5 text-center font-display text-xl font-extrabold tracking-[0.3em] outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/25"
            value={code}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            aria-label="ルームコード"
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="6桁のコード"
          />
          <button
            className="shrink-0 rounded-2xl border border-white/12 bg-ink3 px-6 font-bold text-cream/85 transition active:scale-95 disabled:opacity-40"
            disabled={!name.trim() || code.length !== 6 || busy}
            onClick={join}
          >
            参加
          </button>
        </div>
        {error && <p className="text-sm text-rose">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <Link
            to="/help"
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-gold/25 bg-gold/[0.07] text-[14px] font-bold text-gold transition active:scale-[.98]"
          >
            <span aria-hidden>？</span>
            遊び方
          </Link>
          <Link
            to="/about"
            aria-label="設定・情報"
            className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-ink3/70 px-4 text-[14px] font-bold text-cream/75 transition active:scale-[.98]"
          >
            <span aria-hidden>⚙</span>
            情報
          </Link>
        </div>
      </div>
    </div>
  );
}
