import type { PublicState } from '@lucky7/engine';
import { useElapsed } from '../hooks/useElapsed';
import { STALE_MS } from '../lib/stale';

/**
 * ラウンド集計。画面全体を覆うモーダルではなく下部シート。
 * 上の各プレイヤー行（手札）はそのまま見えてスクロールもできる。
 */
export default function RoundEndOverlay({
  state,
  nameOf,
  isHost,
  seated,
  busy,
  updatedAt,
  open,
  onToggle,
  onNext,
}: {
  state: PublicState;
  nameOf: (seat: number) => string;
  isHost: boolean;
  seated: boolean;
  busy: boolean;
  updatedAt: string;
  /** 集計を開いているか（false なら細いバーだけ） */
  open: boolean;
  onToggle: () => void;
  onNext: () => void;
}) {
  const elapsed = useElapsed(updatedAt);
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const sevenSeat = state.events.find((e) => e.type === 'seven')?.seat;
  // ホストが離脱しても詰まないよう、30秒経ったら誰でも進められる
  const canNext = isHost || (seated && elapsed >= STALE_MS);
  const waitSeconds = Math.ceil((STALE_MS - elapsed) / 1000);

  const next = canNext ? (
    <button
      disabled={busy}
      onClick={onNext}
      className="gold-foil w-full rounded-2xl py-3.5 font-display text-lg font-extrabold text-[#3a2a06] transition active:scale-[.98] disabled:opacity-40"
    >
      次のラウンドへ
    </button>
  ) : (
    <p className="py-1 text-center text-sm text-muted">
      ホストが次へ進めます…
      {seated && <span className="block text-xs">あと{waitSeconds}秒で誰でも進められます</span>}
    </p>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {/* シートの上だけをうっすら暗くする帯（クリックは通さない＝下のカードは触れる） */}
      <div className="pointer-events-none h-10 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
      <div className="mx-auto max-w-lg px-2">
        <section
          role="region"
          aria-label={`ラウンド${state.round}の集計`}
          className="animate-sheetUp flex flex-col rounded-t-3xl border border-b-0 border-white/10 bg-ink2/97 px-4 pt-3 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.95)] backdrop-blur-md"
          style={{ maxHeight: '55vh', paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/15" aria-hidden />

          <div className="flex shrink-0 items-center gap-2">
            <div className="min-w-0">
              <p className="font-display text-[10px] font-extrabold tracking-[0.34em] text-gold/60">ROUND {state.round}</p>
              <h2 className="font-display text-lg font-extrabold leading-tight">ラウンド終了</h2>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="ml-auto shrink-0 rounded-full border border-white/12 bg-ink3 px-3 py-2 text-xs font-bold text-cream/75 transition active:scale-95"
            >
              {open ? '手札を見る ▾' : '集計を見る ▴'}
            </button>
          </div>

          {open && (
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {sevenSeat !== undefined && (
                <p className="mb-2 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-sm font-bold text-gold">
                  {nameOf(sevenSeat)} がラッキーセブン達成！ <span className="font-display">+15</span>
                </p>
              )}
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.seat} className="border-t border-white/8">
                      <td className="py-2 pr-3 font-bold truncate max-w-[11rem]">{nameOf(p.seat)}</td>
                      <td className="whitespace-nowrap py-2 text-right text-muted">+{p.roundScore}</td>
                      <td className="py-2 pl-3 text-right font-display text-lg font-extrabold">{p.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 shrink-0">{next}</div>
        </section>
      </div>
    </div>
  );
}
