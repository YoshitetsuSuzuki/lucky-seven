import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { useNameOf } from '../hooks/useNameOf';
import { useElapsed } from '../hooks/useElapsed';
import { STALE_MS } from '../lib/stale';

export default function Result({ room, players, me, isHost }: ScreenProps) {
  const { busy, error, run } = useAct(room.code);
  const nameOf = useNameOf(players);
  const elapsed = useElapsed(room.updated_at);
  const state = room.state;
  if (!state) return <p className="p-6 text-slate-400">状態を読み込み中…</p>;

  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const winners = new Set(state.winnerSeats ?? []);
  const iWon = me.seat !== null && winners.has(me.seat);
  // ホストが離脱しても詰まないよう、30秒経ったら着席者なら誰でも進められる
  const stale = elapsed >= STALE_MS;
  const canStart = isHost || (stale && me.seat !== null);
  const waitSeconds = Math.ceil((STALE_MS - elapsed) / 1000);

  return (
    <div className="min-h-full max-w-lg mx-auto p-5 flex flex-col gap-6">
      <h1 className="text-3xl font-black text-center">{iWon ? '🎉 勝利！' : 'ゲーム終了'}</h1>
      <p className="text-center text-amber-400 font-bold">
        優勝: {[...winners].map(nameOf).join(' / ')}
      </p>
      <ol className="space-y-2">
        {rows.map((p, i) => (
          <li key={p.seat} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${winners.has(p.seat) ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}>
            <span className="w-6 font-black">{i + 1}</span>
            <span className="flex-1 font-bold">{nameOf(p.seat)}</span>
            <span className="font-black text-lg">{p.totalScore}</span>
          </li>
        ))}
      </ol>
      {canStart ? (
        <button disabled={busy} onClick={() => void run('next_game')} className="rounded-xl bg-amber-400 text-slate-900 font-bold py-4 text-lg disabled:opacity-40">もう一回（同じメンバー）</button>
      ) : (
        <p className="text-center text-slate-400">
          ホストの操作を待っています…
          {me.seat !== null && <span className="block text-xs">あと{waitSeconds}秒で誰でも始められます</span>}
        </p>
      )}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div>
  );
}
