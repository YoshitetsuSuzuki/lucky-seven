import type { Card, Rng } from './cards.ts';
import { buildDeck, shuffle, mulberry32 } from './cards.ts';
import { takeCard } from './draw.ts';
import { scoreCards, uniqueNumberCount } from './score.ts';
import {
  EngineError,
  type Action,
  type PlayerState,
  type PublicState,
  type Secrets,
  type Settings,
} from './types.ts';

export const CPU_DELAY_MS = 1500;
export const MAX_AUTO_STEPS = 2000;

export interface SeatInput {
  seat: number;
  isCpu: boolean;
}

export function startGame(
  seats: SeatInput[],
  settings: Settings,
  rng: Rng,
  now: number,
  luckySeats: number[] = [],
) {
  return startGameWithDeck(seats, settings, shuffle(buildDeck(), rng), now, rng, luckySeats);
}

/** 山札の並びを指定して開始（テスト・再現用） */
export function startGameWithDeck(
  seats: SeatInput[],
  settings: Settings,
  deck: Card[],
  now: number,
  rng: Rng = mulberry32(1),
  luckySeats: number[] = [],
): { state: PublicState; secrets: Secrets } {
  if (seats.length < 2) throw new EngineError('プレイヤーは2人以上必要です');
  if (seats.length > 12) throw new EngineError('プレイヤーは12人までです');
  const players: PlayerState[] = [...seats]
    .sort((a, b) => a.seat - b.seat)
    .map((s) => ({
      seat: s.seat,
      isCpu: s.isCpu,
      status: 'active',
      cards: [],
      hasInsurance: false,
      roundScore: 0,
      totalScore: 0,
    }));
  if (new Set(players.map((p) => p.seat)).size !== players.length) {
    throw new EngineError('座席番号が重複しています');
  }
  const state: PublicState = {
    settings: { ...settings },
    round: 0,
    dealerSeat: players[players.length - 1].seat,
    dealSeat: null,
    turnSeat: null,
    phase: 'round_end',
    pending: null,
    triple: null,
    sevenSeat: null,
    actionQueue: [],
    players,
    discard: [],
    deckCount: deck.length,
    deadline: null,
    autoAt: null,
    events: [],
    winnerSeats: null,
  };
  // 初回配布から効くように、ラッキーモード座席は startRound の前に設定する
  const secrets: Secrets = { deck: [...deck], luckySeats: [...luckySeats] };
  startRound(state, secrets, rng);
  finish(state, now);
  return { state, secrets };
}

export function applyAction(
  state: PublicState,
  secrets: Secrets,
  action: Action,
  rng: Rng,
  now: number,
): { state: PublicState; secrets: Secrets } {
  const s = structuredClone(state);
  const sec = structuredClone(secrets);
  s.events = [];
  switch (action.type) {
    case 'hit': {
      requireTurn(s, action.seat);
      try {
        drawFor(s, sec, action.seat, rng);
      } catch (err) {
        // 山札・捨て札が両方尽きて引けない場合は、行き詰まらないよう自動的に降りる
        if (err instanceof EngineError && err.message === 'カードがありません') {
          s.events.push({ type: 'deck_empty', seat: action.seat });
          stayPlayer(s, action.seat);
          s.events.push({ type: 'stay', seat: action.seat });
          s.turnSeat = nextActiveSeat(s, action.seat);
          break;
        }
        throw err;
      }
      if (s.phase === 'turn') s.turnSeat = nextActiveSeat(s, action.seat);
      break;
    }
    case 'stay': {
      requireTurn(s, action.seat);
      stayPlayer(s, action.seat);
      s.events.push({ type: 'stay', seat: action.seat });
      s.turnSeat = nextActiveSeat(s, action.seat);
      break;
    }
    case 'choose_target':
      chooseTarget(s, action.seat, action.targetSeat);
      break;
    case 'timeout':
      applyTimeout(s);
      break;
    case 'next_round':
      if (s.phase !== 'round_end') throw new EngineError('ラウンド終了時のみ次へ進めます');
      startRound(s, sec, rng);
      break;
  }
  runAuto(s, sec, rng);
  finish(s, now);
  return { state: s, secrets: sec };
}

export type Waiting = { seat: number; kind: 'turn' | 'target' };

/** いま誰の入力を待っているか */
export function waitingOn(state: PublicState): Waiting | null {
  if (state.pending) return { seat: state.pending.bySeat, kind: 'target' };
  if (state.phase === 'turn' && state.turnSeat !== null) return { seat: state.turnSeat, kind: 'turn' };
  return null;
}

/** 対象選択の候補座席 */
export function targetCandidates(state: PublicState): number[] {
  const p = state.pending;
  if (!p) return [];
  return state.players
    .filter((o) => o.status === 'active')
    .filter((o) => (p.type === 'give_insurance' ? o.seat !== p.bySeat && !o.hasInsurance : true))
    .map((o) => o.seat);
}

export function currentScore(p: PlayerState): number {
  return scoreCards(p.cards, false);
}

// ---------- 内部 ----------

function player(s: PublicState, seat: number): PlayerState {
  const p = s.players.find((x) => x.seat === seat);
  if (!p) throw new EngineError(`座席 ${seat} は存在しません`);
  return p;
}

function nextSeat(s: PublicState, from: number): number {
  const seats = s.players.map((p) => p.seat);
  const i = seats.indexOf(from);
  return seats[(i + 1) % seats.length];
}

/** from の次から一周して最初の現役。from 自身も最後に候補。いなければ null */
function nextActiveSeat(s: PublicState, from: number): number | null {
  const seats = s.players.map((p) => p.seat);
  const start = seats.indexOf(from);
  for (let k = 1; k <= seats.length; k++) {
    const seat = seats[(start + k) % seats.length];
    if (player(s, seat).status === 'active') return seat;
  }
  return null;
}

function requireTurn(s: PublicState, seat: number) {
  if (s.phase !== 'turn') throw new EngineError('いまは手番ではありません');
  if (s.pending) throw new EngineError('対象の選択待ちです');
  if (s.triple) throw new EngineError('三連の処理中です');
  if (s.turnSeat !== seat) throw new EngineError('あなたの手番ではありません');
  if (player(s, seat).status !== 'active') throw new EngineError('このラウンドから離脱しています');
}

function stayPlayer(s: PublicState, seat: number) {
  const p = player(s, seat);
  p.status = 'stayed';
  p.roundScore = scoreCards(p.cards, false);
}

function bust(s: PublicState, p: PlayerState, card: Card) {
  p.status = 'busted';
  p.roundScore = 0;
  // 場札は捨てず、重複した2枚目（末尾）を含めてラウンド終了まで表示したまま残す
  p.cards.push(card);
  s.events.push({ type: 'bust', seat: p.seat, card });
  if (s.triple && s.triple.seat === p.seat) s.triple = null;
  const kept: typeof s.actionQueue = [];
  for (const item of s.actionQueue) {
    if (item.seat === p.seat) s.discard.push(item.card);
    else kept.push(item);
  }
  s.actionQueue = kept;
}

function drawFor(s: PublicState, sec: Secrets, seat: number, rng: Rng) {
  const p = player(s, seat);
  const card = takeCard(s, sec, p, rng);
  // 達成済みの座席は三連の残りを引き切る。バーストせず、置けない札は捨て札へ
  const achieved = s.sevenSeat === seat;
  if (card.kind === 'number') {
    if (p.cards.some((c) => c.kind === 'number' && c.value === card.value)) {
      if (achieved) {
        s.discard.push(card);
        s.events.push({ type: 'bonus_discard', seat, card });
      } else if (p.hasInsurance) {
        p.hasInsurance = false;
        s.discard.push(card);
        s.events.push({ type: 'insurance_used', seat, card });
      } else {
        bust(s, p, card);
      }
      return;
    }
    p.cards.push(card);
    s.events.push({ type: 'draw', seat, card });
    if (!achieved && uniqueNumberCount(p.cards) === 7) {
      s.sevenSeat = seat;
      s.events.push({ type: 'seven', seat });
      // 三連の途中なら残りを引き切ってから終了する（runAuto が締める）
      if (!(s.triple && s.triple.seat === seat)) endRound(s);
    }
    return;
  }
  if (card.kind === 'add' || card.kind === 'mul') {
    p.cards.push(card);
    s.events.push({ type: 'draw', seat, card });
    return;
  }
  if (achieved) {
    s.discard.push(card);
    s.events.push({ type: 'bonus_discard', seat, card });
    return;
  }
  s.events.push({ type: 'draw', seat, card });
  if (card.action === 'insurance' && !p.hasInsurance) {
    p.hasInsurance = true;
    s.discard.push(card);
    return;
  }
  s.actionQueue.push({ seat, card });
}

function giveInsurance(s: PublicState, from: number, to: number, card: Card) {
  player(s, to).hasInsurance = true;
  s.discard.push(card);
  s.events.push({ type: 'give_insurance', seat: from, targetSeat: to });
}

function resolveQueued(s: PublicState, item: { seat: number; card: Card }) {
  const p = player(s, item.seat);
  const card = item.card;
  if (card.kind !== 'action' || p.status !== 'active') {
    s.discard.push(card);
    return;
  }
  if (card.action === 'insurance') {
    // 三連中に保険を使い切っていれば、2枚目は自分で保持する
    if (!p.hasInsurance) {
      p.hasInsurance = true;
      s.discard.push(card);
      return;
    }
    const eligible = s.players.filter((o) => o.status === 'active' && o.seat !== p.seat && !o.hasInsurance);
    if (eligible.length === 0) {
      s.discard.push(card);
      return;
    }
    if (eligible.length === 1) {
      giveInsurance(s, p.seat, eligible[0].seat, card);
      return;
    }
    s.pending = { type: 'give_insurance', bySeat: p.seat, card };
    return;
  }
  s.pending = { type: card.action, bySeat: p.seat, card };
}

function chooseTarget(s: PublicState, seat: number, targetSeat: number) {
  const pending = s.pending;
  if (!pending || pending.bySeat !== seat) throw new EngineError('対象選択の権利がありません');
  const t = player(s, targetSeat);
  if (t.status !== 'active') throw new EngineError('その相手は選べません');
  if (pending.type === 'give_insurance') {
    if (targetSeat === seat || t.hasInsurance) throw new EngineError('その相手には渡せません');
    s.pending = null;
    giveInsurance(s, seat, targetSeat, pending.card);
    return;
  }
  s.pending = null;
  s.discard.push(pending.card);
  if (pending.type === 'freeze') {
    stayPlayer(s, targetSeat);
    s.events.push({ type: 'freeze', seat, targetSeat });
  } else {
    s.triple = { seat: targetSeat, remaining: 3 };
    s.events.push({ type: 'triple', seat, targetSeat });
  }
}

function applyTimeout(s: PublicState) {
  const w = waitingOn(s);
  if (!w) throw new EngineError('待機中ではありません');
  s.events.push({ type: 'timeout', seat: w.seat });
  if (w.kind === 'turn') {
    stayPlayer(s, w.seat);
    s.events.push({ type: 'stay', seat: w.seat });
    s.turnSeat = nextActiveSeat(s, w.seat);
    return;
  }
  const candidates = targetCandidates(s);
  const fallbackTarget = candidates.includes(w.seat) ? w.seat : candidates[0];
  if (fallbackTarget === undefined) throw new EngineError('対象候補がいません');
  chooseTarget(s, w.seat, fallbackTarget);
}

function endRound(s: PublicState) {
  for (const p of s.players) {
    if (p.status === 'active') {
      p.status = 'stayed';
      p.roundScore = scoreCards(p.cards, p.seat === s.sevenSeat);
    }
    p.totalScore += p.roundScore;
    // 場札・保険バッジはラウンド終了後も表示したまま残す。捨て札へ移すのは
    // 次ラウンド開始時（startRound）。
  }
  if (s.pending) s.discard.push(s.pending.card);
  for (const item of s.actionQueue) s.discard.push(item.card);
  s.pending = null;
  s.triple = null;
  s.actionQueue = [];
  s.turnSeat = null;
  s.dealSeat = null;
  s.phase = 'round_end';
  s.events.push({ type: 'round_end', round: s.round });

  const { endMode, target } = s.settings;
  const reached =
    endMode === 'points' ? s.players.some((p) => p.totalScore >= target) : s.round >= target;
  if (reached) {
    const max = Math.max(...s.players.map((p) => p.totalScore));
    s.winnerSeats = s.players.filter((p) => p.totalScore === max).map((p) => p.seat);
    s.phase = 'game_end';
    s.events.push({ type: 'game_end', winnerSeats: s.winnerSeats });
  }
}

function startRound(s: PublicState, sec: Secrets, rng: Rng) {
  s.round += 1;
  s.dealerSeat = nextSeat(s, s.dealerSeat);
  for (const p of s.players) {
    // 前ラウンドまで表示したまま残していた場札を、ここでようやく捨て札へ
    s.discard.push(...p.cards);
    p.status = 'active';
    p.cards = [];
    p.hasInsurance = false;
    p.roundScore = 0;
  }
  s.phase = 'dealing';
  s.dealSeat = nextSeat(s, s.dealerSeat);
  s.turnSeat = null;
  s.pending = null;
  s.triple = null;
  s.sevenSeat = null;
  s.actionQueue = [];
  s.winnerSeats = null;
  runAuto(s, sec, rng);
}

/** 入力が必要になるか、ラウンド/ゲームが終わるまで自動で進める */
function runAuto(s: PublicState, sec: Secrets, rng: Rng) {
  for (let guard = 0; guard < MAX_AUTO_STEPS; guard++) {
    if (s.phase === 'round_end' || s.phase === 'game_end') return;
    if (s.pending) return;
    // 三連の途中でラッキーセブンを達成していた場合、引き切った（またはバーストで
    // 三連が消えた）時点でラウンドを締める
    if (s.sevenSeat !== null && s.triple === null) {
      endRound(s);
      continue;
    }
    if (s.triple) {
      const p = player(s, s.triple.seat);
      if (s.triple.remaining > 0 && p.status === 'active') {
        s.triple.remaining -= 1;
        drawFor(s, sec, s.triple.seat, rng);
      } else {
        s.triple = null;
      }
      continue;
    }
    if (s.actionQueue.length > 0) {
      resolveQueued(s, s.actionQueue.shift()!);
      continue;
    }
    if (s.phase === 'dealing') {
      if (s.dealSeat === null) {
        s.phase = 'turn';
        s.turnSeat = nextActiveSeat(s, s.dealerSeat);
        continue;
      }
      const seat = s.dealSeat;
      s.dealSeat = seat === s.dealerSeat ? null : nextSeat(s, seat);
      if (player(s, seat).status === 'active') drawFor(s, sec, seat, rng);
      continue;
    }
    // phase === 'turn'
    if (s.turnSeat === null || player(s, s.turnSeat).status !== 'active') {
      const next = nextActiveSeat(s, s.turnSeat ?? s.dealerSeat);
      if (next === null) {
        endRound(s);
        continue;
      }
      s.turnSeat = next;
    }
    return;
  }
  throw new EngineError('自動進行が停止しませんでした');
}

function finish(s: PublicState, now: number) {
  s.deadline = null;
  s.autoAt = null;
  const w = waitingOn(s);
  if (!w) return;
  if (player(s, w.seat).isCpu) s.autoAt = now + CPU_DELAY_MS;
  else if (s.settings.turnSeconds) s.deadline = now + s.settings.turnSeconds * 1000;
}
