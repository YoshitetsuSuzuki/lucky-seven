import type { Card, ActionKind } from './cards.ts';

export type PlayerStatus = 'active' | 'stayed' | 'busted';

export interface PlayerState {
  seat: number;
  isCpu: boolean;
  status: PlayerStatus;
  /** 場札（数字・修飾）。保険は hasInsurance で持ち、カード自体は捨て札へ */
  cards: Card[];
  hasInsurance: boolean;
  roundScore: number;
  totalScore: number;
}

export type TurnSeconds = 20 | 60 | null;
export type EndMode = 'points' | 'rounds';

export interface Settings {
  turnSeconds: TurnSeconds;
  endMode: EndMode;
  /** points: 100|200|300, rounds: 3|5|10 */
  target: number;
}

export type Phase = 'dealing' | 'turn' | 'round_end' | 'game_end';

export type PendingType = Exclude<ActionKind, 'insurance'> | 'give_insurance';

export interface Pending {
  type: PendingType;
  /** 対象を選ぶ人 */
  bySeat: number;
  card: Card;
}

export interface Triple {
  seat: number;
  remaining: number;
}

export type GameEvent =
  | { type: 'draw'; seat: number; card: Card }
  | { type: 'bust'; seat: number; card: Card }
  /** ラッキーセブン達成後の三連で引いた、場に加えられないカード（重複数字・アクション） */
  | { type: 'bonus_discard'; seat: number; card: Card }
  | { type: 'insurance_used'; seat: number; card: Card }
  | { type: 'stay'; seat: number }
  | { type: 'freeze'; seat: number; targetSeat: number }
  | { type: 'triple'; seat: number; targetSeat: number }
  | { type: 'give_insurance'; seat: number; targetSeat: number }
  | { type: 'seven'; seat: number }
  | { type: 'round_end'; round: number }
  | { type: 'game_end'; winnerSeats: number[] }
  | { type: 'timeout'; seat: number }
  /** 山札・捨て札が両方尽きて引けず、自動的に降りた */
  | { type: 'deck_empty'; seat: number };

export interface PublicState {
  settings: Settings;
  round: number;
  dealerSeat: number;
  /** 配布中: 次に配る座席。配布完了で null */
  dealSeat: number | null;
  turnSeat: number | null;
  phase: Phase;
  pending: Pending | null;
  triple: Triple | null;
  /** ラッキーセブンを達成した座席。未達成は null。ラウンド終了後も表示用に残る */
  sevenSeat: number | null;
  /** 三連中に引いたアクション、または保険2枚目の譲渡待ち */
  actionQueue: { seat: number; card: Card }[];
  /** 座席順 */
  players: PlayerState[];
  discard: Card[];
  deckCount: number;
  /** 人間の手番締切 (epoch ms) */
  deadline: number | null;
  /** CPU の自動行動時刻 (epoch ms) */
  autoAt: number | null;
  /** 直近の applyAction で起きたイベント（演出用） */
  events: GameEvent[];
  winnerSeats: number[] | null;
}

export interface Secrets {
  deck: Card[];
  luckySeats: number[];
}

export type Action =
  | { type: 'hit'; seat: number }
  | { type: 'stay'; seat: number }
  | { type: 'choose_target'; seat: number; targetSeat: number }
  | { type: 'timeout' }
  | { type: 'next_round' };

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
