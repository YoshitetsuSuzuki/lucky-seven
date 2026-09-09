import type { Pending } from '@lucky7/engine';

const TITLE: Record<Pending['type'], string> = {
  freeze: '氷結: 誰を降ろす？',
  triple: '三連: 誰に3枚引かせる？',
  give_insurance: '保険: 誰に渡す？',
};

const ACCENT: Record<Pending['type'], string> = {
  freeze: 'text-frost',
  triple: 'text-[#f0902c]',
  give_insurance: 'text-emerald-300',
};

export default function TargetModal({
  pending,
  candidates,
  nameOf,
  mySeat,
  busy,
  onChoose,
}: {
  pending: Pending;
  candidates: number[];
  nameOf: (seat: number) => string;
  mySeat: number;
  busy: boolean;
  onChoose: (seat: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-modal-title"
    >
      <div className="lacquer animate-riseIn w-full max-w-sm space-y-3.5 rounded-3xl p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
        <h2 id="target-modal-title" className={`font-display text-lg font-extrabold ${ACCENT[pending.type]}`}>
          {TITLE[pending.type]}
        </h2>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
          {candidates.map((seat) => (
            <button
              key={seat}
              disabled={busy}
              onClick={() => onChoose(seat)}
              className="truncate rounded-2xl border border-white/10 bg-ink3 py-3.5 font-bold text-cream/90 transition active:scale-[.97] disabled:opacity-40"
            >
              {seat === mySeat ? '自分' : nameOf(seat)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
