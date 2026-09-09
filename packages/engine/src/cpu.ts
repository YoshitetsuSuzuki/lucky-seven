import { copiesOf } from './cards.ts';
import { currentScore, targetCandidates, waitingOn } from './game.ts';
import { numberValues, uniqueNumberCount } from './score.ts';
import { EngineError, type Action, type PlayerState, type PublicState } from './types.ts';

/** 公開情報から「次の1枚で seat がバーストする確率」を推定 */
export function bustProbability(state: PublicState, seat: number): number {
  const me = state.players.find((p) => p.seat === seat);
  if (!me) throw new EngineError(`座席 ${seat} は存在しません`);
  const mine = numberValues(me.cards);
  if (mine.size === 0) return 0;
  const seen = new Map<number, number>();
  const bump = (v: number) => seen.set(v, (seen.get(v) ?? 0) + 1);
  for (const p of state.players) for (const c of p.cards) if (c.kind === 'number') bump(c.value);
  for (const c of state.discard) if (c.kind === 'number') bump(c.value);
  const unseenTotal = state.deckCount > 0 ? state.deckCount : state.discard.length;
  if (unseenTotal === 0) return 0;
  let bad = 0;
  for (const v of mine) {
    if (state.deckCount > 0) bad += Math.max(0, copiesOf(v) - (seen.get(v) ?? 0));
    else bad += state.discard.filter((c) => c.kind === 'number' && c.value === v).length;
  }
  return bad / unseenTotal;
}

function numberCount(p: PlayerState): number {
  return p.cards.filter((c) => c.kind === 'number').length;
}

/** 引く/降りるの閾値調整。p(バースト確率) < 閾値 なら引く */
const HIT_THRESHOLDS = {
  base: 0.3, // 手札点 < 20
  score20: 0.22, // 手札点 >= 20
  score30: 0.14, // 手札点 >= 30
  score40: 0.06, // 手札点 >= 40
  sixUniqueBonus: 0.2, // 数字6種で達成狙い
  behindBy: 40, // 首位にこれ以上離されていたら
  behindBonus: 0.1, //   粘る
  insuranceBonus: 0.35, // 保険持ち
} as const;

export function cpuDecide(state: PublicState, seat: number): Action {
  const w = waitingOn(state);
  if (!w || w.seat !== seat) throw new EngineError('CPU の入力待ちではありません');
  const me = state.players.find((p) => p.seat === seat)!;

  if (w.kind === 'target') {
    const pending = state.pending!;
    const candidates = targetCandidates(state);
    const others = candidates.filter((s) => s !== seat).map((s) => state.players.find((p) => p.seat === s)!);
    let target = seat;
    if (pending.type === 'freeze') {
      const best = others.reduce<PlayerState | null>((a, b) => (a && currentScore(a) >= currentScore(b) ? a : b), null);
      target = best && currentScore(best) > currentScore(me) ? best.seat : seat;
    } else if (pending.type === 'triple') {
      if (numberCount(me) <= 2 || others.length === 0) target = seat;
      else target = others.reduce((a, b) => (numberCount(a) >= numberCount(b) ? a : b)).seat;
    } else {
      if (others.length === 0) throw new EngineError('対象候補がいません');
      target = others.reduce((a, b) => (currentScore(a) <= currentScore(b) ? a : b)).seat;
    }
    return { type: 'choose_target', seat, targetSeat: target };
  }

  const uniq = uniqueNumberCount(me.cards);
  if (uniq === 0) return { type: 'hit', seat };
  const p = bustProbability(state, seat);
  const rs = currentScore(me);
  let t: number = HIT_THRESHOLDS.base;
  if (rs >= 20) t = HIT_THRESHOLDS.score20;
  if (rs >= 30) t = HIT_THRESHOLDS.score30;
  if (rs >= 40) t = HIT_THRESHOLDS.score40;
  if (uniq === 6) t += HIT_THRESHOLDS.sixUniqueBonus;
  const leader = Math.max(0, ...state.players.filter((o) => o.seat !== seat).map((o) => o.totalScore));
  if (me.totalScore + rs < leader - HIT_THRESHOLDS.behindBy) t += HIT_THRESHOLDS.behindBonus;
  if (me.hasInsurance) t += HIT_THRESHOLDS.insuranceBonus;
  return p < t ? { type: 'hit', seat } : { type: 'stay', seat };
}
