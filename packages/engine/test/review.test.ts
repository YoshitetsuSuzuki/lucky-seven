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
          if (p.status === 'busted' && nums.length > 0) {
            // バースト後は場札を保持したままにするため、末尾（バースト要因）だけ既出の数字と重複してよい
            // （ラウンド終了で捨て札へ移ると nums は空になり、この分岐は対象外）
            expect(nums.length - new Set(nums).size, `${ctx} seed=${seed} 重複数字 seat=${p.seat}`).toBe(1);
            expect(nums.slice(0, -1), `${ctx} seed=${seed} 重複位置 seat=${p.seat}`).toContain(
              nums[nums.length - 1],
            );
          } else {
            expect(new Set(nums).size, `${ctx} seed=${seed} 重複数字 seat=${p.seat}`).toBe(nums.length);
          }
          // 達成者だけは三連の残りで 8種目以降を持ちうる（達成後は捨てずに場へ加える）
          const cap = s.sevenSeat === p.seat ? 13 : 7;
          expect(nums.length, `${ctx} seed=${seed} 7種超え seat=${p.seat}`).toBeLessThanOrEqual(cap);
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
  it('手札は次ラウンド開始まで捨て札に移らないため、山札切れは次ラウンドの配布で再構成される', () => {
    // 12人。初期親は座席11だが、開始時に親が1つ進むため round1 の親は座席0、
    // 配布は座席1から座席0(親)の順（座席 s は数字 (s-1) mod 12 を受け取る）。
    // 続けて同じ数字をもう1枚ずつ11枚積んで座席1〜11を順に即バーストさせる
    // （山札はこれで使い切る）。バースト後も、また降りた後も、場札は次ラウンド
    // 開始まで手札に残る新ルールのため、山札・捨て札ともに尽きて、生き残った
    // 座席0 は引こうとしても自動的に降りるしかない。ラウンド終了しても場札は
    // まだ捨て札へ移らず、次ラウンドの配布で山札切れ→捨て札からの再構成
    // （シャッフル）を経由する。
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
    expect(totalOf(state)).toBe(deck.length);
    expect(state.phase).toBe('turn');
    expect(state.turnSeat).toBe(1);

    for (let seat = 1; seat <= 11; seat++) {
      const next = applyAction(state, secrets, { type: 'hit', seat }, mulberry32(seat), NOW);
      state = next.state;
      secrets = next.secrets;
      expect(state.players[seat].status).toBe('busted');
      expect(totalOf(state)).toBe(deck.length);
    }
    // 座席0 だけが現役。山札も捨て札も尽きている（バースト後の場札は手札のまま）
    expect(state.deckCount).toBe(0);
    expect(state.discard).toEqual([]);
    expect(state.turnSeat).toBe(0);

    // 座席0 は引こうとしても山札・捨て札が尽きているため自動的に降りる
    let r = applyAction(state, secrets, { type: 'hit', seat: 0 }, mulberry32(0), NOW);
    state = r.state;
    secrets = r.secrets;
    expect(state.events).toContainEqual({ type: 'deck_empty', seat: 0 });
    expect(state.events).toContainEqual({ type: 'stay', seat: 0 });
    expect(state.players[0].status).toBe('stayed');
    // それが最後の現役プレイヤーだったため、そのままラウンド終了。場札が捨て札へ移るのは次ラウンド開始時
    expect(state.phase).toBe('round_end');
    expect(state.discard).toEqual([]);
    expect(totalOf(state)).toBe(deck.length);

    // 次ラウンドの配布で山札切れ→捨て札からの再構成（シャッフル）が起こる
    r = applyAction(state, secrets, { type: 'next_round' }, mulberry32(13), NOW);
    state = r.state;
    secrets = r.secrets;
    expect(totalOf(state)).toBe(deck.length);
    expect(state.phase).toBe('turn');
    expect(state.deckCount).toBe(deck.length - 12); // 再構成後、12人への配布で消費した残り
    expect(secrets.deck.length).toBe(state.deckCount);
  });

  it('山札・捨て札が両方尽きた状態で hit すると、行き詰まらず自動的に降りる', () => {
    // 2人、山札はたった4枚: 配布で座席1→n1, 座席0→n2 の2枚を消費し、残り2枚。
    // 続けて座席1, 座席0 がそれぞれ1回ずつ hit して残り2枚も引き切ると、
    // 山札・捨て札とも空になる。この状態で次に hit した人は自動的に降りる。
    const seats = [
      { seat: 0, isCpu: false },
      { seat: 1, isCpu: false },
    ];
    const deck: Card[] = [N(1), N(2), N(3), N(4)];
    let { state, secrets } = startGameWithDeck(seats, SETTINGS, deck, NOW);
    expect(total(state)).toBe(4);
    expect(state.phase).toBe('turn');
    expect(state.turnSeat).toBe(1);
    expect(state.deckCount).toBe(2);

    let r = applyAction(state, secrets, { type: 'hit', seat: 1 }, mulberry32(1), NOW); // n3
    state = r.state;
    secrets = r.secrets;
    expect(state.turnSeat).toBe(0);
    expect(state.deckCount).toBe(1);

    r = applyAction(state, secrets, { type: 'hit', seat: 0 }, mulberry32(2), NOW); // n4
    state = r.state;
    secrets = r.secrets;
    expect(state.turnSeat).toBe(1);
    expect(state.deckCount).toBe(0);
    expect(state.discard).toEqual([]);
    expect(total(state)).toBe(4);

    // 山札も捨て札も空。ここで座席1 が hit すると、投げ出さず自動的に降りる
    r = applyAction(state, secrets, { type: 'hit', seat: 1 }, mulberry32(3), NOW);
    state = r.state;
    secrets = r.secrets;
    expect(state.events).toContainEqual({ type: 'deck_empty', seat: 1 });
    expect(state.events).toContainEqual({ type: 'stay', seat: 1 });
    expect(state.players[1].status).toBe('stayed');
    // 座席0 はまだ現役なので、ラウンドは続く
    expect(state.phase).toBe('turn');
    expect(state.turnSeat).toBe(0);
    expect(total(state)).toBe(4);
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

  it('三連の中で7種達成しても、残り2枚を引き切ってから全員終了する', () => {
    // 座席1 に n1..n6 を積んでから三連で n7(7種目), n12, n11 を引かせる
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
    // 1枚目 n7 で7種達成 → 残り2枚(n12, n11)も引き切ってから終了
    expect(state.phase).toBe('round_end');
    expect(state.sevenSeat).toBe(1);
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 12 + 11 + 15);
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
