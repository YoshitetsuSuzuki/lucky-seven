import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game.ts';
import { N, TRIPLE, start, rng, NOW } from './helpers.ts';

// 配布順は 座席1 → 座席0(親)。
// 座席1 が n5、座席0 が三連を引き、対象に座席1 を指定 → 座席1 が 3 枚連続で引く。
// 続く山札は n5, n5 なので、ラッキーモードでなければ重複で撃沈する。
const TOP = [N(5, 0), TRIPLE(), N(5, 1), N(5, 2), N(9), N(10)];

describe('開始時のラッキーモード座席', () => {
  it('初回配布中に決着する三連でも、ラッキー座席は重複数字を飛ばす', () => {
    const { state, secrets } = start(TOP, 2, undefined, [], [1]);
    expect(secrets.luckySeats).toEqual([1]);
    // 配布中に三連が出て、座席0 の対象選択待ちで止まっている
    expect(state.phase).toBe('dealing');
    expect(state.pending).toEqual({ type: 'triple', bySeat: 0, card: TRIPLE() });

    const a = applyAction(state, secrets, { type: 'choose_target', seat: 0, targetSeat: 1 }, rng(), NOW);
    const p1 = a.state.players[1];
    expect(p1.status).toBe('active');
    // n5 + 三連の3枚（重複の n5 は飛ばされる）
    expect(p1.cards.map((c) => (c.kind === 'number' ? c.value : c.kind))).toEqual([5, 9, 10, 0]);
  });

  it('ラッキー座席でなければ同じ配置で重複を引いて撃沈する', () => {
    const { state, secrets } = start(TOP, 2);
    expect(secrets.luckySeats).toEqual([]);
    const a = applyAction(state, secrets, { type: 'choose_target', seat: 0, targetSeat: 1 }, rng(), NOW);
    expect(a.state.players[1].status).toBe('busted');
    expect(a.state.events.some((e) => e.type === 'bust' && e.seat === 1)).toBe(true);
  });
});
