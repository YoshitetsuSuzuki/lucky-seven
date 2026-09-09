import type { GameEvent } from '@lucky7/engine';
import { cardLabel } from '../components/CardView';

/** 卓の実況テキスト（表示しないイベントは null） */
export function describeEvent(e: GameEvent, nameOf: (seat: number) => string): string | null {
  switch (e.type) {
    case 'bust':
      return `${nameOf(e.seat)} がバースト！（${cardLabel(e.card)}）`;
    case 'insurance_used':
      return `${nameOf(e.seat)} が保険で回避`;
    case 'freeze':
      return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} を氷結`;
    case 'triple':
      return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} に三連`;
    case 'give_insurance':
      return `${nameOf(e.seat)} が ${nameOf(e.targetSeat)} に保険を渡した`;
    case 'seven':
      return `${nameOf(e.seat)} がラッキーセブン達成！`;
    case 'timeout':
      return `${nameOf(e.seat)} は時間切れ`;
    case 'stay':
      return `${nameOf(e.seat)} が降りた`;
    default:
      return null;
  }
}

export type RowEffect = 'bust' | 'freeze' | 'triple' | 'seven';

/** 座席ごとの一瞬の演出を、その版のイベントから決める */
export function rowEffects(events: GameEvent[]): Map<number, RowEffect> {
  const map = new Map<number, RowEffect>();
  for (const e of events) {
    if (e.type === 'bust') map.set(e.seat, 'bust');
    else if (e.type === 'freeze') map.set(e.targetSeat, 'freeze');
    else if (e.type === 'triple') map.set(e.targetSeat, 'triple');
    else if (e.type === 'seven') map.set(e.seat, 'seven');
  }
  return map;
}
