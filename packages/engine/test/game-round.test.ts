import { describe, it, expect } from 'vitest';
import { applyAction, waitingOn } from '../src/game.ts';
import { N, FREEZE, start, rng, NOW, SETTINGS } from './helpers.ts';

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
