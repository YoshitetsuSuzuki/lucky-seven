import { useRef } from 'react';
import { targetCandidates, waitingOn } from '@lucky7/engine';
import type { ScreenProps } from '../hooks/useRoom';
import { useAct } from '../hooks/useAct';
import { useNameOf } from '../hooks/useNameOf';
import { useLuckyToggle } from '../hooks/useLuckyToggle';
import { useTicker } from '../hooks/useTicker';
import { useBgm, useSound } from '../hooks/useSound';
import { useCardFlights } from '../hooks/useCardFlights';
import { describeEvent, rowEffects } from '../lib/events';
import PlayerRow from './PlayerRow';
import Controls from './Controls';
import Timer from './Timer';
import TargetModal from './TargetModal';
import RoundEndOverlay from './RoundEndOverlay';
import ReactionBar from './ReactionBar';
import SoundToggle from './SoundToggle';
import TablePanel from './TablePanel';
import FlyingCards from './FlyingCards';

export default function Table({ room, players, me, isHost }: ScreenProps) {
  const { busy, error, run } = useAct(room.code);
  const { lucky, handlers: luckyPress } = useLuckyToggle(room.code, me.id);
  const nameOf = useNameOf(players);
  const state = room.state;
  const mySeat = me.seat;

  const deckRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useTicker(room.code, state, room.status === 'playing');
  useBgm();
  useSound(state, room.version);
  const { flights, hiddenIds, startFlight } = useCardFlights({
    version: room.version,
    events: state?.events,
    deckRef,
    discardRef,
    boardRef,
  });

  if (!state) return <p className="p-6 text-muted">状態を読み込み中…</p>;

  const waiting = waitingOn(state);
  const myTurn = mySeat !== null && waiting?.seat === mySeat && waiting.kind === 'turn';
  const myChoice = mySeat !== null && state.pending?.bySeat === mySeat;
  const effects = rowEffects(state.events);
  const sevenNow = state.events.some((e) => e.type === 'seven');
  const messages = state.events.map((e) => describeEvent(e, nameOf)).filter((x): x is string => !!x);

  const ordered = [...state.players].sort((a, b) => (a.seat === mySeat ? -1 : b.seat === mySeat ? 1 : a.seat - b.seat));

  return (
    <div className="mx-auto min-h-full max-w-lg px-3 pb-44">
      <div className="sticky top-0 z-20 -mx-3 bg-gradient-to-b from-ink via-ink/94 to-transparent px-3 pb-3 pt-1">
        <header className="flex items-center gap-2.5 px-0.5 pb-1.5">
          <h1 className="font-display text-[19px] font-extrabold tracking-tight">
            ラッキー
            <span
              key={`seven-${room.version}`}
              className={`${lucky ? 'text-[#ffe3a0]' : 'text-gold'} ${sevenNow ? 'animate-sevenGlow' : ''}`}
            >
              7
            </span>
          </h1>
          <span className="text-[11px] leading-tight text-muted">
            R{state.round}
            <span className="mx-1 text-cream/15">/</span>
            山札 {state.deckCount}
          </span>
          <span className="ml-auto truncate text-[12px] font-bold text-cream/80">
            {waiting ? (waiting.seat === mySeat ? 'あなたの番' : `${nameOf(waiting.seat)} の番`) : ''}
          </span>
          <Timer deadline={state.deadline} total={state.settings.turnSeconds} />
          <SoundToggle />
        </header>

        <TablePanel
          deckCount={state.deckCount}
          discard={state.discard}
          messages={messages}
          version={room.version}
          deckRef={deckRef}
          discardRef={discardRef}
        />
      </div>

      <div ref={boardRef} className="space-y-2 pt-1">
        {ordered.map((p) => (
          <PlayerRow
            key={p.seat}
            player={p}
            name={nameOf(p.seat)}
            isMe={p.seat === mySeat}
            isTurn={waiting?.kind === 'turn' && waiting.seat === p.seat}
            isChoosing={state.pending?.bySeat === p.seat}
            hiddenIds={hiddenIds}
            effect={effects.get(p.seat)}
            effectKey={room.version}
            onNamePress={p.seat === mySeat ? luckyPress : undefined}
          />
        ))}
      </div>

      {mySeat === null && <p className="py-3 text-center text-sm text-muted">観戦中（次のゲームから参加できます）</p>}

      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink/95 to-transparent p-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-lg space-y-2">
          {error && <p className="text-center text-sm text-rose">{error}</p>}
          <ReactionBar code={room.code} name={me.name} />
          {myTurn && <Controls busy={busy} onHit={() => void run('hit')} onStay={() => void run('stay')} />}
        </div>
      </div>

      <FlyingCards flights={flights} start={startFlight} />

      {myChoice && state.pending && mySeat !== null && (
        <TargetModal
          pending={state.pending}
          candidates={targetCandidates(state)}
          nameOf={nameOf}
          mySeat={mySeat}
          busy={busy}
          onChoose={(seat) => void run('choose_target', { targetSeat: seat })}
        />
      )}
      {state.phase === 'round_end' && (
        <RoundEndOverlay
          state={state}
          nameOf={nameOf}
          isHost={isHost}
          seated={mySeat !== null}
          busy={busy}
          updatedAt={room.updated_at}
          onNext={() => void run('next_round')}
        />
      )}
    </div>
  );
}
