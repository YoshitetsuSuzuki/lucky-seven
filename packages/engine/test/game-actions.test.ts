import { describe, it, expect } from 'vitest';
import { applyAction, targetCandidates, waitingOn } from '../src/game.ts';
import { N, FREEZE, TRIPLE, INSURANCE, start, rng, NOW } from './helpers.ts';
import { EngineError } from '../src/types.ts';

describe('氷結', () => {
  it('引いた人が対象を選ぶまで止まる。対象は即降り', () => {
    // 3人: 配布 座席1=n3, 座席2=n4, 座席0=n5。座席1が hit で氷結
    const { state, secrets } = start([N(3), N(4), N(5), FREEZE()], 3);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(a.state.pending).toEqual({ type: 'freeze', bySeat: 1, card: FREEZE() });
    expect(waitingOn(a.state)).toEqual({ seat: 1, kind: 'target' });
    expect(targetCandidates(a.state)).toEqual([0, 1, 2]);
    expect(a.state.deadline).toBe(NOW + 20_000);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW);
    expect(b.state.players[2].status).toBe('stayed');
    expect(b.state.players[2].roundScore).toBe(4);
    expect(b.state.pending).toBeNull();
    expect(b.state.turnSeat).toBe(0);
    expect(b.state.discard).toContainEqual(FREEZE());
  });
  it('配布中に氷結が出たら配布が止まり、選択後に再開', () => {
    // 座席1に氷結、続いて座席2=n4, 座席0=n5
    const { state } = start([FREEZE(), N(4), N(5)], 3);
    expect(state.phase).toBe('dealing');
    expect(state.pending?.bySeat).toBe(1);
  });
  it('自分を対象にできる', () => {
    const { state, secrets } = start([N(3), N(5), FREEZE()]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 1 }, rng(), NOW);
    expect(b.state.players[1].status).toBe('stayed');
    expect(b.state.turnSeat).toBe(0);
  });
  it('選択権のない人が選ぶと例外', () => {
    const { state, secrets } = start([N(3), N(5), FREEZE()]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(() => applyAction(a.state, a.secrets, { type: 'choose_target', seat: 0, targetSeat: 1 }, rng(), NOW)).toThrow(EngineError);
  });
});

describe('三連', () => {
  it('対象は3枚続けて引く', () => {
    const { state, secrets } = start([N(3), N(5), TRIPLE(), N(7), N(8), N(9)]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    expect(b.state.players[0].cards.map((c) => c.id)).toEqual(['n5-0', 'n7-0', 'n8-0', 'n9-0']);
    expect(b.state.triple).toBeNull();
    expect(b.state.turnSeat).toBe(0);
  });
  it('途中でバーストしたら残りは引かない', () => {
    const { state, secrets } = start([N(3), N(5, 0), TRIPLE(), N(5, 1), N(8), N(9)]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    expect(b.state.players[0].status).toBe('busted');
    expect(b.state.deckCount).toBe(94 - 4);
    expect(b.state.phase).toBe('turn');
    expect(b.state.turnSeat).toBe(1);
  });
  it('三連中に引いたアクションは3枚引いた後に処理', () => {
    const { state, secrets } = start([N(3), N(4), N(5), TRIPLE(), FREEZE(), N(8), N(9)], 3);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW);
    // 座席2 は n8, n9 を受け取ってから氷結の対象を選ぶ
    expect(b.state.players[2].cards.map((c) => c.id)).toEqual(['n4-0', 'n8-0', 'n9-0']);
    expect(b.state.pending).toEqual({ type: 'freeze', bySeat: 2, card: FREEZE() });
  });
  it('三連中にバーストしたら引いたアクションは捨てられる', () => {
    const { state, secrets } = start([N(3), N(5, 0), TRIPLE(), FREEZE(), N(5, 1)], 2);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    expect(b.state.players[0].status).toBe('busted');
    expect(b.state.pending).toBeNull();
    expect(b.state.discard).toContainEqual(FREEZE());
  });
  it('三連の中の三連（入れ子）', () => {
    const { state, secrets } = start([N(3), N(5), TRIPLE(0), TRIPLE(1), N(8), N(9), N(10), N(11), N(12)], 2);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    expect(b.state.pending).toEqual({ type: 'triple', bySeat: 0, card: TRIPLE(1) });
    const c = applyAction(b.state, b.secrets, { type: 'choose_target', seat: 0, targetSeat: 1 }, rng(), NOW);
    expect(c.state.players[1].cards.map((x) => x.id)).toEqual(['n3-0', 'n10-0', 'n11-0', 'n12-0']);
  });
});

describe('保険の譲渡', () => {
  it('2枚目は持っていない現役へ。候補が1人なら自動', () => {
    const { state, secrets } = start([N(3), N(5), INSURANCE(0), N(8), INSURANCE(1)], 2);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 保険1
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW); // n8
    const c = applyAction(b.state, b.secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 保険2 → 座席0へ自動
    expect(c.state.players[0].hasInsurance).toBe(true);
    expect(c.state.pending).toBeNull();
    expect(c.state.events).toContainEqual({ type: 'give_insurance', seat: 1, targetSeat: 0 });
  });
  it('候補が複数なら選ぶ', () => {
    const { state, secrets } = start([N(3), N(4), N(5), INSURANCE(0), N(8), N(9), INSURANCE(1)], 3);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 2 }, rng(), NOW);
    const c = applyAction(b.state, b.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    const d = applyAction(c.state, c.secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(d.state.pending?.type).toBe('give_insurance');
    expect(targetCandidates(d.state)).toEqual([0, 2]);
    expect(() => applyAction(d.state, d.secrets, { type: 'choose_target', seat: 1, targetSeat: 1 }, rng(), NOW)).toThrow(EngineError);
    const e = applyAction(d.state, d.secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW);
    expect(e.state.players[2].hasInsurance).toBe(true);
  });
  it('候補がいなければ捨て札', () => {
    const { state, secrets } = start([N(3), N(5), INSURANCE(0), INSURANCE(1), INSURANCE(2)], 2);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    const c = applyAction(b.state, b.secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(c.state.pending).toBeNull();
    expect(c.state.discard.filter((x) => x.kind === 'action')).toHaveLength(3);
  });
});
