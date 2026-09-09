import { useEffect, useState } from 'react';
import type { GameEvent } from '@lucky7/engine';
import { cardLabel } from './CardView';

export function describeEvent(e: GameEvent, nameOf: (seat: number) => string): string | null {
  switch (e.type) {
    case 'bust': return `${nameOf(e.seat)} がバースト！（${cardLabel(e.card)}）`;
    case 'insurance_used': return `${nameOf(e.seat)} が保険で回避`;
    case 'freeze': return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} を氷結`;
    case 'triple': return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} に三連`;
    case 'give_insurance': return `${nameOf(e.seat)} が ${nameOf(e.targetSeat)} に保険を渡した`;
    case 'seven': return `${nameOf(e.seat)} がラッキーセブン達成！`;
    case 'timeout': return `${nameOf(e.seat)} は時間切れ`;
    case 'stay': return `${nameOf(e.seat)} が降りた`;
    default: return null;
  }
}

export default function EventToast({ events, version, nameOf }: { events: GameEvent[]; version: number; nameOf: (seat: number) => string }) {
  const [msgs, setMsgs] = useState<string[]>([]);
  useEffect(() => {
    const m = events.map((e) => describeEvent(e, nameOf)).filter((x): x is string => !!x);
    if (m.length === 0) { setMsgs([]); return; }
    setMsgs(m);
    const id = setTimeout(() => setMsgs([]), 2500);
    return () => clearTimeout(id);
    // version が変わった時だけ表示する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  if (msgs.length === 0) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 space-y-1 pointer-events-none">
      {msgs.map((m, i) => <div key={i} className="rounded-full bg-slate-100 text-slate-900 px-4 py-1.5 text-sm font-bold shadow">{m}</div>)}
    </div>
  );
}
