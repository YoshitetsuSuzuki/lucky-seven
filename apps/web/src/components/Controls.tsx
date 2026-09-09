export default function Controls({ busy, onHit, onStay }: { busy: boolean; onHit: () => void; onStay: () => void }) {
  return (
    <div className="flex gap-3">
      <button disabled={busy} onClick={onHit} className="flex-1 rounded-2xl bg-amber-400 text-slate-900 font-black py-4 text-xl disabled:opacity-40">引く</button>
      <button disabled={busy} onClick={onStay} className="flex-1 rounded-2xl bg-slate-600 font-black py-4 text-xl disabled:opacity-40">降りる</button>
    </div>
  );
}
