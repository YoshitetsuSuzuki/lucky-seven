import type { PlayerState } from '@lucky7/engine';
import { currentScore } from '@lucky7/engine';
import CardView from './CardView';

const STATUS: Record<PlayerState['status'], { label: string; cls: string }> = {
  active: { label: '', cls: '' },
  stayed: { label: '確定', cls: 'bg-emerald-600' },
  busted: { label: 'バースト', cls: 'bg-rose-600' },
};

export default function PlayerRow({
  player, name, isMe, isTurn, isChoosing, lastCardId, shake, onNamePress,
}: {
  player: PlayerState; name: string; isMe: boolean; isTurn: boolean; isChoosing: boolean;
  lastCardId: string | null; shake: boolean;
  onNamePress?: { onPointerDown: () => void; onPointerUp: () => void; onPointerLeave: () => void };
}) {
  const st = STATUS[player.status];
  const score = player.status === 'active' ? currentScore(player) : player.roundScore;
  return (
    <div className={`rounded-2xl p-3 transition ${isTurn || isChoosing ? 'bg-slate-700 ring-2 ring-amber-400' : 'bg-slate-800'} ${player.status === 'busted' ? 'opacity-60' : ''} ${shake ? 'animate-shake' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold truncate select-none" {...onNamePress}>
          {name}{isMe && <span className="ml-1 text-xs text-slate-400">(あなた)</span>}
        </span>
        {player.hasInsurance && <span title="保険" className="text-xs rounded bg-sky-600 px-1.5 py-0.5">保険</span>}
        {st.label && <span className={`text-xs rounded px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>}
        {isChoosing && <span className="text-xs text-amber-300">選択中…</span>}
        <span className="ml-auto text-sm text-slate-400">今 <b className="text-slate-100">{score}</b> / 計 <b className="text-slate-100">{player.totalScore}</b></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 min-h-[2.5rem]">
        {player.cards.map((c) => <CardView key={c.id} card={c} small animate={c.id === lastCardId} />)}
      </div>
    </div>
  );
}
