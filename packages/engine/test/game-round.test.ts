import { describe, it, expect } from 'vitest';
import { applyAction, waitingOn } from '../src/game.ts';
import type { Card } from '../src/cards.ts';
import type { PublicState } from '../src/types.ts';
import { N, ADD, FREEZE, INSURANCE, TRIPLE, start, rng, NOW, SETTINGS } from './helpers.ts';

const total = (s: PublicState) =>
  s.deckCount +
  s.discard.length +
  s.players.reduce((n, p) => n + p.cards.length, 0) +
  (s.pending ? 1 : 0) +
  s.actionQueue.length;

describe('7種達成', () => {
  it('7種揃った瞬間 +15 で全員のラウンド終了', () => {
    // 座席1: n1.. 配布で n1、hit で n2..n7 を引く（座席0 は毎回 stay しないよう hit で数字を積む）
    const top = [N(1), N(0), N(2), N(12), N(3), N(11), N(4), N(10), N(5), N(9), N(6), N(8), N(7)];
    let { state, secrets } = start(top, 2);
    for (let i = 0; i < 6; i++) {
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
      if (state.phase === 'turn') ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW));
    }
    expect(state.phase).toBe('round_end');
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 15);
    expect(state.players[0].status).toBe('stayed');
    expect(state.players[0].roundScore).toBe(0 + 12 + 11 + 10 + 9 + 8);
    expect(state.events).toContainEqual({ type: 'seven', seat: 1 });
    expect(state.sevenSeat).toBe(1);
  });
});

describe('三連中の7種達成', () => {
  /** 座席1 に n1..n6（6種）、座席0 に n0,n12,n11,n10,n9,n8 を積み、座席1 が三連を引いて自分を対象にする */
  const setup = (tripleCards: Card[]) => {
    const top = [
      N(1), N(0),
      N(2), N(12),
      N(3), N(11),
      N(4), N(10),
      N(5), N(9),
      N(6), N(8),
      TRIPLE(),
      ...tripleCards,
    ];
    let { state, secrets } = start(top, 2);
    expect(total(state)).toBe(94);
    for (let i = 0; i < 5; i++) {
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW));
      expect(total(state)).toBe(94);
    }
    expect(state.players[1].cards.filter((c) => c.kind === 'number')).toHaveLength(6);
    ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
    expect(state.pending?.type).toBe('triple');
    expect(total(state)).toBe(94);
    return applyAction(state, secrets, { type: 'choose_target', seat: 1, targetSeat: 1 }, rng(), NOW);
  };

  it('7種目のあとの重複数字は捨て札、修飾は加点、3枚引き切ってから終了', () => {
    // 三連の3枚: n7(7種目) → n3(重複) → +4
    const { state } = setup([N(7), N(3, 1), ADD(4)]);
    const kinds = state.events.map((e) => e.type);
    expect(kinds).toEqual(['triple', 'draw', 'seven', 'bonus_discard', 'draw', 'round_end']);
    expect(state.events[3]).toEqual({ type: 'bonus_discard', seat: 1, card: N(3, 1) });
    expect(state.events[4]).toEqual({ type: 'draw', seat: 1, card: ADD(4) });
    // 重複でバーストせず、n7 と +4 が得点に乗る（重複 n3 は二重計上されない）
    expect(state.players[1].status).toBe('stayed');
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 4 + 15);
    expect(state.players[0].roundScore).toBe(0 + 12 + 11 + 10 + 9 + 8);
    expect(state.phase).toBe('round_end');
    expect(state.sevenSeat).toBe(1);
    expect(state.triple).toBeNull();
    expect(state.actionQueue).toEqual([]);
    expect(state.discard.map((c) => c.id)).toContain('n3-1');
    expect(total(state)).toBe(94);
  });

  it('7種目のあとのアクションは捨て札、8種目の数字は場に加わり加点される', () => {
    // 三連の3枚: n7(7種目) → 氷結(捨て札) → n8(8種目)
    const { state } = setup([N(7), FREEZE(), N(8, 1)]);
    const kinds = state.events.map((e) => e.type);
    expect(kinds).toEqual(['triple', 'draw', 'seven', 'bonus_discard', 'draw', 'round_end']);
    expect(state.events[3]).toEqual({ type: 'bonus_discard', seat: 1, card: FREEZE() });
    expect(state.events).not.toContainEqual({ type: 'freeze', seat: 1, targetSeat: 1 });
    expect(state.pending).toBeNull();
    expect(state.actionQueue).toEqual([]);
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 15);
    expect(state.phase).toBe('round_end');
    expect(state.discard.map((c) => c.id)).toContain('a-freeze-0');
    expect(total(state)).toBe(94);
  });

  it('次のラウンドで sevenSeat がリセットされる', () => {
    const { state, secrets } = setup([N(7), N(3, 1), ADD(4)]);
    expect(state.sevenSeat).toBe(1);
    const next = applyAction(state, secrets, { type: 'next_round' }, rng(), NOW);
    expect(next.state.sevenSeat).toBeNull();
  });
});

describe('ラウンド終了と次ラウンド', () => {
  it('next_round で親が交代し全員リセット、捨て札は残る', () => {
    const { state, secrets } = start([N(3), N(5), N(6), N(7)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('round_end');
    const c = applyAction(b.state, b.secrets, { type: 'next_round' }, rng(), NOW);
    expect(c.state.round).toBe(2);
    expect(c.state.dealerSeat).toBe(1);
    expect(c.state.turnSeat).toBe(0);
    expect(c.state.players[0].cards).toEqual([N(6)]);
    expect(c.state.players[1].cards).toEqual([N(7)]);
    expect(c.state.discard).toHaveLength(2);
    expect(c.state.players[0].totalScore).toBe(5);
  });
  it('round_end 以外で next_round は例外', () => {
    const { state, secrets } = start([N(3), N(5)]);
    expect(() => applyAction(state, secrets, { type: 'next_round' }, rng(), NOW)).toThrow();
  });
  it('保険を持ったままラウンドが終わると hasInsurance がリセットされる', () => {
    const { state, secrets } = start([N(3), N(5), INSURANCE(), N(6), N(7)]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 保険を取得
    expect(a.state.players[1].hasInsurance).toBe(true);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    const c = applyAction(b.state, b.secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    expect(c.state.phase).toBe('round_end');
    expect(c.state.players[1].hasInsurance).toBe(false);
  });
});

describe('ゲーム終了', () => {
  it('目標点到達で game_end、最高点が勝者', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'points', target: 5 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('game_end');
    expect(b.state.winnerSeats).toEqual([0]);
    expect(waitingOn(b.state)).toBeNull();
  });
  it('同点は同順位', () => {
    const { state, secrets } = start([N(5, 0), N(5, 1)], 2, { ...SETTINGS, endMode: 'points', target: 5 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.winnerSeats).toEqual([0, 1]);
  });
  it('ラウンド数モードは規定ラウンド終了で game_end', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'rounds', target: 1 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('game_end');
  });
});

describe('時間切れ', () => {
  it('手番の時間切れは自動で降りる', () => {
    const { state, secrets } = start([N(3), N(5)]);
    const a = applyAction(state, secrets, { type: 'timeout' }, rng(), NOW + 30_000);
    expect(a.state.players[1].status).toBe('stayed');
    expect(a.state.turnSeat).toBe(0);
    expect(a.state.events).toContainEqual({ type: 'timeout', seat: 1 });
    expect(a.state.deadline).toBe(NOW + 30_000 + 20_000);
  });
  it('対象選択の時間切れは自分を対象', () => {
    const { state, secrets } = start([N(3), N(5), FREEZE()]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'timeout' }, rng(), NOW);
    expect(b.state.players[1].status).toBe('stayed');
  });
  it('待機中でなければ例外', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'rounds', target: 1 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(() => applyAction(b.state, b.secrets, { type: 'timeout' }, rng(), NOW)).toThrow();
  });
});

describe('カード保存則', () => {
  it('どの時点でも 山札+捨て札+場札+保留 = 94', () => {
    let { state, secrets } = start([N(3), N(5), N(6), FREEZE(), N(8)], 3);
    const count = () =>
      state.deckCount +
      state.discard.length +
      state.players.reduce((n, p) => n + p.cards.length, 0) +
      (state.pending ? 1 : 0) +
      state.actionQueue.length;
    expect(count()).toBe(94);
    ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
    expect(count()).toBe(94);
    ({ state, secrets } = applyAction(state, secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW));
    expect(count()).toBe(94);
  });
});
