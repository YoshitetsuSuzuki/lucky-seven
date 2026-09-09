import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game.ts';
import { bustProbability, cpuDecide } from '../src/cpu.ts';
import { EngineError } from '../src/types.ts';
import { N, ADD, FREEZE, TRIPLE, INSURANCE, start, rng, NOW } from './helpers.ts';

describe('bustProbability', () => {
  it('場に数字がなければ 0', () => {
    const { state } = start([ADD(2), N(5)]);
    expect(bustProbability(state, 1)).toBe(0);
  });
  it('未公開の山札から自分の数字が出る確率', () => {
    // 座席1 が 12 を持つ。12 は全12枚中1枚が見えている → 残り11枚 / 山札92枚
    const { state } = start([N(12), N(5)]);
    expect(bustProbability(state, 1)).toBeCloseTo(11 / 92);
  });
  it('存在しない座席は例外', () => {
    const { state } = start([N(12), N(5)]);
    expect(() => bustProbability(state, 99)).toThrow(EngineError);
  });
});

describe('cpuDecide: 引く/降りる', () => {
  it('数字がない時は必ず引く', () => {
    const { state } = start([ADD(2), N(5)], 2, undefined, [1]);
    expect(cpuDecide(state, 1)).toEqual({ type: 'hit', seat: 1 });
  });
  it('低リスクなら引く', () => {
    const { state } = start([N(0), N(5)], 2, undefined, [1]); // 0 は1枚しかない → p=0
    expect(cpuDecide(state, 1)).toEqual({ type: 'hit', seat: 1 });
  });
  it('高得点かつ高リスクなら降りる', () => {
    // 座席1: 12,11,10,9 = 42点、バースト確率 (11+10+9+8)/残り
    const { state, secrets } = start([N(12), N(5), N(11), N(6), N(10), N(7), N(9), N(8)], 2, undefined, [1]);
    let s = state, sec = secrets;
    for (const seat of [1, 0, 1, 0, 1, 0]) ({ state: s, secrets: sec } = applyAction(s, sec, { type: 'hit', seat }, rng(), NOW));
    expect(s.players[1].roundScore === 0 && s.players[1].status === 'active').toBe(true);
    expect(cpuDecide(s, 1)).toEqual({ type: 'stay', seat: 1 });
  });
  it('保険持ちは強気に引く', () => {
    const { state, secrets } = start([N(12), N(5), INSURANCE(), N(6), N(11), N(7)], 2, undefined, [1]);
    let s = state, sec = secrets;
    for (const seat of [1, 0, 1, 0]) ({ state: s, secrets: sec } = applyAction(s, sec, { type: 'hit', seat }, rng(), NOW));
    expect(s.players[1].hasInsurance).toBe(true);
    expect(cpuDecide(s, 1)).toEqual({ type: 'hit', seat: 1 });
  });
});

describe('cpuDecide: 対象選択', () => {
  it('氷結は今ラウンド最高点の相手へ', () => {
    // 3人: 座席1=n3(CPU), 座席2=n12, 座席0=n5。座席1 が氷結を引く
    const { state, secrets } = start([N(3), N(12), N(5), FREEZE()], 3, undefined, [1]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(cpuDecide(a.state, 1)).toEqual({ type: 'choose_target', seat: 1, targetSeat: 2 });
  });
  it('氷結は自分が最高なら自分へ', () => {
    const { state, secrets } = start([N(12), N(3), N(5), FREEZE()], 3, undefined, [1]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(cpuDecide(a.state, 1)).toEqual({ type: 'choose_target', seat: 1, targetSeat: 1 });
  });
  it('三連は自分の場が2枚以下なら自分へ', () => {
    const { state, secrets } = start([N(3), N(4), N(5), TRIPLE()], 3, undefined, [1]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(cpuDecide(a.state, 1)).toEqual({ type: 'choose_target', seat: 1, targetSeat: 1 });
  });
  it('三連は自分の場が3枚以上なら数字枚数最多の相手へ', () => {
    // 座席1: n3,n6,n7 の3枚。座席2: n4,n8,n9 の3枚。座席0: n5,n10,+2 で数字2枚
    const top = [N(3), N(4), N(5), N(6), N(8), N(10), N(7), N(9), ADD(2), TRIPLE()];
    let { state: s, secrets: sec } = start(top, 3, undefined, [1]);
    for (const seat of [1, 2, 0, 1, 2, 0]) ({ state: s, secrets: sec } = applyAction(s, sec, { type: 'hit', seat }, rng(), NOW));
    ({ state: s, secrets: sec } = applyAction(s, sec, { type: 'hit', seat: 1 }, rng(), NOW));
    expect(s.pending?.type).toBe('triple');
    expect(cpuDecide(s, 1)).toEqual({ type: 'choose_target', seat: 1, targetSeat: 2 });
  });
  it('保険譲渡は手札点が最低の相手へ', () => {
    const top = [N(3), N(12), N(5), INSURANCE(0), N(8), N(9), INSURANCE(1)];
    let { state: s, secrets: sec } = start(top, 3, undefined, [1]);
    for (const seat of [1, 2, 0, 1]) ({ state: s, secrets: sec } = applyAction(s, sec, { type: 'hit', seat }, rng(), NOW));
    expect(s.pending?.type).toBe('give_insurance');
    expect(cpuDecide(s, 1)).toEqual({ type: 'choose_target', seat: 1, targetSeat: 0 });
  });
});
