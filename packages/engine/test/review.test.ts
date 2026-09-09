import { describe, it, expect } from 'vitest';
import { applyAction, startGame, startGameWithDeck, waitingOn, targetCandidates } from '../src/game.ts';
import { cpuDecide } from '../src/cpu.ts';
import { mulberry32 } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import type { Action, PublicState, Secrets, Settings } from '../src/types.ts';
import { N, ADD, MUL, FREEZE, TRIPLE, INSURANCE, start, rng, NOW, SETTINGS, craftDeck } from './helpers.ts';

const total = (s: PublicState) =>
  s.deckCount +
  s.discard.length +
  s.players.reduce((n, p) => n + p.cards.length, 0) +
  (s.pending ? 1 : 0) +
  s.actionQueue.length;

describe('レビュー: 保険と三連の相互作用', () => {
  it('三連の1枚目で引いた保険が、その三連の2枚目の重複を即座に守る', () => {
    // 配布: 座席1=n3, 座席0=n5。座席1 が hit → 三連（対象=座席0）
    // 座席0 の三連: 保険 → n5(重複) → n9
    const { state, secrets } = start([N(3), N(5, 0), TRIPLE(), INSURANCE(0), N(5, 1), N(9)], 2);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    // 実装: 保険は即時取得され、2枚目の重複を消費して助かる
    expect(b.state.players[0].status).toBe('active');
    expect(b.state.players[0].hasInsurance).toBe(false);
    expect(b.state.players[0].cards.map((c) => c.id)).toEqual(['n5-0', 'n9-0']);
    expect(total(b.state)).toBe(94);
  });

  it('三連中に保険を使い切った人は、あとから処理される2枚目の保険を自分で保持する', () => {
    // 座席0 の三連: 保険0 → 保険1(2枚目→キュー) → n5重複(保険0を消費)
    const { state, secrets } = start(
      [N(3), N(5, 0), TRIPLE(), INSURANCE(0), INSURANCE(1), N(5, 1)],
      2,
    );
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 0 }, rng(), NOW);
    expect(b.state.players[0].status).toBe('active');
    // 座席0 は保険を使い切って0枚なので、2枚目は自分が持つ
    expect(b.state.players[0].hasInsurance).toBe(true);
    expect(b.state.players[1].hasInsurance).toBe(false);
    expect(total(b.state)).toBe(94);
  });
});

describe('レビュー: 配布中の氷結', () => {
  it('まだ配られていない人を凍らせると、そのラウンドは0枚0点で確定', () => {
    // 3人。配布順は 1,2,0。座席1 に氷結が来る
    const { state, secrets } = start([FREEZE(), N(4), N(5)], 3);
    expect(state.phase).toBe('dealing');
    expect(state.pending?.bySeat).toBe(1);
    const a = applyAction(state, secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW);
    expect(a.state.players[2].status).toBe('stayed');
    expect(a.state.players[2].cards).toEqual([]);
    expect(a.state.players[2].roundScore).toBe(0);
    // 座席2 は配布をスキップされ、その分カードが後ろにずれる
    expect(a.state.players[1].cards).toEqual([]); // 氷結カードは捨て札
    expect(a.state.players[0].cards.map((c) => c.id)).toEqual(['n4-0']);
    expect(a.state.deckCount).toBe(94 - 2);
    expect(total(a.state)).toBe(94);
  });
});

describe('レビュー: 対象選択の時間切れ', () => {
  it('保険譲渡の時間切れは最初の該当者へ', () => {
    const { state, secrets } = start([N(3), N(4), N(5), INSURANCE(0), N(8), N(9), INSURANCE(1)], 3);
    let s = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    s = applyAction(s.state, s.secrets, { type: 'hit', seat: 2 }, rng(), NOW);
    s = applyAction(s.state, s.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    s = applyAction(s.state, s.secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(s.state.pending?.type).toBe('give_insurance');
    expect(targetCandidates(s.state)).toEqual([0, 2]);
    const t = applyAction(s.state, s.secrets, { type: 'timeout' }, rng(), NOW);
    expect(t.state.players[0].hasInsurance).toBe(true);
  });
});

describe('レビュー: 一人だけ現役', () => {
  it('最後の一人は連続で引ける（手番が自分に戻る）', () => {
    const { state, secrets } = start([N(3), N(5), N(6), N(7), N(8)], 2);
    let s = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    expect(s.state.turnSeat).toBe(0);
    s = applyAction(s.state, s.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    expect(s.state.turnSeat).toBe(0);
    s = applyAction(s.state, s.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    expect(s.state.turnSeat).toBe(0);
    expect(s.state.players[0].cards.map((c) => c.id)).toEqual(['n5-0', 'n6-0', 'n7-0']);
  });
});

describe('レビュー: 氷結が次の手番の人に当たる', () => {
  it('次の手番予定の人を凍らせるとその次へ回る', () => {
    // 3人。配布 1,2,0。座席1 hit → 氷結 → 座席2（＝次の手番）を凍らせる
    const { state, secrets } = start([N(3), N(4), N(5), FREEZE()], 3);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(a.state.turnSeat).toBe(2);
    const b = applyAction(a.state, a.secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW);
    expect(b.state.players[2].status).toBe('stayed');
    expect(b.state.turnSeat).toBe(0);
  });
});

describe('レビュー: ランダム全消化ファズ', () => {
  it('多数のランダム対局で不変条件が壊れない', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = mulberry32(seed);
      const n = 2 + Math.floor(r() * 11); // 2..12
      const seats = Array.from({ length: n }, (_, i) => ({ seat: i, isCpu: true }));
      const settings: Settings = { turnSeconds: 20, endMode: 'rounds', target: 5 };
      let { state, secrets } = startGame(seats, settings, r, NOW);
      // ラッキーモードを一部座席に付与
      secrets.luckySeats = seats.filter(() => r() < 0.3).map((s) => s.seat);
      let steps = 0;
      const check = (s: PublicState, sec: Secrets, ctx: string) => {
        expect(total(s), `${ctx} seed=${seed} 保存則`).toBe(94);
        expect(s.deckCount, `${ctx} seed=${seed} deckCount`).toBe(sec.deck.length);
        for (const p of s.players) {
          const nums = p.cards
            .filter((c): c is Extract<Card, { kind: 'number' }> => c.kind === 'number')
            .map((c) => c.value);
          expect(new Set(nums).size, `${ctx} seed=${seed} 重複数字 seat=${p.seat}`).toBe(nums.length);
          expect(nums.length, `${ctx} seed=${seed} 7種超え seat=${p.seat}`).toBeLessThanOrEqual(7);
        }
        if (s.phase === 'turn' && !s.pending) {
          expect(s.turnSeat, `${ctx} seed=${seed} turnSeat`).not.toBeNull();
          expect(s.players.find((p) => p.seat === s.turnSeat)!.status).toBe('active');
        }
        expect(s.triple, `${ctx} seed=${seed} triple 残留`).toBeNull();
        if (s.phase !== 'round_end' && s.phase !== 'game_end') {
          expect(waitingOn(s), `${ctx} seed=${seed} 停止`).not.toBeNull();
        }
        // deadline / autoAt
        const w = waitingOn(s);
        if (w === null) {
          expect(s.deadline).toBeNull();
          expect(s.autoAt).toBeNull();
        } else if (s.players.find((p) => p.seat === w.seat)!.isCpu) {
          expect(s.autoAt).toBe(NOW + 1500);
          expect(s.deadline).toBeNull();
        }
      };
      check(state, secrets, 'init');
      while (state.phase !== 'game_end' && steps++ < 5000) {
        let action: Action;
        if (state.phase === 'round_end') action = { type: 'next_round' };
        else {
          const w = waitingOn(state)!;
          const roll = r();
          if (roll < 0.1) action = { type: 'timeout' };
          else action = cpuDecide(state, w.seat);
        }
        ({ state, secrets } = applyAction(state, secrets, action, r, NOW));
        check(state, secrets, `step${steps}`);
      }
      expect(state.phase, `seed=${seed} 終局`).toBe('game_end');
      expect(state.winnerSeats).not.toBeNull();
      const max = Math.max(...state.players.map((p) => p.totalScore));
      expect(state.winnerSeats!.sort()).toEqual(
        state.players.filter((p) => p.totalScore === max).map((p) => p.seat),
      );
    }
  });
});

describe('レビュー: 山札切れ', () => {
  it('12人が引き続けても保存則と再構成が保たれる', () => {
    // 12人。座席 i に数字 i (i=0..11) を配布し、直後に同じ数字をもう1枚ずつ
    // 11枚積んで座席0〜10を即バーストさせる（山札はこれで使い切る）。
    // 生き残った座席11は捨て札からの再構成（シャッフル）を経由して引き続ける。
    const seats = Array.from({ length: 12 }, (_, i) => ({ seat: i, isCpu: false }));
    const deck: Card[] = [
      ...Array.from({ length: 12 }, (_, v) => N(v, 0)),
      ...Array.from({ length: 11 }, (_, v) => N(v, 1)),
    ];
    let { state, secrets } = startGameWithDeck(seats, SETTINGS, deck, NOW);
    const totalOf = (s: PublicState) =>
      s.deckCount +
      s.discard.length +
      s.players.reduce((n, p) => n + p.cards.length, 0) +
      (s.pending ? 1 : 0) +
      s.actionQueue.length;
    let steps = 0;
    let sawZero = false;
    let reshuffled = false;
    while (state.phase === 'turn' && steps++ < 3000) {
      const w = waitingOn(state)!;
      const action: Action =
        w.kind === 'target'
          ? { type: 'choose_target', seat: w.seat, targetSeat: targetCandidates(state)[0] }
          : { type: 'hit', seat: w.seat };
      const next = applyAction(state, secrets, action, mulberry32(steps), NOW);
      state = next.state;
      secrets = next.secrets;
      if (state.deckCount === 0) sawZero = true;
      else if (sawZero && state.deckCount > 0) reshuffled = true;
      expect(totalOf(state)).toBe(deck.length);
    }
    expect(steps).toBeLessThan(3000);
    expect(sawZero, '途中で deckCount === 0 を観測すること').toBe(true);
    expect(reshuffled, 'deckCount === 0 の後に再構成で増えること').toBe(true);
  });
});

describe('レビュー: 得点と達成の細部', () => {
  it('×2 のみで数字なしは 0、修飾だけなら加算される', () => {
    const { state, secrets } = start([N(3), ADD(10), MUL, N(9)], 2);
    // 座席1=n3, 座席0=+10。座席1 hit → MUL … ではなく順番確認
    let s = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 座席1 が MUL
    s = applyAction(s.state, s.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    s = applyAction(s.state, s.secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    expect(s.state.players[1].roundScore).toBe(3 * 2);
    expect(s.state.players[0].roundScore).toBe(10);
  });

  it('三連の中で7種達成すると即座に全員終了し、残りは引かない', () => {
    // 座席0 に n1..n4 を積んでから三連で n5,n6,n7 を引かせる
    // ここでは単純に「7種目で round_end」だけを確認する別ルートを使う
    const deck = craftDeck([N(1), N(0), N(2), N(12), N(3), N(11), N(4), N(10), N(5), N(9), N(6), N(8), TRIPLE(), N(7), N(12, 1), N(11, 1)]);
    let { state, secrets } = startGameWithDeck(
      [{ seat: 0, isCpu: false }, { seat: 1, isCpu: false }],
      SETTINGS,
      deck,
      NOW,
    );
    for (let i = 0; i < 5; i++) {
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW));
    }
    // 座席1 は n1..n6 の6種。次の hit で三連を引く
    expect(state.players[1].cards.filter((c) => c.kind === 'number')).toHaveLength(6);
    ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
    expect(state.pending?.type).toBe('triple');
    ({ state, secrets } = applyAction(state, secrets, { type: 'choose_target', seat: 1, targetSeat: 1 }, rng(), NOW));
    // 1枚目 n7 で7種達成 → 残り2枚は引かない
    expect(state.phase).toBe('round_end');
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 15);
    expect(state.triple).toBeNull();
    expect(state.actionQueue).toEqual([]);
    expect(total(state)).toBe(94);
  });
});

describe('レビュー: 保留中の turnSeat', () => {
  it('対象選択中なのに turnSeat は既に次の人を指している', () => {
    const { state, secrets } = start([N(3), N(4), N(5), FREEZE()], 3);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(a.state.pending?.bySeat).toBe(1);
    expect(a.state.turnSeat).toBe(2); // 選択者は 1 なのに turnSeat は 2
    expect(waitingOn(a.state)).toEqual({ seat: 1, kind: 'target' });
  });
});
