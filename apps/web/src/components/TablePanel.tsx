import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Card } from '@lucky7/engine';
import CardView, { CardBack } from './CardView';

const EVENT_MS = 2500;
/** 山札の束の重なり枚数（一番上が飛行の始点） */
const STACK = [-3, -2, -1];

export default function TablePanel({
  deckCount,
  discard,
  messages,
  notice,
  version,
  deckRef,
  discardRef,
}: {
  deckCount: number;
  discard: Card[];
  messages: string[];
  /** 消えずに出しっぱなしにする案内（ゲーム終了時など）。実況より優先 */
  notice?: string | null;
  version: number;
  deckRef: RefObject<HTMLDivElement>;
  discardRef: RefObject<HTMLDivElement>;
}) {
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    if (messages.length === 0) {
      setShown([]);
      return;
    }
    setShown(messages);
    const id = window.setTimeout(() => setShown([]), EVENT_MS);
    return () => window.clearTimeout(id);
    // version が変わった時だけ差し替える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const top = discard.length > 0 ? discard[discard.length - 1] : null;

  return (
    <div className="felt flex items-end gap-2 rounded-2xl px-3 py-2.5">
      {/* 山札 */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="text-[10px] font-bold tracking-[0.18em] text-feltink/60">山札</span>
        <div className="relative" style={{ width: 56, height: 78 }}>
          {STACK.map((o, i) => (
            <CardBack
              key={o}
              size="md"
              className="absolute inset-0"
              style={{ transform: `translate(${o * 1.7}px, ${o * -1.6}px) rotate(${(i - 1.5) * 3.4}deg)`, opacity: 0.9 }}
            />
          ))}
          <div ref={deckRef} className="absolute inset-0">
            <CardBack size="md" />
          </div>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-ink/90 px-2 py-[1px] font-display text-[11px] font-extrabold text-gold ring-1 ring-gold/30">
            {deckCount}
          </span>
        </div>
      </div>

      {/* 実況 */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch px-1 pb-2 text-center">
        {notice ? (
          <p className="animate-fadeUp text-[12px] font-bold leading-snug text-feltgold [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">{notice}</p>
        ) : shown.length > 0 ? (
          <div className="space-y-0.5">
            {shown.slice(0, 3).map((m, i) => (
              <p
                key={`${version}-${i}`}
                className="animate-fadeUp text-[12px] font-bold leading-snug text-feltink [text-shadow:0_1px_6px_rgba(0,0,0,.4)]"
              >
                {m}
              </p>
            ))}
          </div>
        ) : (
          <p className="font-display text-[11px] tracking-[0.32em] text-feltink/35">LUCKY SEVEN</p>
        )}
      </div>

      {/* 捨て札 */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="text-[10px] font-bold tracking-[0.18em] text-feltink/60">捨て札</span>
        <div ref={discardRef} className="relative" style={{ width: 56, height: 78 }}>
          {top ? (
            <CardView card={top} size="md" className="opacity-95" />
          ) : (
            <div className="h-full w-full rounded-lg border border-dashed border-feltink/25" />
          )}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-ink/90 px-2 py-[1px] font-display text-[11px] font-extrabold text-cream/70 ring-1 ring-edge/10">
            {discard.length}
          </span>
        </div>
      </div>
    </div>
  );
}
