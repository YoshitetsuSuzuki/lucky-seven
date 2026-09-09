import type { Card } from './cards.ts';

export const SEVEN_BONUS = 15;

export function uniqueNumberCount(cards: readonly Card[]): number {
  const values = new Set<number>();
  for (const c of cards) if (c.kind === 'number') values.add(c.value);
  return values.size;
}

export function numberValues(cards: readonly Card[]): Set<number> {
  const values = new Set<number>();
  for (const c of cards) if (c.kind === 'number') values.add(c.value);
  return values;
}

export function scoreCards(cards: readonly Card[], seven: boolean): number {
  let numbers = 0;
  let adds = 0;
  let mul = false;
  for (const c of cards) {
    if (c.kind === 'number') numbers += c.value;
    else if (c.kind === 'add') adds += c.value;
    else if (c.kind === 'mul') mul = true;
  }
  if (mul) numbers *= 2;
  return numbers + adds + (seven ? SEVEN_BONUS : 0);
}
