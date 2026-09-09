import { describe, it, expect } from 'vitest';
import { applyAction, waitingOn, startGame } from '../src/game.ts';
import { N, ADD, INSURANCE, start, SETTINGS, NOW, rng } from './helpers.ts';
import { EngineError } from '../src/types.ts';

describe('startGame / 配布', () => {
  it('最初の親は座席0、配布は座席1から始まり親が最後', () => {
    // 2人: 座席1に n3, 座席0(親)に n5
    const { state } = start([N(3), N(5)]);
    expect(state.round).toBe(1);
    expect(state.dealerSeat).toBe(0);
    expect(state.players[1].cards).toEqual([N(3)]);
    expect(state.players[0].cards).toEqual([N(5)]);
    expect(state.phase).toBe('turn');
    expect(state.turnSeat).toBe(1);
    expect(state.deckCount).toBe(92);
    expect(state.deadline).toBe(NOW + 20_000);
    expect(state.autoAt).toBeNull();
  });
  it('2人未満は例外', () => {
    expect(() => startGame([{ seat: 0, isCpu: false }], SETTINGS, rng(), NOW)).toThrow(EngineError);
  });
  it('待機中の座席が CPU なら autoAt が付く', () => {
    const { state } = start([N(3), N(5)], 2, SETTINGS, [1]);
    expect(state.turnSeat).toBe(1);
    expect(state.autoAt).toBe(NOW + 1500);
    expect(state.deadline).toBeNull();
  });
  it('無制限設定なら deadline は null', () => {
    const { state } = start([N(3), N(5)], 2, { ...SETTINGS, turnSeconds: null });
    expect(state.deadline).toBeNull();
  });
});

describe('hit / stay', () => {
  it('hit で1枚引いて手番が次へ', () => {
    const { state, secrets } = start([N(3), N(5), N(8)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].cards).toEqual([N(3), N(8)]);
    expect(r.state.turnSeat).toBe(0);
    expect(r.state.events).toContainEqual({ type: 'draw', seat: 1, card: N(8) });
  });
  it('手番でない人の hit は例外', () => {
    const { state, secrets } = start([N(3), N(5)]);
    expect(() => applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW)).toThrow(EngineError);
  });
  it('stay で得点確定し手番が次へ。全員降りたらラウンド終了', () => {
    const { state, secrets } = start([N(3), N(5)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    expect(a.state.players[1].status).toBe('stayed');
    expect(a.state.players[1].roundScore).toBe(3);
    expect(a.state.turnSeat).toBe(0);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('round_end');
    expect(b.state.players[0].totalScore).toBe(5);
    expect(b.state.players[1].totalScore).toBe(3);
    expect(b.state.discard).toHaveLength(2);
    expect(b.state.players[0].cards).toEqual([]);
    expect(waitingOn(b.state)).toBeNull();
  });
  it('修飾カードは場に加わる', () => {
    const { state, secrets } = start([N(3), N(5), ADD(4)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].cards).toEqual([N(3), ADD(4)]);
  });
});

describe('バーストと保険', () => {
  it('同じ数字でバースト: 得点0・場札は捨て札・ラウンド脱落', () => {
    const { state, secrets } = start([N(3, 0), N(5), N(3, 1)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const p = r.state.players[1];
    expect(p.status).toBe('busted');
    expect(p.cards).toEqual([]);
    expect(p.roundScore).toBe(0);
    expect(r.state.discard.map((c) => c.id)).toEqual(['n3-0', 'n3-1']);
    expect(r.state.events).toContainEqual({ type: 'bust', seat: 1, card: N(3, 1) });
    expect(r.state.turnSeat).toBe(0);
  });
  it('保険を引くと保持、カードは捨て札へ', () => {
    const { state, secrets } = start([N(3), N(5), INSURANCE()]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].hasInsurance).toBe(true);
    expect(r.state.players[1].cards).toEqual([N(3)]);
    expect(r.state.discard).toEqual([INSURANCE()]);
  });
  it('保険があれば重複を捨てて続行', () => {
    const { state, secrets } = start([N(3, 0), N(5), INSURANCE(), N(9), N(3, 1)]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 保険
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW); // n9
    const c = applyAction(b.state, b.secrets, { type: 'hit', seat: 1 }, rng(), NOW); // n3 重複
    const p = c.state.players[1];
    expect(p.status).toBe('active');
    expect(p.hasInsurance).toBe(false);
    expect(p.cards).toEqual([N(3, 0)]);
    expect(c.state.events).toContainEqual({ type: 'insurance_used', seat: 1, card: N(3, 1) });
  });
  it('一人だけ残ったら手番は自分に戻る', () => {
    const { state, secrets } = start([N(3), N(5), N(8)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    expect(b.state.turnSeat).toBe(0);
    expect(b.state.phase).toBe('turn');
  });
});
