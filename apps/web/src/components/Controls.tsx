export default function Controls({ busy, onHit, onStay }: { busy: boolean; onHit: () => void; onStay: () => void }) {
  return (
    <div className="flex gap-2.5">
      <button
        disabled={busy}
        onClick={onHit}
        className="gold-foil flex-1 rounded-2xl py-4 font-display text-[21px] font-extrabold tracking-wide shadow-[0_10px_30px_-12px_var(--glow)] transition active:scale-[.97] disabled:opacity-40"
      >
        引く
      </button>
      <button
        disabled={busy}
        onClick={onStay}
        className="flex-1 rounded-2xl border border-edge/12 bg-ink3 py-4 font-display text-[21px] font-extrabold tracking-wide text-cream/85 transition active:scale-[.97] disabled:opacity-40"
      >
        降りる
      </button>
    </div>
  );
}
