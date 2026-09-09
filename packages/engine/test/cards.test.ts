import { describe, it, expect } from 'vitest';
import { buildDeck, mulberry32, shuffle } from '../src/cards.ts';

describe('buildDeck', () => {
  it('94枚で構成が正しい', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(94);
    const numbers = deck.filter((c) => c.kind === 'number');
    expect(numbers).toHaveLength(79);
    for (let v = 0; v <= 12; v++) {
      const copies = numbers.filter((c) => c.kind === 'number' && c.value === v).length;
      expect(copies).toBe(v === 0 ? 1 : v);
    }
    for (const action of ['freeze', 'triple', 'insurance'] as const) {
      expect(deck.filter((c) => c.kind === 'action' && c.action === action)).toHaveLength(3);
    }
    expect(deck.filter((c) => c.kind === 'add').map((c) => (c.kind === 'add' ? c.value : 0)).sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
    expect(deck.filter((c) => c.kind === 'mul')).toHaveLength(1);
  });
  it('id がすべて一意', () => {
    const ids = new Set(buildDeck().map((c) => c.id));
    expect(ids.size).toBe(94);
  });
});

describe('shuffle', () => {
  it('同じ seed なら同じ並び、元配列は変えない', () => {
    const deck = buildDeck();
    const a = shuffle(deck, mulberry32(42));
    const b = shuffle(deck, mulberry32(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(deck.map((c) => c.id)).toEqual(buildDeck().map((c) => c.id));
    expect(a).toHaveLength(94);
    expect(new Set(a.map((c) => c.id)).size).toBe(94);
  });
});
