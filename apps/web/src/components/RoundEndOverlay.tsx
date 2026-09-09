import type { PublicState } from '@lucky7/engine';
import { useElapsed } from '../hooks/useElapsed';
import { STALE_MS } from '../lib/stale';

export default function RoundEndOverlay({
  state,
  nameOf,
  isHost,
  seated,
  busy,
  updatedAt,
  onNext,
}: {
  state: PublicState;
  nameOf: (seat: number) => string;
  isHost: boolean;
  seated: boolean;
  busy: boolean;
  updatedAt: string;
  onNext: () => void;
}) {
  const elapsed = useElapsed(updatedAt);
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const sevenSeat = state.events.find((e) => e.type === 'seven')?.seat;
  // ホストが離脱しても詰まないよう、30秒経ったら誰でも進められる
  const canNext = isHost || (seated && elapsed >= STALE_MS);
  const waitSeconds = Math.ceil((STALE_MS - elapsed) / 1000);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-end-title"
    >
      <div className="lacquer animate-riseIn w-full max-w-sm space-y-4 rounded-3xl p-5 shadow-[0_30px_70px_-24px_rgba(0,0,0,.95)]">
        <div className="text-center">
          <p className="font-display text-[11px] font-extrabold tracking-[0.4em] text-gold/60">ROUND {state.round}</p>
          <h2 id="round-end-title" className="mt-0.5 font-display text-2xl font-extrabold">
            ラウンド終了
          </h2>
        </div>
        {sevenSeat !== undefined && (
          <p className="rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-sm font-bold text-gold">
            {nameOf(sevenSeat)} がラッキーセブン達成！ <span className="font-display">+15</span>
          </p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => (
              <tr key={p.seat} className="border-t border-white/8">
                <td className="max-w-0 truncate py-2 font-bold">{nameOf(p.seat)}</td>
                <td className="whitespace-nowrap py-2 text-right text-muted">+{p.roundScore}</td>
                <td className="py-2 pl-3 text-right font-display text-lg font-extrabold">{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canNext ? (
          <button
            disabled={busy}
            onClick={onNext}
            className="gold-foil w-full rounded-2xl py-3.5 font-display text-lg font-extrabold text-[#3a2a06] transition active:scale-[.98] disabled:opacity-40"
          >
            次のラウンドへ
          </button>
        ) : (
          <p className="text-center text-sm text-muted">
            ホストが次へ進めます…
            {seated && <span className="block text-xs">あと{waitSeconds}秒で誰でも進められます</span>}
          </p>
        )}
      </div>
    </div>
  );
}
