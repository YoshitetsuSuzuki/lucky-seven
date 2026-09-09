export type ActionKind = 'freeze' | 'triple' | 'insurance';

export type Card =
  | { id: string; kind: 'number'; value: number }
  | { id: string; kind: 'action'; action: ActionKind }
  | { id: string; kind: 'add'; value: number }
  | { id: string; kind: 'mul' };

export const DECK_SIZE = 94;

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let v = 0; v <= 12; v++) {
    const copies = v === 0 ? 1 : v;
    for (let i = 0; i < copies; i++) deck.push({ id: `n${v}-${i}`, kind: 'number', value: v });
  }
  for (const action of ['freeze', 'triple', 'insurance'] as const) {
    for (let i = 0; i < 3; i++) deck.push({ id: `a-${action}-${i}`, kind: 'action', action });
  }
  for (const v of [2, 4, 6, 8, 10]) deck.push({ id: `m-add-${v}`, kind: 'add', value: v });
  deck.push({ id: 'm-mul', kind: 'mul' });
  return deck;
}

/** 数字 v のカードが山札全体に何枚あるか */
export function copiesOf(value: number): number {
  return value === 0 ? 1 : value;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRng(): Rng {
  return () => Math.random();
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
