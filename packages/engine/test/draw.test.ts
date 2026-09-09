import { describe, it, expect } from 'vitest';
import type { Card } from '../src/cards.ts';
import { buildDeck, mulberry32 } from '../src/cards.ts';
import { takeCard } from '../src/draw.ts';
import type { PlayerState, PublicState, Secrets } from '../src/types.ts';

const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
const FREEZE: Card = { id: 'a-freeze-0', kind: 'action', action: 'freeze' };

function player(cards: Card[] = []): PlayerState {
  return { seat: 0, isCpu: false, status: 'active', cards, hasInsurance: false, roundScore: 0, totalScore: 0 };
}
function state(discard: Card[] = []): PublicState {
  return {
    settings: { turnSeconds: null, endMode: 'points', target: 200 },
    round: 1, dealerSeat: 0, dealSeat: null, turnSeat: 0, phase: 'turn', pending: null, triple: null,
    actionQueue: [], players: [player()], discard, deckCount: 0, deadline: null, autoAt: null, events: [], winnerSeats: null,
  };
}

describe('takeCard', () => {
  it('山札の先頭を取り deckCount を更新', () => {
    const s = state();
    const sec: Secrets = { deck: [N(3), N(5)], luckySeats: [] };
    const card = takeCard(s, sec, player(), mulberry32(1));
    expect(card).toEqual(N(3));
    expect(sec.deck).toEqual([N(5)]);
    expect(s.deckCount).toBe(1);
  });

  it('山札が空なら捨て札を切り直して継続', () => {
    const s = state([N(1), N(2), N(4)]);
    const sec: Secrets = { deck: [], luckySeats: [] };
    const card = takeCard(s, sec, player(), mulberry32(1));
    expect(['n1-0', 'n2-0', 'n4-0']).toContain(card.id);
    expect(s.discard).toEqual([]);
    expect(sec.deck).toHaveLength(2);
    expect(s.deckCount).toBe(2);
  });

  it('山札も捨て札も空なら例外', () => {
    const s = state();
    const sec: Secrets = { deck: [], luckySeats: [] };
    expect(() => takeCard(s, sec, player(), mulberry32(1))).toThrow();
  });

  it('ラッキーモード: 場にある数字を飛ばし、飛ばした分は底へ', () => {
    const s = state();
    const p = player([N(5, 0), N(7, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(7, 1), FREEZE, N(9)], luckySeats: [0] };
    const card = takeCard(s, sec, p, mulberry32(1));
    expect(card).toEqual(FREEZE);
    expect(sec.deck.map((c) => c.id)).toEqual(['n9-0', 'n5-1', 'n7-1']);
  });

  it('ラッキーモードでも対象外の座席は通常通り', () => {
    const s = state();
    const p = player([N(5, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(9)], luckySeats: [3] };
    expect(takeCard(s, sec, p, mulberry32(1))).toEqual(N(5, 1));
  });

  it('ラッキーモードで全カードが重複なら通常通り先頭', () => {
    const s = state();
    const p = player([N(5, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(5, 2)], luckySeats: [0] };
    expect(takeCard(s, sec, p, mulberry32(1))).toEqual(N(5, 1));
  });

  it('94枚全部引ける（捨て札再構成込み）', () => {
    const s = state();
    const sec: Secrets = { deck: buildDeck(), luckySeats: [] };
    const seen: string[] = [];
    for (let i = 0; i < 94; i++) seen.push(takeCard(s, sec, player(), mulberry32(1)).id);
    expect(new Set(seen).size).toBe(94);
  });
});
