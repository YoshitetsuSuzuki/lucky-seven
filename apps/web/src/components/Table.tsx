import { targetCandidates, waitingOn } from '@lucky7/engine';
import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { useNameOf } from '../hooks/useNameOf';
import { useLuckyToggle } from '../hooks/useLuckyToggle';
import { useTicker } from '../hooks/useTicker';
import PlayerRow from './PlayerRow';
import Controls from './Controls';
import Timer from './Timer';
import TargetModal from './TargetModal';
import RoundEndOverlay from './RoundEndOverlay';
import EventToast from './EventToast';
import ReactionBar from './ReactionBar';

export default function Table({ room, players, me, isHost }: ScreenProps) {
  const { busy, error, run } = useAct(room.code);
  const { lucky, handlers: luckyPress } = useLuckyToggle(room.code, me.id);
  const nameOf = useNameOf(players);
  const state = room.state;
  const mySeat = me.seat;

  useTicker(room.code, state, room.status === 'playing');
  if (!state) return <p className="p-6 text-slate-400">状態を読み込み中…</p>;

  const waiting = waitingOn(state);
  const myTurn = mySeat !== null && waiting?.seat === mySeat && waiting.kind === 'turn';
  const myChoice = mySeat !== null && state.pending?.bySeat === mySeat;
  const lastDraw = [...state.events].reverse().find((e) => e.type === 'draw');
  const lastCardId = lastDraw && lastDraw.type === 'draw' ? lastDraw.card.id : null;
  const bustSeats = new Set(state.events.filter((e) => e.type === 'bust').map((e) => e.seat));

  const ordered = [...state.players].sort((a, b) => (a.seat === mySeat ? -1 : b.seat === mySeat ? 1 : a.seat - b.seat));

  return (
    <div className="min-h-full max-w-lg mx-auto p-3 pb-44 space-y-2">
      <header className="flex items-center gap-3 px-1 py-2">
        <h1 className="text-xl font-black">ラッキー<span className={lucky ? 'text-amber-300' : 'text-amber-400/90'}>7</span></h1>
        <span className="text-sm text-slate-400">R{state.round} ・ 山札 {state.deckCount}</span>
        <span className="ml-auto text-sm text-slate-300">
          {waiting ? (waiting.seat === mySeat ? 'あなたの番' : `${nameOf(waiting.seat)} の番`) : ''}
        </span>
        <Timer deadline={state.deadline} total={state.settings.turnSeconds} />
      </header>

      {ordered.map((p) => (
        <PlayerRow
          key={p.seat}
          player={p}
          name={nameOf(p.seat)}
          isMe={p.seat === mySeat}
          isTurn={waiting?.kind === 'turn' && waiting.seat === p.seat}
          isChoosing={state.pending?.bySeat === p.seat}
          lastCardId={lastCardId}
          shake={bustSeats.has(p.seat)}
          onNamePress={p.seat === mySeat ? luckyPress : undefined}
        />
      ))}

      {mySeat === null && <p className="text-center text-slate-400 text-sm py-2">観戦中（次のゲームから参加できます）</p>}

      <div
        className="fixed bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-lg mx-auto space-y-2">
          {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
          <ReactionBar code={room.code} name={me.name} />
          {myTurn && <Controls busy={busy} onHit={() => void run('hit')} onStay={() => void run('stay')} />}
        </div>
      </div>

      {myChoice && state.pending && mySeat !== null && (
        <TargetModal pending={state.pending} candidates={targetCandidates(state)} nameOf={nameOf} mySeat={mySeat} busy={busy}
          onChoose={(seat) => void run('choose_target', { targetSeat: seat })} />
      )}
      {state.phase === 'round_end' && (
        <RoundEndOverlay state={state} nameOf={nameOf} isHost={isHost} seated={mySeat !== null} busy={busy} updatedAt={room.updated_at} onNext={() => void run('next_round')} />
      )}
      <EventToast events={state.events} version={room.version} nameOf={nameOf} />
    </div>
  );
}
