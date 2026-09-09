import type { Card, Rng } from './cards.ts';
import { shuffle } from './cards.ts';
import { numberValues } from './score.ts';
import { EngineError, type PlayerState, type PublicState, type Secrets } from './types.ts';

/** 山札から1枚取る。空なら捨て札を切り直す。ラッキーモード対象なら重複数字を飛ばす。 */
export function takeCard(state: PublicState, secrets: Secrets, player: PlayerState, rng: Rng): Card {
  if (secrets.deck.length === 0) {
    if (state.discard.length === 0) throw new EngineError('カードがありません');
    secrets.deck = shuffle(state.discard, rng);
    state.discard = [];
  }
  let index = 0;
  if (secrets.luckySeats.includes(player.seat)) {
    const mine = numberValues(player.cards);
    const safe = secrets.deck.findIndex((c) => !(c.kind === 'number' && mine.has(c.value)));
    if (safe > 0) index = safe;
  }
  const card = secrets.deck[index];
  const skipped = secrets.deck.slice(0, index);
  secrets.deck = secrets.deck.slice(index + 1).concat(skipped);
  state.deckCount = secrets.deck.length;
  return card;
}
