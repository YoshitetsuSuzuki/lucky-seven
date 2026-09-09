import type { Pending } from '@lucky7/engine';

const TITLE: Record<Pending['type'], string> = {
  freeze: '氷結: 誰を降ろす？',
  triple: '三連: 誰に3枚引かせる？',
  give_insurance: '保険: 誰に渡す？',
};

export default function TargetModal({
  pending, candidates, nameOf, mySeat, busy, onChoose,
}: { pending: Pending; candidates: number[]; nameOf: (seat: number) => string; mySeat: number; busy: boolean; onChoose: (seat: number) => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-3">
        <h2 className="font-bold text-lg">{TITLE[pending.type]}</h2>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {candidates.map((seat) => (
            <button key={seat} disabled={busy} onClick={() => onChoose(seat)} className="rounded-xl bg-slate-700 py-3 font-bold disabled:opacity-40">
              {seat === mySeat ? '自分' : nameOf(seat)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
