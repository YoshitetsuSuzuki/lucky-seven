import type { Pending, PlayerState } from '@lucky7/engine';
import { currentScore, uniqueNumberCount } from '@lucky7/engine';
import CardView from './CardView';

const TITLE: Record<Pending['type'], string> = {
  freeze: '氷結: 誰を降ろす？',
  triple: '三連: 誰に3枚引かせる？',
  give_insurance: '保険: 誰に渡す？',
};

const HINT: Record<Pending['type'], string> = {
  freeze: '相手は今の手札点で確定します',
  triple: '場札が多い相手ほどバーストしやすい',
  give_insurance: '渡した相手は1回だけバーストを防げます',
};

const ACCENT: Record<Pending['type'], string> = {
  freeze: 'text-frost',
  triple: 'text-[#f0902c]',
  give_insurance: 'text-mint',
};

export default function TargetModal({
  pending,
  candidates,
  players,
  nameOf,
  mySeat,
  busy,
  onChoose,
}: {
  pending: Pending;
  candidates: number[];
  players: PlayerState[];
  nameOf: (seat: number) => string;
  mySeat: number;
  busy: boolean;
  onChoose: (seat: number) => void;
}) {
  const rows = candidates
    .map((seat) => players.find((p) => p.seat === seat))
    .filter((p): p is PlayerState => !!p);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/70 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-modal-title"
    >
      <div className="lacquer animate-riseIn flex w-full max-w-md flex-col gap-3 rounded-3xl p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
        <div>
          <h2 id="target-modal-title" className={`font-display text-lg font-extrabold ${ACCENT[pending.type]}`}>
            {TITLE[pending.type]}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">{HINT[pending.type]}</p>
        </div>

        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-0.5">
          {rows.map((p) => {
            const isMe = p.seat === mySeat;
            const now = currentScore(p);
            const numbers = uniqueNumberCount(p.cards);
            return (
              <li key={p.seat}>
                <button
                  disabled={busy}
                  onClick={() => onChoose(p.seat)}
                  className="w-full rounded-2xl border border-edge/10 bg-ink3 px-3 py-2.5 text-left transition active:scale-[.98] disabled:opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-cream/90">
                      {isMe ? '自分' : nameOf(p.seat)}
                      {isMe && <span className="ml-1 text-[11px] font-normal text-muted">({nameOf(p.seat)})</span>}
                    </span>
                    {p.hasInsurance && (
                      <span className="rounded-full bg-mint/20 px-1.5 py-0.5 text-[10px] font-bold text-mint">保険</span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-muted">
                      今 <b className="font-display text-base text-cream">{now}</b>
                      <span className="mx-1 text-cream/20">/</span>
                      計 <b className="font-display text-base text-gold">{p.totalScore}</b>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex min-h-[40px] flex-1 flex-wrap items-center">
                      {p.cards.length === 0 ? (
                        <span className="text-[11px] text-muted">まだ場札はありません</span>
                      ) : (
                        p.cards.map((c, i) => (
                          <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -10, transform: 'scale(.78)', transformOrigin: 'left center' }}>
                            <CardView card={c} size="sm" />
                          </div>
                        ))
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">
                      数字 <b className="text-cream/90">{numbers}</b>種
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
