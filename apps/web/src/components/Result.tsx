import { useMemo, useState } from 'react';
import type { ScreenProps } from './Lobby';
import { act } from '../lib/api';

export default function Result({ room, players, me, isHost }: ScreenProps) {
  const state = room.state!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOf = useMemo(() => {
    const map = new Map(players.filter((p) => p.seat !== null).map((p) => [p.seat!, p.name]));
    return (seat: number) => map.get(seat) ?? `座席${seat}`;
  }, [players]);
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const winners = new Set(state.winnerSeats ?? []);
  const iWon = me.seat !== null && winners.has(me.seat);

  const again = async () => {
    setBusy(true);
    setError(null);
    try { await act('next_game', { code: room.code }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

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
      {isHost ? (
        <button disabled={busy} onClick={again} className="rounded-xl bg-amber-400 text-slate-900 font-bold py-4 text-lg disabled:opacity-40">もう一回（同じメンバー）</button>
      ) : (
        <p className="text-center text-slate-400">ホストの操作を待っています…</p>
      )}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div>
  );
}
