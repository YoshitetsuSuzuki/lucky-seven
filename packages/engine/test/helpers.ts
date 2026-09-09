import type { Card } from '../src/cards.ts';
import { buildDeck, mulberry32 } from '../src/cards.ts';
import type { Settings } from '../src/types.ts';
import { startGameWithDeck } from '../src/game.ts';

export const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
export const ADD = (value: number): Card => ({ id: `m-add-${value}`, kind: 'add', value });
export const MUL: Card = { id: 'm-mul', kind: 'mul' };
export const FREEZE = (i = 0): Card => ({ id: `a-freeze-${i}`, kind: 'action', action: 'freeze' });
export const TRIPLE = (i = 0): Card => ({ id: `a-triple-${i}`, kind: 'action', action: 'triple' });
export const INSURANCE = (i = 0): Card => ({ id: `a-insurance-${i}`, kind: 'action', action: 'insurance' });

/** 指定カードを上に置き、残りは buildDeck の順で続ける 94 枚の山札 */
export function craftDeck(top: Card[]): Card[] {
  const used = new Set(top.map((c) => c.id));
  return [...top, ...buildDeck().filter((c) => !used.has(c.id))];
}

export const SETTINGS: Settings = { turnSeconds: 20, endMode: 'points', target: 200 };
export const NOW = 1_700_000_000_000;
export const rng = () => mulberry32(7);

/** 人間 n 人（座席 0..n-1）でゲーム開始。配布は deck の先頭から座席 1,2,...,0(親) の順 */
export function start(
  top: Card[],
  n = 2,
  settings: Settings = SETTINGS,
  cpuSeats: number[] = [],
  luckySeats: number[] = [],
) {
  const seats = Array.from({ length: n }, (_, i) => ({ seat: i, isCpu: cpuSeats.includes(i) }));
  return startGameWithDeck(seats, settings, craftDeck(top), NOW, mulberry32(1), luckySeats);
}
