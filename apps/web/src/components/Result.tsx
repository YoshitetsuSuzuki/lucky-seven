import { useEffect } from 'react';
import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { useNameOf } from '../hooks/useNameOf';
import { useElapsed } from '../hooks/useElapsed';
import { useBgm, useTableBgm } from '../hooks/useSound';
import { playSfx } from '../lib/audio';
import { STALE_MS } from '../lib/stale';
import SoundControls from './SoundControls';
import HomeButton from './HomeButton';
import { useNavigate } from 'react-router-dom';

export default function Result({
  room,
  players,
  me,
  isHost,
  onBackToTable,
}: ScreenProps & {
  /** 卓（最終手札）に戻る。undefined なら戻り先がない */
  onBackToTable?: () => void;
}) {
  const nav = useNavigate();
  const { busy, error, run } = useAct(room.code);
  const nameOf = useNameOf(players);
  const elapsed = useElapsed(room.updated_at);
  // 卓と同じ扱い（ボタンで ON にしたときだけ鳴らす）
  useBgm(useTableBgm());
  const state = room.state;
  const winners = new Set(state?.winnerSeats ?? []);
  const iWon = me.seat !== null && winners.has(me.seat);

  useEffect(() => {
    if (iWon) playSfx('win');
  }, [iWon]);

  if (!state) return <p className="p-6 text-muted">状態を読み込み中…</p>;

  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  // ホストが離脱しても詰まないよう、30秒経ったら着席者なら誰でも進められる
  const stale = elapsed >= STALE_MS;
  const canStart = isHost || (stale && me.seat !== null);
  const waitSeconds = Math.ceil((STALE_MS - elapsed) / 1000);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 p-5">
      <header className="flex items-center justify-end gap-1.5">
        <HomeButton />
        <SoundControls scope="table" />
      </header>

      <div className="text-center">
        <p className="font-display text-[11px] font-extrabold tracking-[0.4em] text-gold/60">GAME OVER</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">
          {iWon ? (
            <span className="text-gold [text-shadow:0_0_28px_var(--glow)]">勝利</span>
          ) : (
            <span>ゲーム終了</span>
          )}
        </h1>
        <p className="mt-2 font-bold text-gold/90">優勝: {[...winners].map(nameOf).join(' / ')}</p>
      </div>

      <ol className="space-y-2">
        {rows.map((p, i) => {
          const won = winners.has(p.seat);
          return (
            <li
              key={p.seat}
              className={`animate-riseIn flex items-center gap-3 rounded-2xl px-4 py-3.5 ${
                won ? 'gold-foil shadow-[0_14px_34px_-16px_var(--glow)]' : 'lacquer'
              }`}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <span className={`w-6 font-display text-lg font-extrabold ${won ? '' : 'text-cream/35'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{nameOf(p.seat)}</span>
              <span className="font-display text-xl font-extrabold">{p.totalScore}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto space-y-2 pt-2">
        {canStart ? (
          <button
            disabled={busy}
            onClick={() => void run('next_game')}
            className="gold-foil w-full rounded-2xl py-4 font-display text-lg font-extrabold transition active:scale-[.98] disabled:opacity-40"
          >
            もう一回（同じメンバー）
          </button>
        ) : (
          <p className="text-center text-muted">
            ホストの操作を待っています…
            {me.seat !== null && <span className="block text-xs">あと{waitSeconds}秒で誰でも始められます</span>}
          </p>
        )}
        {onBackToTable && (
          <button
            onClick={onBackToTable}
            className="w-full rounded-2xl border border-edge/12 bg-ink3 py-3.5 font-bold text-cream/85 transition active:scale-[.98]"
          >
            卓に戻る（最終手札を見る）
          </button>
        )}
        <button
          type="button"
          onClick={() => nav('/')}
          className="w-full rounded-2xl border border-edge/12 bg-ink3 py-3.5 font-bold text-cream/85 transition active:scale-[.98]"
        >
          ホームへ戻る
        </button>
        {error && <p className="mt-2 text-center text-sm text-rose">{error}</p>}
      </div>
    </div>
  );
}
