import type { PublicState } from '@lucky7/engine';

export default function RoundEndOverlay({
  state, nameOf, isHost, busy, onNext,
}: { state: PublicState; nameOf: (seat: number) => string; isHost: boolean; busy: boolean; onNext: () => void }) {
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const sevenSeat = state.events.find((e) => e.type === 'seven')?.seat;
  return (
    <div className="fixed inset-0 z-20 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
        <h2 className="text-xl font-black text-center">ラウンド {state.round} 終了</h2>
        {sevenSeat !== undefined && <p className="text-center text-amber-400 font-bold">{nameOf(sevenSeat)} がラッキーセブン達成！ +15</p>}
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => (
              <tr key={p.seat} className="border-t border-slate-700">
                <td className="py-2 font-bold">{nameOf(p.seat)}</td>
                <td className="py-2 text-right text-slate-400">+{p.roundScore}</td>
                <td className="py-2 text-right font-black text-lg">{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isHost ? (
          <button disabled={busy} onClick={onNext} className="w-full rounded-xl bg-amber-400 text-slate-900 font-bold py-3 disabled:opacity-40">次のラウンドへ</button>
        ) : (
          <p className="text-center text-slate-400 text-sm">ホストが次へ進めます…</p>
        )}
      </div>
    </div>
  );
}
