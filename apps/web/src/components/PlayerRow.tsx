import type { CSSProperties, ReactNode } from 'react';
import type { PlayerState } from '@lucky7/engine';
import { currentScore } from '@lucky7/engine';
import type { LongPressHandlers } from '../hooks/useLongPress';
import type { RowEffect } from '../lib/events';
import CardView from './CardView';

/** アバターの地色（落ち着いた宝石色） */
const AVATAR_COLORS = ['#8b3b5e', '#2f6b8f', '#3f6b45', '#7a5230', '#5a4b8f', '#2c6f6b', '#8f5230', '#4a5a7c'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Chip({ tone, children }: { tone: 'gold' | 'green' | 'rose' | 'blue' | 'dim'; children: ReactNode }) {
  const cls = {
    gold: 'bg-gold/15 text-gold ring-gold/35',
    green: 'bg-mint/15 text-mint ring-mint/30',
    rose: 'bg-rose/20 text-rose ring-rose/40',
    blue: 'bg-frost/15 text-frost ring-frost/30',
    dim: 'bg-edge/5 text-cream/40 ring-edge/10',
  }[tone];
  return <span className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold leading-4 ring-1 ${cls}`}>{children}</span>;
}

function SevenBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="animate-sparkOut absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full bg-seven"
          style={
            {
              '--a': `${i * 30}deg`,
              animationDelay: `${i * 28}ms`,
              boxShadow: '0 0 8px var(--seven-glow)',
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function PlayerRow({
  player,
  name,
  isMe,
  isTurn,
  isChoosing,
  hiddenIds,
  effect,
  effectKey,
  onNamePress,
}: {
  player: PlayerState;
  name: string;
  isMe: boolean;
  isTurn: boolean;
  isChoosing: boolean;
  /** 飛行中で隠しておくカード */
  hiddenIds: ReadonlySet<string>;
  effect?: RowEffect;
  effectKey: number;
  onNamePress?: LongPressHandlers;
}) {
  const busted = player.status === 'busted';
  const stayed = player.status === 'stayed';
  const lit = isTurn || isChoosing;
  const score = player.status === 'active' ? currentScore(player) : player.roundScore;
  // バースト時、重複した2枚目は必ず末尾にある
  const bustIndex = busted ? player.cards.length - 1 : -1;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-2.5 transition-colors duration-300 ${
        lit ? 'lamp-lit' : stayed ? 'stayed-row border border-frost/25' : 'lacquer'
      } ${busted ? 'opacity-70 grayscale-[.35]' : ''} ${effect === 'bust' ? 'animate-shake' : ''} ${
        effect === 'triple' ? 'animate-orangePulse' : ''
      }`}
    >
      {effect === 'bust' && <div key={`f${effectKey}`} className="animate-redFlash pointer-events-none absolute inset-0" />}
      {effect === 'freeze' && (
        <div
          key={`z${effectKey}`}
          className="frost-wash animate-frostIn pointer-events-none absolute inset-0"
        />
      )}
      {effect === 'seven' && <SevenBurst key={`s${effectKey}`} />}

      <div className="relative flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[13px] font-extrabold text-white/95 ring-1 ring-edge/15"
          style={{ background: avatarColor(name) }}
          aria-hidden
        >
          {name.slice(0, 1)}
        </span>
        <span className="min-w-0 select-none truncate font-bold" {...onNamePress}>
          {name}
          {isMe && <span className="ml-1 text-[11px] font-normal text-cream/40">あなた</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {player.hasInsurance && <Chip tone="blue">保険</Chip>}
          {isChoosing && <Chip tone="gold">選択中</Chip>}
          {busted ? <Chip tone="rose">バースト</Chip> : stayed ? <Chip tone="green">確定</Chip> : <Chip tone="dim">現役</Chip>}
        </span>
        <span className="ml-auto shrink-0 text-right text-[11px] leading-tight text-cream/45">
          <b className="font-display text-[17px] font-extrabold text-cream/95">{score}</b>
          <span className="ml-1">今</span>
          <span className="mx-1 text-cream/20">/</span>
          <b className="font-display text-[13px] font-extrabold text-gold">{player.totalScore}</b>
          <span className="ml-0.5">計</span>
        </span>
      </div>

      <div className="relative mt-2 flex min-h-[62px] flex-wrap items-end pl-[7px]">
        {player.cards.length === 0 && <span className="self-center text-[11px] text-cream/25">まだ場札はありません</span>}
        {player.cards.map((c, i) => (
          <CardView
            key={c.id}
            card={c}
            size="sm"
            track
            hidden={hiddenIds.has(c.id)}
            marked={i === bustIndex}
            className="transition-transform"
            style={{
              marginLeft: -7,
              zIndex: i,
              transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 1.3}deg)`,
              transformOrigin: 'bottom center',
            }}
          />
        ))}
      </div>
    </div>
  );
}
