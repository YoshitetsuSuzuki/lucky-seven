# ラッキーセブン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip 7 と同一ルールのオンラインカードゲーム「ラッキーセブン」を、Supabase 判定サーバー方式・最大12人・CPU対戦・隠しラッキーモード付きの Web アプリとして動く状態にする。

**Architecture:** 純粋 TypeScript のゲームエンジン `packages/engine`（状態＋操作→新状態）を、Supabase Edge Function `act`（唯一の書き込み入口）と Vite+React クライアントで共用する。山札順とラッキーフラグは `room_secrets` に隔離し、公開状態は `rooms.state` に置いて Realtime で配信する。CPU と時間切れは `tick` 操作で駆動する。

**Tech Stack:** npm workspaces / TypeScript 5 / Vitest / Vite 5 + React 18 + Tailwind 3 + react-router 6 (HashRouter) / Supabase (Postgres, Realtime, Edge Functions on Deno) / vite-plugin-pwa

**設計書:** `docs/superpowers/specs/2026-09-10-lucky-seven-design.md`

---

## ファイル構成

```
package.json                      npm workspaces ルート
tsconfig.base.json
packages/engine/
  package.json  tsconfig.json  vitest.config.ts
  src/cards.ts      カード型・山札生成・乱数・シャッフル
  src/types.ts      状態・操作・イベント型
  src/score.ts      得点計算
  src/draw.ts       山札から1枚取る（再構成・ラッキーモード）
  src/game.ts       開始・操作適用・自動進行・待機判定
  src/cpu.ts        CPU 判断
  src/index.ts      re-export
  test/*.test.ts
supabase/
  config.toml
  migrations/20260910000000_init.sql
  functions/act/index.ts          Edge Function 本体
  functions/act/api.ts            ルーム/プレイヤー操作（DB 入出力）
  functions/_shared/engine/       ← scripts/sync-engine.sh が packages/engine/src をコピー
scripts/sync-engine.sh
apps/web/
  package.json  vite.config.ts  tailwind.config.js  postcss.config.js  index.html  tsconfig.json
  src/main.tsx  src/App.tsx  src/index.css
  src/lib/supabase.ts  src/lib/session.ts  src/lib/api.ts
  src/hooks/useRoom.ts  src/hooks/useTicker.ts  src/hooks/useLongPress.ts
  src/pages/Home.tsx  src/pages/Room.tsx
  src/components/JoinForm.tsx  Lobby.tsx  Table.tsx  PlayerRow.tsx  CardView.tsx
                 Controls.tsx  Timer.tsx  TargetModal.tsx  RoundEndOverlay.tsx
                 ReactionBar.tsx  Result.tsx
  public/icon.svg
.github/workflows/deploy.yml
README.md
```

---

### Task 1: モノレポ雛形とエンジンパッケージ

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`, `packages/engine/src/index.ts`

- [ ] **Step 1: ルートファイルを作成**

`package.json`:
```json
{
  "name": "lucky-seven",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test -w @lucky7/engine",
    "dev": "npm run dev -w @lucky7/web",
    "build": "npm run build -w @lucky7/web",
    "sync-engine": "bash scripts/sync-engine.sh"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  }
}
```

`.gitignore`:
```
node_modules
dist
.env
.env.local
supabase/.temp
supabase/functions/_shared/engine
```

- [ ] **Step 2: エンジンパッケージを作成**

`packages/engine/package.json`:
```json
{
  "name": "@lucky7/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "test:watch": "vitest" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
```

`packages/engine/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

`packages/engine/src/index.ts`:
```ts
export {};
```

- [ ] **Step 3: インストールしてテストランナーが動くことを確認**

Run: `npm install && npm test`
Expected: `No test files found` で終了コード 0 以外でも構わない（ファイル未作成のため）。`vitest` が起動していれば OK。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: モノレポ雛形とエンジンパッケージ"
```

---

### Task 2: カード定義・山札生成・乱数

**Files:**
- Create: `packages/engine/src/cards.ts`
- Test: `packages/engine/test/cards.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/engine/test/cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDeck, mulberry32, shuffle } from '../src/cards.ts';

describe('buildDeck', () => {
  it('94枚で構成が正しい', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(94);
    const numbers = deck.filter((c) => c.kind === 'number');
    expect(numbers).toHaveLength(79);
    for (let v = 0; v <= 12; v++) {
      const copies = numbers.filter((c) => c.kind === 'number' && c.value === v).length;
      expect(copies).toBe(v === 0 ? 1 : v);
    }
    for (const action of ['freeze', 'triple', 'insurance'] as const) {
      expect(deck.filter((c) => c.kind === 'action' && c.action === action)).toHaveLength(3);
    }
    expect(deck.filter((c) => c.kind === 'add').map((c) => (c.kind === 'add' ? c.value : 0)).sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
    expect(deck.filter((c) => c.kind === 'mul')).toHaveLength(1);
  });
  it('id がすべて一意', () => {
    const ids = new Set(buildDeck().map((c) => c.id));
    expect(ids.size).toBe(94);
  });
});

describe('shuffle', () => {
  it('同じ seed なら同じ並び、元配列は変えない', () => {
    const deck = buildDeck();
    const a = shuffle(deck, mulberry32(42));
    const b = shuffle(deck, mulberry32(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(deck.map((c) => c.id)).toEqual(buildDeck().map((c) => c.id));
    expect(a).toHaveLength(94);
    expect(new Set(a.map((c) => c.id)).size).toBe(94);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -w @lucky7/engine`
Expected: FAIL（`../src/cards.ts` が見つからない）

- [ ] **Step 3: 実装**

`packages/engine/src/cards.ts`:
```ts
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
```

- [ ] **Step 4: テスト通過を確認**

Run: `npm test -w @lucky7/engine`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): カード定義と山札生成"
```

---

### Task 3: 得点計算

**Files:**
- Create: `packages/engine/src/score.ts`
- Test: `packages/engine/test/score.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/engine/test/score.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Card } from '../src/cards.ts';
import { scoreCards, uniqueNumberCount } from '../src/score.ts';

const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
const ADD = (value: number): Card => ({ id: `m-add-${value}`, kind: 'add', value });
const MUL: Card = { id: 'm-mul', kind: 'mul' };

describe('scoreCards', () => {
  it('数字の合計', () => expect(scoreCards([N(3), N(7), N(12)], false)).toBe(22));
  it('×2 は数字合計のみ2倍、修飾は後で加算', () => {
    expect(scoreCards([N(5), N(6), MUL, ADD(4)], false)).toBe(26);
  });
  it('数字なし・修飾のみは修飾分だけ', () => {
    expect(scoreCards([ADD(10)], false)).toBe(10);
    expect(scoreCards([MUL], false)).toBe(0);
  });
  it('7種達成で +15', () => {
    expect(scoreCards([N(0), N(1), N(2), N(3), N(4), N(5), N(6)], true)).toBe(36);
  });
});

describe('uniqueNumberCount', () => {
  it('数字カードの種類数を数える', () => {
    expect(uniqueNumberCount([N(0), N(4), ADD(2), MUL])).toBe(2);
    expect(uniqueNumberCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -w @lucky7/engine`
Expected: FAIL（`../src/score.ts` が見つからない）

- [ ] **Step 3: 実装**

`packages/engine/src/score.ts`:
```ts
import type { Card } from './cards.ts';

export const SEVEN_BONUS = 15;

export function uniqueNumberCount(cards: readonly Card[]): number {
  const values = new Set<number>();
  for (const c of cards) if (c.kind === 'number') values.add(c.value);
  return values.size;
}

export function numberValues(cards: readonly Card[]): Set<number> {
  const values = new Set<number>();
  for (const c of cards) if (c.kind === 'number') values.add(c.value);
  return values;
}

export function scoreCards(cards: readonly Card[], seven: boolean): number {
  let numbers = 0;
  let adds = 0;
  let mul = false;
  for (const c of cards) {
    if (c.kind === 'number') numbers += c.value;
    else if (c.kind === 'add') adds += c.value;
    else if (c.kind === 'mul') mul = true;
  }
  if (mul) numbers *= 2;
  return numbers + adds + (seven ? SEVEN_BONUS : 0);
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npm test -w @lucky7/engine`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 得点計算"
```

---

### Task 4: 状態型と山札から1枚取る処理（再構成・ラッキーモード）

**Files:**
- Create: `packages/engine/src/types.ts`, `packages/engine/src/draw.ts`
- Test: `packages/engine/test/draw.test.ts`

- [ ] **Step 1: 状態型を定義**

`packages/engine/src/types.ts`:
```ts
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
  | { type: 'insurance_used'; seat: number; card: Card }
  | { type: 'stay'; seat: number }
  | { type: 'freeze'; seat: number; targetSeat: number }
  | { type: 'triple'; seat: number; targetSeat: number }
  | { type: 'give_insurance'; seat: number; targetSeat: number }
  | { type: 'seven'; seat: number }
  | { type: 'round_end'; round: number }
  | { type: 'game_end'; winnerSeats: number[] }
  | { type: 'timeout'; seat: number };

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
```

- [ ] **Step 2: 失敗するテストを書く**

`packages/engine/test/draw.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Card } from '../src/cards.ts';
import { buildDeck, mulberry32 } from '../src/cards.ts';
import { takeCard } from '../src/draw.ts';
import type { PlayerState, PublicState, Secrets } from '../src/types.ts';

const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
const FREEZE: Card = { id: 'a-freeze-0', kind: 'action', action: 'freeze' };

function player(cards: Card[] = []): PlayerState {
  return { seat: 0, isCpu: false, status: 'active', cards, hasInsurance: false, roundScore: 0, totalScore: 0 };
}
function state(discard: Card[] = []): PublicState {
  return {
    settings: { turnSeconds: null, endMode: 'points', target: 200 },
    round: 1, dealerSeat: 0, dealSeat: null, turnSeat: 0, phase: 'turn', pending: null, triple: null,
    actionQueue: [], players: [player()], discard, deckCount: 0, deadline: null, autoAt: null, events: [], winnerSeats: null,
  };
}

describe('takeCard', () => {
  it('山札の先頭を取り deckCount を更新', () => {
    const s = state();
    const sec: Secrets = { deck: [N(3), N(5)], luckySeats: [] };
    const card = takeCard(s, sec, player(), mulberry32(1));
    expect(card).toEqual(N(3));
    expect(sec.deck).toEqual([N(5)]);
    expect(s.deckCount).toBe(1);
  });

  it('山札が空なら捨て札を切り直して継続', () => {
    const s = state([N(1), N(2), N(4)]);
    const sec: Secrets = { deck: [], luckySeats: [] };
    const card = takeCard(s, sec, player(), mulberry32(1));
    expect(['n1-0', 'n2-0', 'n4-0']).toContain(card.id);
    expect(s.discard).toEqual([]);
    expect(sec.deck).toHaveLength(2);
    expect(s.deckCount).toBe(2);
  });

  it('山札も捨て札も空なら例外', () => {
    const s = state();
    const sec: Secrets = { deck: [], luckySeats: [] };
    expect(() => takeCard(s, sec, player(), mulberry32(1))).toThrow();
  });

  it('ラッキーモード: 場にある数字を飛ばし、飛ばした分は底へ', () => {
    const s = state();
    const p = player([N(5, 0), N(7, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(7, 1), FREEZE, N(9)], luckySeats: [0] };
    const card = takeCard(s, sec, p, mulberry32(1));
    expect(card).toEqual(FREEZE);
    expect(sec.deck.map((c) => c.id)).toEqual(['n9-0', 'n5-1', 'n7-1']);
  });

  it('ラッキーモードでも対象外の座席は通常通り', () => {
    const s = state();
    const p = player([N(5, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(9)], luckySeats: [3] };
    expect(takeCard(s, sec, p, mulberry32(1))).toEqual(N(5, 1));
  });

  it('ラッキーモードで全カードが重複なら通常通り先頭', () => {
    const s = state();
    const p = player([N(5, 0)]);
    const sec: Secrets = { deck: [N(5, 1), N(5, 2)], luckySeats: [0] };
    expect(takeCard(s, sec, p, mulberry32(1))).toEqual(N(5, 1));
  });

  it('94枚全部引ける（捨て札再構成込み）', () => {
    const s = state();
    const sec: Secrets = { deck: buildDeck(), luckySeats: [] };
    const seen: string[] = [];
    for (let i = 0; i < 94; i++) seen.push(takeCard(s, sec, player(), mulberry32(1)).id);
    expect(new Set(seen).size).toBe(94);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npm test -w @lucky7/engine`
Expected: FAIL（`../src/draw.ts` が見つからない）

- [ ] **Step 4: 実装**

`packages/engine/src/draw.ts`:
```ts
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
```

- [ ] **Step 5: テスト通過を確認**

Run: `npm test -w @lucky7/engine`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): 状態型と山札引き（再構成・ラッキーモード）"
```

---
### Task 5: ゲーム進行コア（開始・配布・引く・降りる・バースト・保険）

**Files:**
- Create: `packages/engine/src/game.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/helpers.ts`, `packages/engine/test/game-basic.test.ts`

- [ ] **Step 1: テスト用ヘルパーを作成**

`packages/engine/test/helpers.ts`:
```ts
import type { Card } from '../src/cards.ts';
import { buildDeck, mulberry32 } from '../src/cards.ts';
import type { Settings } from '../src/types.ts';
import { startGameWithDeck } from '../src/game.ts';

export const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
export const ADD = (value: number): Card => ({ id: `m-add-${value}`, kind: 'add', value });
export const MUL: Card = { id: 'm-mul', kind: 'mul' };
export const FREEZE = (i = 0): Card => ({ id: `a-freeze-${i}`, kind: 'action', action: 'freeze' });
export const TRIPLE = (i = 0): Card => ({ id: `a-triple-${i}`, kind: 'action', action: 'triple' });
export const INSURANCE = (i = 0): Card => ({ id: `a-insurance-${i}`, kind: 'action', action: 'insurance' });

/** 指定カードを上に置き、残りは buildDeck の順で続ける 94 枚の山札 */
export function craftDeck(top: Card[]): Card[] {
  const used = new Set(top.map((c) => c.id));
  return [...top, ...buildDeck().filter((c) => !used.has(c.id))];
}

export const SETTINGS: Settings = { turnSeconds: 20, endMode: 'points', target: 200 };
export const NOW = 1_700_000_000_000;
export const rng = () => mulberry32(7);

/** 人間 n 人（座席 0..n-1）でゲーム開始。配布は deck の先頭から座席 1,2,...,0(親) の順 */
export function start(top: Card[], n = 2, settings: Settings = SETTINGS, cpuSeats: number[] = []) {
  const seats = Array.from({ length: n }, (_, i) => ({ seat: i, isCpu: cpuSeats.includes(i) }));
  return startGameWithDeck(seats, settings, craftDeck(top), NOW);
}
```

- [ ] **Step 2: 失敗するテストを書く（基本進行）**

`packages/engine/test/game-basic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyAction, waitingOn, startGame } from '../src/game.ts';
import { N, ADD, INSURANCE, start, SETTINGS, NOW, rng } from './helpers.ts';
import { EngineError } from '../src/types.ts';

describe('startGame / 配布', () => {
  it('最初の親は座席0、配布は座席1から始まり親が最後', () => {
    // 2人: 座席1に n3, 座席0(親)に n5
    const { state } = start([N(3), N(5)]);
    expect(state.round).toBe(1);
    expect(state.dealerSeat).toBe(0);
    expect(state.players[1].cards).toEqual([N(3)]);
    expect(state.players[0].cards).toEqual([N(5)]);
    expect(state.phase).toBe('turn');
    expect(state.turnSeat).toBe(1);
    expect(state.deckCount).toBe(92);
    expect(state.deadline).toBe(NOW + 20_000);
    expect(state.autoAt).toBeNull();
  });
  it('2人未満は例外', () => {
    expect(() => startGame([{ seat: 0, isCpu: false }], SETTINGS, rng(), NOW)).toThrow(EngineError);
  });
  it('待機中の座席が CPU なら autoAt が付く', () => {
    const { state } = start([N(3), N(5)], 2, SETTINGS, [1]);
    expect(state.turnSeat).toBe(1);
    expect(state.autoAt).toBe(NOW + 1500);
    expect(state.deadline).toBeNull();
  });
  it('無制限設定なら deadline は null', () => {
    const { state } = start([N(3), N(5)], 2, { ...SETTINGS, turnSeconds: null });
    expect(state.deadline).toBeNull();
  });
});

describe('hit / stay', () => {
  it('hit で1枚引いて手番が次へ', () => {
    const { state, secrets } = start([N(3), N(5), N(8)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].cards).toEqual([N(3), N(8)]);
    expect(r.state.turnSeat).toBe(0);
    expect(r.state.events).toContainEqual({ type: 'draw', seat: 1, card: N(8) });
  });
  it('手番でない人の hit は例外', () => {
    const { state, secrets } = start([N(3), N(5)]);
    expect(() => applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW)).toThrow(EngineError);
  });
  it('stay で得点確定し手番が次へ。全員降りたらラウンド終了', () => {
    const { state, secrets } = start([N(3), N(5)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    expect(a.state.players[1].status).toBe('stayed');
    expect(a.state.players[1].roundScore).toBe(3);
    expect(a.state.turnSeat).toBe(0);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('round_end');
    expect(b.state.players[0].totalScore).toBe(5);
    expect(b.state.players[1].totalScore).toBe(3);
    expect(b.state.discard).toHaveLength(2);
    expect(b.state.players[0].cards).toEqual([]);
    expect(waitingOn(b.state)).toBeNull();
  });
  it('修飾カードは場に加わる', () => {
    const { state, secrets } = start([N(3), N(5), ADD(4)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].cards).toEqual([N(3), ADD(4)]);
  });
});

describe('バーストと保険', () => {
  it('同じ数字でバースト: 得点0・場札は捨て札・ラウンド脱落', () => {
    const { state, secrets } = start([N(3, 0), N(5), N(3, 1)]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const p = r.state.players[1];
    expect(p.status).toBe('busted');
    expect(p.cards).toEqual([]);
    expect(p.roundScore).toBe(0);
    expect(r.state.discard.map((c) => c.id)).toEqual(['n3-0', 'n3-1']);
    expect(r.state.events).toContainEqual({ type: 'bust', seat: 1, card: N(3, 1) });
    expect(r.state.turnSeat).toBe(0);
  });
  it('保険を引くと保持、カードは捨て札へ', () => {
    const { state, secrets } = start([N(3), N(5), INSURANCE()]);
    const r = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    expect(r.state.players[1].hasInsurance).toBe(true);
    expect(r.state.players[1].cards).toEqual([N(3)]);
    expect(r.state.discard).toEqual([INSURANCE()]);
  });
  it('保険があれば重複を捨てて続行', () => {
    const { state, secrets } = start([N(3, 0), N(5), INSURANCE(), N(9), N(3, 1)]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW); // 保険
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW); // n9
    const c = applyAction(b.state, b.secrets, { type: 'hit', seat: 1 }, rng(), NOW); // n3 重複
    const p = c.state.players[1];
    expect(p.status).toBe('active');
    expect(p.hasInsurance).toBe(false);
    expect(p.cards).toEqual([N(3, 0)]);
    expect(c.state.events).toContainEqual({ type: 'insurance_used', seat: 1, card: N(3, 1) });
  });
  it('一人だけ残ったら手番は自分に戻る', () => {
    const { state, secrets } = start([N(3), N(5), N(8)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'hit', seat: 0 }, rng(), NOW);
    expect(b.state.turnSeat).toBe(0);
    expect(b.state.phase).toBe('turn');
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npm test -w @lucky7/engine`
Expected: FAIL（`../src/game.ts` が見つからない）

- [ ] **Step 4: game.ts を実装（アクション処理を含む完全版）**

`packages/engine/src/game.ts`:
```ts
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

export interface SeatInput {
  seat: number;
  isCpu: boolean;
}

export function startGame(seats: SeatInput[], settings: Settings, rng: Rng, now: number) {
  return startGameWithDeck(seats, settings, shuffle(buildDeck(), rng), now, rng);
}

/** テスト用: 山札の並びを指定して開始 */
export function startGameWithDeck(
  seats: SeatInput[],
  settings: Settings,
  deck: Card[],
  now: number,
  rng: Rng = mulberry32(1),
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
  const state: PublicState = {
    settings,
    round: 0,
    dealerSeat: players[players.length - 1].seat,
    dealSeat: null,
    turnSeat: null,
    phase: 'round_end',
    pending: null,
    triple: null,
    actionQueue: [],
    players,
    discard: [],
    deckCount: deck.length,
    deadline: null,
    autoAt: null,
    events: [],
    winnerSeats: null,
  };
  const secrets: Secrets = { deck: [...deck], luckySeats: [] };
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
      drawFor(s, sec, action.seat, rng);
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
  s.discard.push(...p.cards, card);
  p.cards = [];
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
  if (card.kind === 'number') {
    if (p.cards.some((c) => c.kind === 'number' && c.value === card.value)) {
      if (p.hasInsurance) {
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
    if (uniqueNumberCount(p.cards) === 7) {
      s.events.push({ type: 'seven', seat });
      endRound(s, seat);
    }
    return;
  }
  if (card.kind === 'add' || card.kind === 'mul') {
    p.cards.push(card);
    s.events.push({ type: 'draw', seat, card });
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
  const self = candidates.includes(w.seat) ? w.seat : candidates[0];
  chooseTarget(s, w.seat, self);
}

function endRound(s: PublicState, sevenSeat: number | null = null) {
  for (const p of s.players) {
    if (p.status === 'active') {
      p.status = 'stayed';
      p.roundScore = scoreCards(p.cards, p.seat === sevenSeat);
    }
    p.totalScore += p.roundScore;
    s.discard.push(...p.cards);
    p.cards = [];
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
  s.actionQueue = [];
  s.winnerSeats = null;
  runAuto(s, sec, rng);
}

/** 入力が必要になるか、ラウンド/ゲームが終わるまで自動で進める */
function runAuto(s: PublicState, sec: Secrets, rng: Rng) {
  for (let guard = 0; guard < 2000; guard++) {
    if (s.phase === 'round_end' || s.phase === 'game_end') return;
    if (s.pending) return;
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
```

`packages/engine/src/index.ts`:
```ts
export * from './cards.ts';
export * from './types.ts';
export * from './score.ts';
export * from './draw.ts';
export * from './game.ts';
```

- [ ] **Step 5: テスト通過を確認**

Run: `npm test -w @lucky7/engine`
Expected: PASS（全ファイル）

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): ゲーム進行コア（配布・引く・降りる・バースト・保険）"
```

---

### Task 6: 氷結・三連・保険譲渡のテスト

**Files:**
- Test: `packages/engine/test/game-actions.test.ts`
- Modify (必要な場合のみ): `packages/engine/src/game.ts`

- [ ] **Step 1: テストを書く**

`packages/engine/test/game-actions.test.ts`:
```ts
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
```

- [ ] **Step 2: テスト実行**

Run: `npm test -w @lucky7/engine`
Expected: PASS。失敗した場合は `game.ts` の該当箇所を修正する（テスト側は設計書のルールに一致しているので変えない）。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(engine): 氷結・三連・保険譲渡"
```

---

### Task 7: 7種達成・ラウンド終了・ゲーム終了・時間切れのテスト

**Files:**
- Test: `packages/engine/test/game-round.test.ts`
- Modify (必要な場合のみ): `packages/engine/src/game.ts`

- [ ] **Step 1: テストを書く**

`packages/engine/test/game-round.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyAction, waitingOn } from '../src/game.ts';
import { N, FREEZE, start, rng, NOW, SETTINGS } from './helpers.ts';

describe('7種達成', () => {
  it('7種揃った瞬間 +15 で全員のラウンド終了', () => {
    // 座席1: n1.. 配布で n1、hit で n2..n7 を引く（座席0 は毎回 stay しないよう hit で数字を積む）
    const top = [N(1), N(0), N(2), N(12), N(3), N(11), N(4), N(10), N(5), N(9), N(6), N(8), N(7)];
    let { state, secrets } = start(top, 2);
    for (let i = 0; i < 6; i++) {
      ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
      if (state.phase === 'turn') ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 0 }, rng(), NOW));
    }
    expect(state.phase).toBe('round_end');
    expect(state.players[1].roundScore).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7 + 15);
    expect(state.players[0].status).toBe('stayed');
    expect(state.players[0].roundScore).toBe(0 + 12 + 11 + 10 + 9 + 8);
    expect(state.events).toContainEqual({ type: 'seven', seat: 1 });
  });
});

describe('ラウンド終了と次ラウンド', () => {
  it('next_round で親が交代し全員リセット、捨て札は残る', () => {
    const { state, secrets } = start([N(3), N(5), N(6), N(7)]);
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('round_end');
    const c = applyAction(b.state, b.secrets, { type: 'next_round' }, rng(), NOW);
    expect(c.state.round).toBe(2);
    expect(c.state.dealerSeat).toBe(1);
    expect(c.state.turnSeat).toBe(0);
    expect(c.state.players[0].cards).toEqual([N(6)]);
    expect(c.state.players[1].cards).toEqual([N(7)]);
    expect(c.state.discard).toHaveLength(2);
    expect(c.state.players[0].totalScore).toBe(5);
  });
  it('round_end 以外で next_round は例外', () => {
    const { state, secrets } = start([N(3), N(5)]);
    expect(() => applyAction(state, secrets, { type: 'next_round' }, rng(), NOW)).toThrow();
  });
});

describe('ゲーム終了', () => {
  it('目標点到達で game_end、最高点が勝者', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'points', target: 5 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('game_end');
    expect(b.state.winnerSeats).toEqual([0]);
    expect(waitingOn(b.state)).toBeNull();
  });
  it('同点は同順位', () => {
    const { state, secrets } = start([N(5, 0), N(5, 1)], 2, { ...SETTINGS, endMode: 'points', target: 5 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.winnerSeats).toEqual([0, 1]);
  });
  it('ラウンド数モードは規定ラウンド終了で game_end', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'rounds', target: 1 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(b.state.phase).toBe('game_end');
  });
});

describe('時間切れ', () => {
  it('手番の時間切れは自動で降りる', () => {
    const { state, secrets } = start([N(3), N(5)]);
    const a = applyAction(state, secrets, { type: 'timeout' }, rng(), NOW + 30_000);
    expect(a.state.players[1].status).toBe('stayed');
    expect(a.state.turnSeat).toBe(0);
    expect(a.state.events).toContainEqual({ type: 'timeout', seat: 1 });
    expect(a.state.deadline).toBe(NOW + 30_000 + 20_000);
  });
  it('対象選択の時間切れは自分を対象', () => {
    const { state, secrets } = start([N(3), N(5), FREEZE()]);
    const a = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'timeout' }, rng(), NOW);
    expect(b.state.players[1].status).toBe('stayed');
  });
  it('待機中でなければ例外', () => {
    const { state, secrets } = start([N(3), N(5)], 2, { ...SETTINGS, endMode: 'rounds', target: 1 });
    const a = applyAction(state, secrets, { type: 'stay', seat: 1 }, rng(), NOW);
    const b = applyAction(a.state, a.secrets, { type: 'stay', seat: 0 }, rng(), NOW);
    expect(() => applyAction(b.state, b.secrets, { type: 'timeout' }, rng(), NOW)).toThrow();
  });
});

describe('カード保存則', () => {
  it('どの時点でも 山札+捨て札+場札+保留 = 94', () => {
    let { state, secrets } = start([N(3), N(5), N(6), FREEZE(), N(8)], 3);
    const count = () =>
      state.deckCount +
      state.discard.length +
      state.players.reduce((n, p) => n + p.cards.length, 0) +
      (state.pending ? 1 : 0) +
      state.actionQueue.length;
    expect(count()).toBe(94);
    ({ state, secrets } = applyAction(state, secrets, { type: 'hit', seat: 1 }, rng(), NOW));
    expect(count()).toBe(94);
    ({ state, secrets } = applyAction(state, secrets, { type: 'choose_target', seat: 1, targetSeat: 2 }, rng(), NOW));
    expect(count()).toBe(94);
  });
});
```

- [ ] **Step 2: テスト実行**

Run: `npm test -w @lucky7/engine`
Expected: PASS。失敗があれば `game.ts` を修正。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(engine): 7種達成・ラウンド/ゲーム終了・時間切れ"
```

---
### Task 8: CPU 判断

**Files:**
- Create: `packages/engine/src/cpu.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/cpu.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/engine/test/cpu.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game.ts';
import { bustProbability, cpuDecide } from '../src/cpu.ts';
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -w @lucky7/engine`
Expected: FAIL（`../src/cpu.ts` が見つからない）

- [ ] **Step 3: 実装**

`packages/engine/src/cpu.ts`:
```ts
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
      target = others.reduce((a, b) => (currentScore(a) <= currentScore(b) ? a : b)).seat;
    }
    return { type: 'choose_target', seat, targetSeat: target };
  }

  const uniq = uniqueNumberCount(me.cards);
  if (uniq === 0) return { type: 'hit', seat };
  const p = bustProbability(state, seat);
  const rs = currentScore(me);
  let t = 0.3;
  if (rs >= 20) t = 0.22;
  if (rs >= 30) t = 0.14;
  if (rs >= 40) t = 0.06;
  if (uniq === 6) t += 0.2;
  const leader = Math.max(0, ...state.players.filter((o) => o.seat !== seat).map((o) => o.totalScore));
  if (me.totalScore + rs < leader - 40) t += 0.1;
  if (me.hasInsurance) t += 0.35;
  return p < t ? { type: 'hit', seat } : { type: 'stay', seat };
}
```

`packages/engine/src/index.ts` に追記:
```ts
export * from './cpu.ts';
```

- [ ] **Step 4: テスト通過を確認**

Run: `npm test -w @lucky7/engine`
Expected: PASS。「高得点かつ高リスクなら降りる」は rs=42 → t=0.06、p=(11+10+9+8)/86≈0.44 なので stay。「保険持ちは強気」は rs=23 → t=0.22+0.35=0.57、p=(11+10)/88≈0.24 なので hit。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): CPU 判断ロジック"
```

---

### Task 9: Supabase スキーマと設定

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20260910000000_init.sql`, `scripts/sync-engine.sh`

- [ ] **Step 1: Supabase CLI を初期化**

Run: `npx supabase@latest init --force` （対話は全て No）
Expected: `supabase/config.toml` が生成される。

- [ ] **Step 2: config.toml に Edge Function 設定を追記**

`supabase/config.toml` 末尾に追加:
```toml
[functions.act]
verify_jwt = false
```

- [ ] **Step 3: マイグレーションを作成**

`supabase/migrations/20260910000000_init.sql`:
```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_player_id uuid,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null default '{"turnSeconds": 20, "endMode": "points", "target": 200}'::jsonb,
  state jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  seat integer,
  is_cpu boolean not null default false,
  joined_at timestamptz not null default now()
);
create index players_room_idx on public.players(room_id);

create table public.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  token text not null
);

create table public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  deck jsonb not null default '[]'::jsonb,
  lucky_player_ids jsonb not null default '[]'::jsonb
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_tokens enable row level security;
alter table public.room_secrets enable row level security;

create policy "rooms readable" on public.rooms for select to anon, authenticated using (true);
create policy "players readable" on public.players for select to anon, authenticated using (true);
-- player_tokens / room_secrets にはポリシーを作らない（service role のみ）

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;

-- 24時間以上前のルームを削除する関数（cron は任意）
create or replace function public.cleanup_old_rooms() returns void language sql security definer as $$
  delete from public.rooms where created_at < now() - interval '24 hours';
$$;
```

- [ ] **Step 4: エンジン同期スクリプト**

`scripts/sync-engine.sh`:
```bash
#!/usr/bin/env bash
# Edge Function は supabase/functions 配下しかバンドルしないため、エンジンのソースをコピーする
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/supabase/functions/_shared/engine"
rm -rf "$dest"
mkdir -p "$dest"
cp "$root"/packages/engine/src/*.ts "$dest"/
echo "synced engine -> $dest"
```

Run: `chmod +x scripts/sync-engine.sh && npm run sync-engine`
Expected: `synced engine -> .../supabase/functions/_shared/engine`

- [ ] **Step 5: ローカル DB でマイグレーションを検証（Docker がある場合）**

Run: `npx supabase start && npx supabase db reset`
Expected: エラーなく `Finished supabase db reset`。Docker がない環境ではこのステップをスキップし、README の手順でリモートに `db push` する。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(supabase): スキーマ・RLS・エンジン同期スクリプト"
```

---
### Task 10: Edge Function `act` の土台と create / join

**Files:**
- Create: `supabase/functions/act/index.ts`, `supabase/functions/act/api.ts`, `supabase/functions/act/deno.json`

- [ ] **Step 1: エントリポイント**

`supabase/functions/act/deno.json`:
```json
{ "imports": { "@supabase/supabase-js": "npm:@supabase/supabase-js@2" } }
```

`supabase/functions/act/index.ts`:
```ts
import { ApiError, handle } from './api.ts';
import { EngineError } from '../_shared/engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const result = await handle(body);
    return json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof EngineError || e instanceof ApiError) return json({ ok: false, error: e.message }, 400);
    console.error(e);
    return json({ ok: false, error: 'サーバーエラー' }, 500);
  }
});
```

- [ ] **Step 2: api.ts の土台（DB アクセス・認証・create・join）**

`supabase/functions/act/api.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Card, PublicState, Settings } from '../_shared/engine/index.ts';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ActRequest {
  action: string;
  code?: string;
  playerId?: string;
  token?: string;
  payload?: Record<string, unknown>;
}

export interface RoomRow {
  id: string;
  code: string;
  host_player_id: string | null;
  status: 'lobby' | 'playing' | 'finished';
  settings: Settings;
  state: PublicState | null;
  version: number;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

export interface SecretsRow {
  room_id: string;
  deck: Card[];
  lucky_player_ids: string[];
}

export const MAX_PLAYERS = 12;
export const CPU_NAMES = [
  'CPU・タロウ', 'CPU・ハナコ', 'CPU・ジロウ', 'CPU・ミサキ', 'CPU・ケン', 'CPU・アヤ',
  'CPU・ゴロウ', 'CPU・リン', 'CPU・ダイ', 'CPU・ユイ', 'CPU・シン',
];

export function db(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function genToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (name.length < 1 || name.length > 12) throw new ApiError('名前は1〜12文字で入力してください');
  return name;
}

export async function loadRoom(sb: SupabaseClient, code: string | undefined): Promise<RoomRow> {
  if (!code) throw new ApiError('ルームコードが必要です');
  const { data, error } = await sb.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('ルームが見つかりません');
  return data as RoomRow;
}

export async function loadPlayers(sb: SupabaseClient, roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await sb
    .from('players')
    .select('id, room_id, name, seat, is_cpu')
    .eq('room_id', roomId)
    .order('seat', { ascending: true, nullsFirst: false })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
}

export async function loadSecrets(sb: SupabaseClient, roomId: string): Promise<SecretsRow> {
  const { data, error } = await sb.from('room_secrets').select('*').eq('room_id', roomId).single();
  if (error) throw error;
  return data as SecretsRow;
}

export async function authPlayer(
  sb: SupabaseClient,
  room: RoomRow,
  playerId: string | undefined,
  token: string | undefined,
): Promise<PlayerRow> {
  if (!playerId || !token) throw new ApiError('参加情報がありません');
  const { data: t } = await sb.from('player_tokens').select('token').eq('player_id', playerId).maybeSingle();
  if (!t || t.token !== token) throw new ApiError('参加情報が無効です');
  const { data: p } = await sb.from('players').select('id, room_id, name, seat, is_cpu').eq('id', playerId).maybeSingle();
  if (!p || p.room_id !== room.id) throw new ApiError('このルームの参加者ではありません');
  return p as PlayerRow;
}

export function requireHost(room: RoomRow, me: PlayerRow) {
  if (room.host_player_id !== me.id) throw new ApiError('ホストのみ操作できます');
}

export function nextFreeSeat(players: PlayerRow[]): number {
  const seated = players.filter((p) => p.seat !== null);
  if (seated.length >= MAX_PLAYERS) throw new ApiError('満員です（12人まで）');
  return seated.length === 0 ? 0 : Math.max(...seated.map((p) => p.seat!)) + 1;
}

async function insertPlayer(
  sb: SupabaseClient,
  roomId: string,
  name: string,
  seat: number | null,
  isCpu: boolean,
): Promise<{ playerId: string; token: string }> {
  const { data, error } = await sb
    .from('players')
    .insert({ room_id: roomId, name, seat, is_cpu: isCpu })
    .select('id')
    .single();
  if (error) throw error;
  const token = genToken();
  if (!isCpu) {
    const { error: e2 } = await sb.from('player_tokens').insert({ player_id: data.id, token });
    if (e2) throw e2;
  }
  return { playerId: data.id, token };
}

// ---------- create / join ----------

async function create(sb: SupabaseClient, payload: Record<string, unknown> | undefined) {
  const name = cleanName(payload?.name);
  let room: { id: string; code: string } | null = null;
  for (let i = 0; i < 5 && !room; i++) {
    const { data, error } = await sb.from('rooms').insert({ code: genCode() }).select('id, code').single();
    if (!error) room = data;
    else if (error.code !== '23505') throw error;
  }
  if (!room) throw new ApiError('ルームを作成できませんでした');
  const { playerId, token } = await insertPlayer(sb, room.id, name, 0, false);
  await sb.from('rooms').update({ host_player_id: playerId }).eq('id', room.id);
  await sb.from('room_secrets').insert({ room_id: room.id });
  return { code: room.code, playerId, token, seat: 0 };
}

async function join(sb: SupabaseClient, req: ActRequest) {
  const room = await loadRoom(sb, req.code);
  if (req.playerId && req.token) {
    const me = await authPlayer(sb, room, req.playerId, req.token);
    return { code: room.code, playerId: me.id, token: req.token, seat: me.seat };
  }
  const name = cleanName(req.payload?.name);
  const players = await loadPlayers(sb, room.id);
  const seat = room.status === 'lobby' ? nextFreeSeat(players) : null;
  const { playerId, token } = await insertPlayer(sb, room.id, name, seat, false);
  return { code: room.code, playerId, token, seat };
}

// ---------- dispatcher ----------

export async function handle(req: ActRequest): Promise<Record<string, unknown>> {
  const sb = db();
  if (req.action === 'create') return create(sb, req.payload);
  if (req.action === 'join') return join(sb, req);

  const room = await loadRoom(sb, req.code);
  const me = await authPlayer(sb, room, req.playerId, req.token);
  switch (req.action) {
    case 'add_cpu':
      return addCpu(sb, room, me);
    case 'remove_cpu':
      return removeCpu(sb, room, me, String(req.payload?.playerId ?? ''));
    case 'update_settings':
      return updateSettings(sb, room, me, req.payload?.settings);
    case 'start':
      return startRoom(sb, room, me);
    case 'next_game':
      return nextGame(sb, room, me);
    case 'toggle_lucky':
      return toggleLucky(sb, room, me);
    case 'hit':
    case 'stay':
    case 'choose_target':
    case 'next_round':
    case 'tick':
      return gameAction(sb, room.code, me, req.action, req.payload ?? {});
    default:
      throw new ApiError('不明な操作です');
  }
}

// Task 11 / 12 で実装
async function addCpu(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function removeCpu(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow, _id: string): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function updateSettings(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow, _s: unknown): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function startRoom(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function nextGame(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function toggleLucky(_sb: SupabaseClient, _room: RoomRow, _me: PlayerRow): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
async function gameAction(_sb: SupabaseClient, _code: string, _me: PlayerRow, _action: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> { throw new ApiError('未実装'); }
```

- [ ] **Step 3: 型チェック**

Run: `npm run sync-engine && cd supabase/functions/act && deno check index.ts`
Expected: エラーなし（`deno` が無ければ `npx supabase functions serve act` の起動でエラーが出ないことで代替）。

- [ ] **Step 4: ローカルで動作確認（Docker がある場合）**

Run:
```bash
npx supabase start
npx supabase functions serve act --no-verify-jwt &
curl -s -X POST http://127.0.0.1:54321/functions/v1/act -H 'Content-Type: application/json' \
  -d '{"action":"create","payload":{"name":"よしてつ"}}'
```
Expected: `{"ok":true,"code":"XXXXXX","playerId":"...","token":"...","seat":0}`
続けて `{"action":"join","code":"XXXXXX","payload":{"name":"ゲスト"}}` で `seat:1` が返る。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): Edge Function 土台と create/join"
```

---

### Task 11: ロビー操作（CPU 追加・削除・設定・開始・次ゲーム・ラッキー切替）

**Files:**
- Modify: `supabase/functions/act/api.ts`（Task 10 の「未実装」スタブを置き換え）

- [ ] **Step 1: import を追加**

`api.ts` の先頭 import を次に置き換える:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  applyAction,
  cpuDecide,
  randomRng,
  startGame,
  waitingOn,
  type Action,
  type Card,
  type PublicState,
  type Secrets,
  type Settings,
} from '../_shared/engine/index.ts';
```

- [ ] **Step 2: スタブを実装で置き換える（gameAction 以外）**

```ts
function validateSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const turnSeconds = s.turnSeconds === 20 || s.turnSeconds === 60 ? s.turnSeconds : null;
  const endMode = s.endMode === 'rounds' ? 'rounds' : 'points';
  const allowed = endMode === 'points' ? [100, 200, 300] : [3, 5, 10];
  const target = allowed.includes(Number(s.target)) ? Number(s.target) : allowed[1];
  return { turnSeconds, endMode, target };
}

async function saveNewGame(sb: SupabaseClient, room: RoomRow, state: PublicState, deck: Card[]) {
  const { data, error } = await sb
    .from('rooms')
    .update({ state, status: 'playing', version: room.version + 1, updated_at: new Date().toISOString() })
    .eq('id', room.id)
    .eq('version', room.version)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError('他の操作と重なりました。もう一度お試しください');
  const { error: e2 } = await sb.from('room_secrets').update({ deck }).eq('room_id', room.id);
  if (e2) throw e2;
}

function luckySeats(secrets: SecretsRow, players: PlayerRow[]): number[] {
  return players
    .filter((p) => p.seat !== null && secrets.lucky_player_ids.includes(p.id))
    .map((p) => p.seat!);
}

async function launch(sb: SupabaseClient, room: RoomRow, players: PlayerRow[]) {
  const seated = players.filter((p) => p.seat !== null);
  if (seated.length < 2) throw new ApiError('2人以上必要です');
  const secretsRow = await loadSecrets(sb, room.id);
  const { state, secrets } = startGame(
    seated.map((p) => ({ seat: p.seat!, isCpu: p.is_cpu })),
    room.settings,
    randomRng(),
    Date.now(),
  );
  secrets.luckySeats = luckySeats(secretsRow, players);
  await saveNewGame(sb, room, state, secrets.deck);
  return {};
}

async function addCpu(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ追加できます');
  const players = await loadPlayers(sb, room.id);
  const seat = nextFreeSeat(players);
  const cpuCount = players.filter((p) => p.is_cpu).length;
  const name = CPU_NAMES[cpuCount % CPU_NAMES.length];
  await insertPlayer(sb, room.id, name, seat, true);
  return {};
}

async function removeCpu(sb: SupabaseClient, room: RoomRow, me: PlayerRow, playerId: string) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ削除できます');
  const { error } = await sb.from('players').delete().eq('id', playerId).eq('room_id', room.id).eq('is_cpu', true);
  if (error) throw error;
  return {};
}

async function updateSettings(sb: SupabaseClient, room: RoomRow, me: PlayerRow, raw: unknown) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('ロビーでのみ変更できます');
  const settings = validateSettings(raw);
  const { error } = await sb.from('rooms').update({ settings, updated_at: new Date().toISOString() }).eq('id', room.id);
  if (error) throw error;
  return { settings };
}

async function startRoom(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'lobby') throw new ApiError('すでに開始しています');
  const players = await loadPlayers(sb, room.id);
  return launch(sb, room, players);
}

async function nextGame(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  requireHost(room, me);
  if (room.status !== 'finished') throw new ApiError('ゲーム終了後のみ再開できます');
  const players = await loadPlayers(sb, room.id);
  // 観戦者に空席を割り当てる
  let next = players.filter((p) => p.seat !== null).length === 0 ? 0 : Math.max(...players.filter((p) => p.seat !== null).map((p) => p.seat!)) + 1;
  for (const p of players) {
    if (p.seat !== null) continue;
    if (players.filter((q) => q.seat !== null).length >= MAX_PLAYERS) break;
    p.seat = next++;
    const { error } = await sb.from('players').update({ seat: p.seat }).eq('id', p.id);
    if (error) throw error;
  }
  return launch(sb, room, players);
}

async function toggleLucky(sb: SupabaseClient, room: RoomRow, me: PlayerRow) {
  const secrets = await loadSecrets(sb, room.id);
  const ids = new Set(secrets.lucky_player_ids);
  const lucky = !ids.has(me.id);
  if (lucky) ids.add(me.id);
  else ids.delete(me.id);
  const { error } = await sb.from('room_secrets').update({ lucky_player_ids: [...ids] }).eq('room_id', room.id);
  if (error) throw error;
  return { lucky };
}
```

- [ ] **Step 3: 型チェックと動作確認**

Run: `cd supabase/functions/act && deno check index.ts`
Expected: エラーなし。ローカル環境があれば create → add_cpu → start を curl し、`rooms.status = 'playing'` かつ `rooms.state.phase = 'turn'` になることを `npx supabase db query "select status, state->>'phase' from rooms"` で確認。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): ロビー操作・開始・次ゲーム・ラッキー切替"
```

---

### Task 12: ゲーム操作（hit / stay / choose_target / next_round / tick）

**Files:**
- Modify: `supabase/functions/act/api.ts`（`gameAction` スタブを置き換え）

- [ ] **Step 1: gameAction を実装**

```ts
async function saveGame(sb: SupabaseClient, room: RoomRow, state: PublicState, deck: Card[]): Promise<boolean> {
  const status = state.phase === 'game_end' ? 'finished' : 'playing';
  const { data, error } = await sb
    .from('rooms')
    .update({ state, status, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq('id', room.id)
    .eq('version', room.version)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return false;
  const { error: e2 } = await sb.from('room_secrets').update({ deck }).eq('room_id', room.id);
  if (e2) throw e2;
  return true;
}

function buildAction(
  state: PublicState,
  players: PlayerRow[],
  me: PlayerRow,
  room: RoomRow,
  action: string,
  payload: Record<string, unknown>,
  now: number,
): Action | null {
  if (action === 'tick') {
    const w = waitingOn(state);
    if (!w) return null;
    const waiting = players.find((p) => p.seat === w.seat);
    if (waiting?.is_cpu) {
      return state.autoAt !== null && state.autoAt <= now ? cpuDecide(state, w.seat) : null;
    }
    return state.deadline !== null && state.deadline <= now ? { type: 'timeout' } : null;
  }
  if (action === 'next_round') {
    requireHost(room, me);
    return { type: 'next_round' };
  }
  if (me.seat === null) throw new ApiError('観戦中は操作できません');
  if (action === 'hit' || action === 'stay') return { type: action, seat: me.seat };
  if (action === 'choose_target') {
    const targetSeat = Number(payload.targetSeat);
    if (!Number.isInteger(targetSeat)) throw new ApiError('対象が不正です');
    return { type: 'choose_target', seat: me.seat, targetSeat };
  }
  throw new ApiError('不明な操作です');
}

async function gameAction(
  sb: SupabaseClient,
  code: string,
  me: PlayerRow,
  action: string,
  payload: Record<string, unknown>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await loadRoom(sb, code);
    if (room.status !== 'playing' || !room.state) throw new ApiError('ゲーム中ではありません');
    const players = await loadPlayers(sb, room.id);
    const secretsRow = await loadSecrets(sb, room.id);
    const secrets: Secrets = { deck: secretsRow.deck, luckySeats: luckySeats(secretsRow, players) };
    const now = Date.now();
    const engineAction = buildAction(room.state, players, me, room, action, payload, now);
    if (!engineAction) return { noop: true };
    const result = applyAction(room.state, secrets, engineAction, randomRng(), now);
    if (await saveGame(sb, room, result.state, result.secrets.deck)) return {};
  }
  throw new ApiError('混み合っています。もう一度お試しください');
}
```

- [ ] **Step 2: 型チェック**

Run: `cd supabase/functions/act && deno check index.ts`
Expected: エラーなし。`Secrets` 型が未使用警告になる場合はそのままで可。

- [ ] **Step 3: ローカルで一連の流れを確認（Docker がある場合）**

create → join（2人目）→ start → 手番の人が hit → もう一方が stay … と curl で進め、`rooms.state` の `turnSeat` / `phase` が動くこと、`tick` が `{"ok":true,"noop":true}` を返すことを確認する。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): ゲーム操作と tick（CPU/時間切れ）"
```

---
### Task 13: Web クライアント雛形（Vite + React + Tailwind + Supabase 接続）

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`, `apps/web/index.html`, `apps/web/.env.example`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/lib/api.ts`

- [ ] **Step 1: パッケージ設定**

`apps/web/package.json`:
```json
{
  "name": "@lucky7/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p . && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@lucky7/engine": "*",
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ラッキーセブン',
        short_name: 'ラッキー7',
        description: '友達と遊ぶプレス・ユア・ラック カードゲーム',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  resolve: {
    alias: { '@lucky7/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts') },
  },
  server: { fs: { allow: [path.resolve(__dirname, '../..')] } },
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "paths": { "@lucky7/engine": ["../../packages/engine/src/index.ts"] }
  },
  "include": ["src", "vite.config.ts"]
}
```
`@types/node` を devDependencies に追加する: `npm i -D -w @lucky7/web @types/node`。

`apps/web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: { '0%': { transform: 'scale(0.4) rotate(-8deg)', opacity: '0' }, '100%': { transform: 'scale(1) rotate(0)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
        floatUp: { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-60px)', opacity: '0' } },
      },
      animation: { pop: 'pop 0.25s ease-out', shake: 'shake 0.4s ease-in-out', floatUp: 'floatUp 1.8s ease-out forwards' },
    },
  },
  plugins: [],
};
```

`apps/web/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icon.svg" />
    <title>ラッキーセブン</title>
  </head>
  <body class="bg-slate-900 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#0f172a"/><text x="64" y="92" font-size="84" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#fbbf24">7</text></svg>
```

`apps/web/.env.example`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

- [ ] **Step 2: エントリと共通ライブラリ**

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`apps/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { -webkit-tap-highlight-color: transparent; user-select: none; }
```

`apps/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
```

`apps/web/src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/r/:code" element={<Room />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

`apps/web/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } },
);
```

`apps/web/src/lib/session.ts`:
```ts
export interface Session {
  playerId: string;
  token: string;
}

const key = (code: string) => `lucky7:session:${code.toUpperCase()}`;
const NAME_KEY = 'lucky7:name';

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(code: string, s: Session) {
  try { localStorage.setItem(key(code), JSON.stringify(s)); } catch { /* ignore */ }
}
export function clearSession(code: string) {
  try { localStorage.removeItem(key(code)); } catch { /* ignore */ }
}
export function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}
```

`apps/web/src/lib/api.ts`:
```ts
import { supabase } from './supabase';
import { loadSession } from './session';

export type ActResult = Record<string, unknown> & { ok: true };

export async function act(
  action: string,
  opts: { code?: string; payload?: Record<string, unknown>; anonymous?: boolean } = {},
): Promise<ActResult> {
  const session = opts.code && !opts.anonymous ? loadSession(opts.code) : null;
  const { data, error } = await supabase.functions.invoke('act', {
    body: { action, code: opts.code, playerId: session?.playerId, token: session?.token, payload: opts.payload ?? {} },
  });
  if (error) {
    // FunctionsHttpError の場合は本文の error を取り出す
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        throw new Error(body.error ?? error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) throw e;
      }
    }
    throw new Error(error.message);
  }
  if (!data?.ok) throw new Error(data?.error ?? '不明なエラー');
  return data as ActResult;
}
```

- [ ] **Step 3: 仮ページを置いてビルド確認**

`apps/web/src/pages/Home.tsx`（仮）:
```tsx
export default function Home() {
  return <div className="p-6 text-2xl font-bold">ラッキーセブン</div>;
}
```
`apps/web/src/pages/Room.tsx`（仮）:
```tsx
import { useParams } from 'react-router-dom';
export default function Room() {
  const { code } = useParams();
  return <div className="p-6">ルーム {code}</div>;
}
```

Run: `npm install && npm run build`
Expected: `dist/` が生成され、`tsc` エラーなし。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): Vite+React+Tailwind 雛形と Supabase 接続"
```

---

### Task 14: ルーム購読フック・ホーム・参加フォーム

**Files:**
- Create: `apps/web/src/hooks/useRoom.ts`, `apps/web/src/components/JoinForm.tsx`
- Modify: `apps/web/src/pages/Home.tsx`, `apps/web/src/pages/Room.tsx`

- [ ] **Step 1: useRoom フック**

`apps/web/src/hooks/useRoom.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import type { PublicState, Settings } from '@lucky7/engine';
import { supabase } from '../lib/supabase';

export interface RoomRow {
  id: string;
  code: string;
  host_player_id: string | null;
  status: 'lobby' | 'playing' | 'finished';
  settings: Settings;
  state: PublicState | null;
  version: number;
}
export interface PlayerRow {
  id: string;
  name: string;
  seat: number | null;
  is_cpu: boolean;
}

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('players')
      .select('id, name, seat, is_cpu')
      .eq('room_id', roomId)
      .order('seat', { ascending: true, nullsFirst: false })
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data as PlayerRow[]);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (error || !data) {
      setError('ルームが見つかりません');
      setLoading(false);
      return null;
    }
    setRoom(data as RoomRow);
    await fetchPlayers(data.id);
    setLoading(false);
    return data as RoomRow;
  }, [code, fetchPlayers]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const r = await refresh();
      if (!r || cancelled) return;
      channel = supabase
        .channel(`room:${r.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${r.id}` }, (payload) => {
          setRoom((prev) => {
            const next = payload.new as RoomRow;
            return prev && prev.version > next.version ? prev : next;
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${r.id}` }, () => {
          void fetchPlayers(r.id);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void refresh();
        });
    })();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, fetchPlayers]);

  return { room, players, error, loading, refresh };
}
```

- [ ] **Step 2: ホーム画面**

`apps/web/src/pages/Home.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { act } from '../lib/api';
import { loadName, saveName, saveSession } from '../lib/session';

export default function Home() {
  const nav = useNavigate();
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const r = await act('create', { payload: { name }, anonymous: true });
      saveSession(r.code as string, { playerId: r.playerId as string, token: r.token as string });
      nav(`/r/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    saveName(name);
    if (code.trim().length !== 6) { setError('ルームコードは6文字です'); return; }
    nav(`/r/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
      <h1 className="text-5xl font-black tracking-tight">
        ラッキー<span className="text-amber-400">7</span>
      </h1>
      <div className="w-full max-w-sm space-y-4">
        <label className="block">
          <span className="text-sm text-slate-400">ニックネーム</span>
          <input
            className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 ring-amber-400"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: よしてつ"
          />
        </label>
        <button
          className="w-full rounded-xl bg-amber-400 text-slate-900 font-bold py-3 text-lg disabled:opacity-40"
          disabled={!name.trim() || busy}
          onClick={create}
        >
          ルームを作る
        </button>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-lg tracking-widest uppercase outline-none focus:ring-2 ring-amber-400"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="コード"
          />
          <button
            className="rounded-xl bg-slate-700 px-5 font-bold disabled:opacity-40"
            disabled={!name.trim() || busy}
            onClick={join}
          >
            参加
          </button>
        </div>
        {error && <p className="text-rose-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 参加フォーム**

`apps/web/src/components/JoinForm.tsx`:
```tsx
import { useState } from 'react';
import { act } from '../lib/api';
import { loadName, saveName, saveSession } from '../lib/session';

export default function JoinForm({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState(loadName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const r = await act('join', { code, payload: { name }, anonymous: true });
      saveSession(code, { playerId: r.playerId as string, token: r.token as string });
      onJoined();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-slate-400">ルーム <span className="font-mono text-2xl text-amber-400">{code}</span></div>
      <input
        className="w-full max-w-sm rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 ring-amber-400"
        value={name}
        maxLength={12}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
      <button
        className="w-full max-w-sm rounded-xl bg-amber-400 text-slate-900 font-bold py-3 text-lg disabled:opacity-40"
        disabled={!name.trim() || busy}
        onClick={join}
      >
        参加する
      </button>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: ルームページ（状態で画面を切り替え）**

`apps/web/src/pages/Room.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { clearSession, loadSession } from '../lib/session';
import { act } from '../lib/api';
import JoinForm from '../components/JoinForm';
import Lobby from '../components/Lobby';
import Table from '../components/Table';
import Result from '../components/Result';

export default function Room() {
  const code = (useParams().code ?? '').toUpperCase();
  const { room, players, error, loading, refresh } = useRoom(code);
  const [session, setSession] = useState(() => loadSession(code));
  const [checked, setChecked] = useState(false);

  // 保存済みセッションの有効性確認（再接続）
  useEffect(() => {
    if (!session) { setChecked(true); return; }
    act('join', { code })
      .then(() => setChecked(true))
      .catch(() => { clearSession(code); setSession(null); setChecked(true); });
  }, [code, session]);

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-rose-400">{error}</p>
        <Link className="underline" to="/">ホームへ</Link>
      </div>
    );
  }
  if (loading || !room || !checked) return <div className="p-6 text-slate-400">読み込み中…</div>;
  if (!session) {
    return <JoinForm code={code} onJoined={() => { setSession(loadSession(code)); void refresh(); }} />;
  }
  const me = players.find((p) => p.id === session.playerId);
  if (!me) return <div className="p-6 text-slate-400">参加処理中…</div>;
  const isHost = room.host_player_id === me.id;

  if (room.status === 'lobby') return <Lobby room={room} players={players} me={me} isHost={isHost} />;
  if (room.status === 'finished' && room.state?.phase === 'game_end') {
    return <Result room={room} players={players} me={me} isHost={isHost} />;
  }
  return <Table room={room} players={players} me={me} isHost={isHost} />;
}
```

`Lobby` / `Table` / `Result` は次以降のタスクで作成する。このタスクの時点では以下の仮ファイルを置く:

`apps/web/src/components/Lobby.tsx`, `Table.tsx`, `Result.tsx`（3つとも同じ雛形、名前だけ変える）:
```tsx
import type { PlayerRow, RoomRow } from '../hooks/useRoom';
export interface ScreenProps { room: RoomRow; players: PlayerRow[]; me: PlayerRow; isHost: boolean }
export default function Lobby({ room }: ScreenProps) {
  return <div className="p-6">Lobby {room.code}</div>;
}
```

- [ ] **Step 5: ビルドと手動確認**

Run: `npm run build`
Expected: エラーなし。`.env.local` に Supabase の URL/anon key を入れて `npm run dev` → ホームで名前入力 →「ルームを作る」→ `#/r/XXXXXX` に遷移し `Lobby XXXXXX` が表示される。別ブラウザ（シークレット）で同 URL を開くと参加フォーム → 参加後にロビー表示。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): ルーム購読・ホーム・参加フォーム"
```

---
### Task 15: ロビー画面

**Files:**
- Modify: `apps/web/src/components/Lobby.tsx`

- [ ] **Step 1: 実装**

`apps/web/src/components/Lobby.tsx`:
```tsx
import { useState } from 'react';
import type { Settings } from '@lucky7/engine';
import type { PlayerRow, RoomRow } from '../hooks/useRoom';
import { act } from '../lib/api';

export interface ScreenProps { room: RoomRow; players: PlayerRow[]; me: PlayerRow; isHost: boolean }

const TURN_OPTIONS: { label: string; value: Settings['turnSeconds'] }[] = [
  { label: '20秒', value: 20 }, { label: '1分', value: 60 }, { label: '無制限', value: null },
];
const POINT_TARGETS = [100, 200, 300];
const ROUND_TARGETS = [3, 5, 10];

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'} disabled:cursor-default`}
    >
      {children}
    </button>
  );
}

export default function Lobby({ room, players, me, isHost }: ScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seated = players.filter((p) => p.seat !== null);
  const url = `${location.origin}${location.pathname}#/r/${room.code}`;

  const run = async (action: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try { await act(action, { code: room.code, payload }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const setSettings = (patch: Partial<Settings>) => {
    const next: Settings = { ...room.settings, ...patch };
    if (patch.endMode && patch.endMode !== room.settings.endMode) next.target = patch.endMode === 'points' ? 200 : 5;
    void run('update_settings', { settings: next });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('この URL を共有してください', url); }
  };

  return (
    <div className="min-h-full p-5 max-w-lg mx-auto flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">ラッキー<span className="text-amber-400">7</span></h1>
        <div className="text-right">
          <div className="text-xs text-slate-400">ルームコード</div>
          <div className="font-mono text-2xl tracking-widest text-amber-400">{room.code}</div>
        </div>
      </header>

      <button onClick={copy} className="rounded-xl bg-slate-800 py-3 font-bold">
        {copied ? 'コピーしました' : '招待URLをコピー'}
      </button>

      <section>
        <h2 className="text-sm text-slate-400 mb-2">参加者 {seated.length}/12</h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3">
              <span className="font-bold flex-1">
                {p.name}
                {p.id === room.host_player_id && <span className="ml-2 text-xs text-amber-400">ホスト</span>}
                {p.id === me.id && <span className="ml-2 text-xs text-slate-400">あなた</span>}
                {p.seat === null && <span className="ml-2 text-xs text-slate-500">観戦</span>}
              </span>
              {p.is_cpu && <span className="text-xs rounded bg-slate-700 px-2 py-0.5">CPU</span>}
              {p.is_cpu && isHost && (
                <button disabled={busy} onClick={() => run('remove_cpu', { playerId: p.id })} className="text-slate-400 text-sm">削除</button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <button disabled={busy || seated.length >= 12} onClick={() => run('add_cpu')} className="mt-3 w-full rounded-xl border border-slate-700 py-2 text-sm disabled:opacity-40">
            ＋ CPU を追加
          </button>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm text-slate-400 mb-2">手番の制限時間</h2>
          <div className="flex gap-2">
            {TURN_OPTIONS.map((o) => (
              <Chip key={String(o.value)} active={room.settings.turnSeconds === o.value} disabled={!isHost || busy} onClick={() => setSettings({ turnSeconds: o.value })}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm text-slate-400 mb-2">終了条件</h2>
          <div className="flex gap-2 mb-2">
            <Chip active={room.settings.endMode === 'points'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'points' })}>目標点</Chip>
            <Chip active={room.settings.endMode === 'rounds'} disabled={!isHost || busy} onClick={() => setSettings({ endMode: 'rounds' })}>ラウンド数</Chip>
          </div>
          <div className="flex gap-2">
            {(room.settings.endMode === 'points' ? POINT_TARGETS : ROUND_TARGETS).map((t) => (
              <Chip key={t} active={room.settings.target === t} disabled={!isHost || busy} onClick={() => setSettings({ target: t })}>
                {t}{room.settings.endMode === 'points' ? '点' : 'R'}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {isHost ? (
        <button disabled={busy || seated.length < 2} onClick={() => run('start')} className="rounded-xl bg-amber-400 text-slate-900 font-bold py-4 text-lg disabled:opacity-40">
          ゲーム開始（{seated.length}人）
        </button>
      ) : (
        <p className="text-center text-slate-400">ホストの開始を待っています…</p>
      )}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 手動確認**

Run: `npm run build && npm run dev`
Expected: ホストは CPU 追加・設定変更・開始ができ、別ブラウザの参加者にはリアルタイムで反映される。開始すると仮の `Table` が表示される。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): ロビー画面"
```

---

### Task 16: 卓画面（カード・手番・タイマー・対象選択・ラウンド集計・tick）

**Files:**
- Create: `apps/web/src/components/CardView.tsx`, `PlayerRow.tsx`, `Controls.tsx`, `Timer.tsx`, `TargetModal.tsx`, `RoundEndOverlay.tsx`, `EventToast.tsx`
- Create: `apps/web/src/hooks/useTicker.ts`
- Modify: `apps/web/src/components/Table.tsx`

- [ ] **Step 1: カード表示**

`apps/web/src/components/CardView.tsx`:
```tsx
import type { Card } from '@lucky7/engine';

export const ACTION_LABEL: Record<string, string> = { freeze: '氷結', triple: '三連', insurance: '保険' };

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'add') return `+${card.value}`;
  if (card.kind === 'mul') return '×2';
  return ACTION_LABEL[card.action];
}

export default function CardView({ card, small = false, animate = false }: { card: Card; small?: boolean; animate?: boolean }) {
  const base = small ? 'h-10 w-7 text-sm' : 'h-14 w-10 text-lg';
  const color =
    card.kind === 'number' ? 'bg-slate-100 text-slate-900'
    : card.kind === 'action' ? 'bg-sky-500 text-white'
    : 'bg-amber-400 text-slate-900';
  return (
    <div className={`${base} ${color} ${animate ? 'animate-pop' : ''} rounded-md flex items-center justify-center font-black shadow`}>
      {cardLabel(card)}
    </div>
  );
}
```

- [ ] **Step 2: プレイヤー行とタイマー**

`apps/web/src/components/Timer.tsx`:
```tsx
import { useEffect, useState } from 'react';

export default function Timer({ deadline, total }: { deadline: number | null; total: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null || total === null) return null;
  const remain = Math.max(0, Math.ceil((deadline - now) / 1000));
  const ratio = Math.max(0, Math.min(1, (deadline - now) / (total * 1000)));
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} stroke="#334155" strokeWidth="4" fill="none" />
      <circle cx="18" cy="18" r={r} stroke={remain <= 5 ? '#f43f5e' : '#fbbf24'} strokeWidth="4" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="11" fill="#e2e8f0" fontWeight="700">{remain}</text>
    </svg>
  );
}
```

`apps/web/src/components/PlayerRow.tsx`:
```tsx
import type { PlayerState } from '@lucky7/engine';
import { currentScore } from '@lucky7/engine';
import CardView from './CardView';

const STATUS: Record<PlayerState['status'], { label: string; cls: string }> = {
  active: { label: '', cls: '' },
  stayed: { label: '確定', cls: 'bg-emerald-600' },
  busted: { label: 'バースト', cls: 'bg-rose-600' },
};

export default function PlayerRow({
  player, name, isMe, isTurn, isChoosing, lastCardId, shake, onNamePress,
}: {
  player: PlayerState; name: string; isMe: boolean; isTurn: boolean; isChoosing: boolean;
  lastCardId: string | null; shake: boolean;
  onNamePress?: { onPointerDown: () => void; onPointerUp: () => void; onPointerLeave: () => void };
}) {
  const st = STATUS[player.status];
  const score = player.status === 'active' ? currentScore(player) : player.roundScore;
  return (
    <div className={`rounded-2xl p-3 transition ${isTurn || isChoosing ? 'bg-slate-700 ring-2 ring-amber-400' : 'bg-slate-800'} ${player.status === 'busted' ? 'opacity-60' : ''} ${shake ? 'animate-shake' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold truncate select-none" {...onNamePress}>
          {name}{isMe && <span className="ml-1 text-xs text-slate-400">(あなた)</span>}
        </span>
        {player.hasInsurance && <span title="保険" className="text-xs rounded bg-sky-600 px-1.5 py-0.5">保険</span>}
        {st.label && <span className={`text-xs rounded px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>}
        {isChoosing && <span className="text-xs text-amber-300">選択中…</span>}
        <span className="ml-auto text-sm text-slate-400">今 <b className="text-slate-100">{score}</b> / 計 <b className="text-slate-100">{player.totalScore}</b></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 min-h-[2.5rem]">
        {player.cards.map((c) => <CardView key={c.id} card={c} small animate={c.id === lastCardId} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 操作ボタン・対象選択・集計・イベント表示**

`apps/web/src/components/Controls.tsx`:
```tsx
export default function Controls({ busy, onHit, onStay }: { busy: boolean; onHit: () => void; onStay: () => void }) {
  return (
    <div className="flex gap-3">
      <button disabled={busy} onClick={onHit} className="flex-1 rounded-2xl bg-amber-400 text-slate-900 font-black py-4 text-xl disabled:opacity-40">引く</button>
      <button disabled={busy} onClick={onStay} className="flex-1 rounded-2xl bg-slate-600 font-black py-4 text-xl disabled:opacity-40">降りる</button>
    </div>
  );
}
```

`apps/web/src/components/TargetModal.tsx`:
```tsx
import type { Pending } from '@lucky7/engine';

const TITLE: Record<Pending['type'], string> = {
  freeze: '氷結: 誰を降ろす？',
  triple: '三連: 誰に3枚引かせる？',
  give_insurance: '保険: 誰に渡す？',
};

export default function TargetModal({
  pending, candidates, nameOf, mySeat, busy, onChoose,
}: { pending: Pending; candidates: number[]; nameOf: (seat: number) => string; mySeat: number; busy: boolean; onChoose: (seat: number) => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-3">
        <h2 className="font-bold text-lg">{TITLE[pending.type]}</h2>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {candidates.map((seat) => (
            <button key={seat} disabled={busy} onClick={() => onChoose(seat)} className="rounded-xl bg-slate-700 py-3 font-bold disabled:opacity-40">
              {seat === mySeat ? '自分' : nameOf(seat)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

`apps/web/src/components/RoundEndOverlay.tsx`:
```tsx
import type { PublicState } from '@lucky7/engine';

export default function RoundEndOverlay({
  state, nameOf, isHost, busy, onNext,
}: { state: PublicState; nameOf: (seat: number) => string; isHost: boolean; busy: boolean; onNext: () => void }) {
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const sevenSeat = state.events.find((e) => e.type === 'seven')?.seat;
  return (
    <div className="fixed inset-0 z-20 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
        <h2 className="text-xl font-black text-center">ラウンド {state.round} 終了</h2>
        {sevenSeat !== undefined && <p className="text-center text-amber-400 font-bold">{nameOf(sevenSeat)} がラッキーセブン達成！ +15</p>}
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => (
              <tr key={p.seat} className="border-t border-slate-700">
                <td className="py-2 font-bold">{nameOf(p.seat)}</td>
                <td className="py-2 text-right text-slate-400">+{p.roundScore}</td>
                <td className="py-2 text-right font-black text-lg">{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isHost ? (
          <button disabled={busy} onClick={onNext} className="w-full rounded-xl bg-amber-400 text-slate-900 font-bold py-3 disabled:opacity-40">次のラウンドへ</button>
        ) : (
          <p className="text-center text-slate-400 text-sm">ホストが次へ進めます…</p>
        )}
      </div>
    </div>
  );
}
```

`apps/web/src/components/EventToast.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { GameEvent } from '@lucky7/engine';
import { cardLabel } from './CardView';

export function describeEvent(e: GameEvent, nameOf: (seat: number) => string): string | null {
  switch (e.type) {
    case 'bust': return `${nameOf(e.seat)} がバースト！（${cardLabel(e.card)}）`;
    case 'insurance_used': return `${nameOf(e.seat)} が保険で回避`;
    case 'freeze': return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} を氷結`;
    case 'triple': return `${nameOf(e.seat)} が ${e.seat === e.targetSeat ? '自分' : nameOf(e.targetSeat)} に三連`;
    case 'give_insurance': return `${nameOf(e.seat)} が ${nameOf(e.targetSeat)} に保険を渡した`;
    case 'seven': return `${nameOf(e.seat)} がラッキーセブン達成！`;
    case 'timeout': return `${nameOf(e.seat)} は時間切れ`;
    case 'stay': return `${nameOf(e.seat)} が降りた`;
    default: return null;
  }
}

export default function EventToast({ events, version, nameOf }: { events: GameEvent[]; version: number; nameOf: (seat: number) => string }) {
  const [msgs, setMsgs] = useState<string[]>([]);
  useEffect(() => {
    const m = events.map((e) => describeEvent(e, nameOf)).filter((x): x is string => !!x);
    if (m.length === 0) return;
    setMsgs(m);
    const id = setTimeout(() => setMsgs([]), 2500);
    return () => clearTimeout(id);
    // version が変わった時だけ表示する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  if (msgs.length === 0) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 space-y-1 pointer-events-none">
      {msgs.map((m, i) => <div key={i} className="rounded-full bg-slate-100 text-slate-900 px-4 py-1.5 text-sm font-bold shadow">{m}</div>)}
    </div>
  );
}
```

- [ ] **Step 4: tick 駆動フック**

`apps/web/src/hooks/useTicker.ts`:
```ts
import { useEffect } from 'react';
import type { PublicState } from '@lucky7/engine';
import { act } from '../lib/api';

/** autoAt / deadline を過ぎたら tick を送る（全クライアントが送るが冪等） */
export function useTicker(code: string, state: PublicState | null, enabled: boolean) {
  const autoAt = state?.autoAt ?? null;
  const deadline = state?.deadline ?? null;
  useEffect(() => {
    if (!enabled) return;
    const target = autoAt ?? deadline;
    if (target === null) return;
    const jitter = Math.random() * 400;
    const delay = Math.max(0, target - Date.now()) + 50 + jitter;
    const id = setTimeout(() => { void act('tick', { code }).catch(() => {}); }, delay);
    return () => clearTimeout(id);
  }, [code, autoAt, deadline, enabled]);
}
```

- [ ] **Step 5: 卓画面本体**

`apps/web/src/components/Table.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { targetCandidates, waitingOn } from '@lucky7/engine';
import type { ScreenProps } from './Lobby';
import { act } from '../lib/api';
import { useTicker } from '../hooks/useTicker';
import PlayerRow from './PlayerRow';
import Controls from './Controls';
import Timer from './Timer';
import TargetModal from './TargetModal';
import RoundEndOverlay from './RoundEndOverlay';
import EventToast from './EventToast';

export default function Table({ room, players, me, isHost }: ScreenProps) {
  const state = room.state!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mySeat = me.seat;
  const nameOf = useMemo(() => {
    const map = new Map(players.filter((p) => p.seat !== null).map((p) => [p.seat!, p.name]));
    return (seat: number) => map.get(seat) ?? `座席${seat}`;
  }, [players]);

  useTicker(room.code, state, room.status === 'playing');

  const waiting = waitingOn(state);
  const myTurn = mySeat !== null && waiting?.seat === mySeat && waiting.kind === 'turn';
  const myChoice = mySeat !== null && state.pending?.bySeat === mySeat;
  const lastDraw = [...state.events].reverse().find((e) => e.type === 'draw');
  const lastCardId = lastDraw && lastDraw.type === 'draw' ? lastDraw.card.id : null;
  const bustSeats = new Set(state.events.filter((e) => e.type === 'bust').map((e) => e.seat));

  const run = async (action: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try { await act(action, { code: room.code, payload }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const ordered = [...state.players].sort((a, b) => (a.seat === mySeat ? -1 : b.seat === mySeat ? 1 : a.seat - b.seat));

  return (
    <div className="min-h-full max-w-lg mx-auto p-3 pb-32 space-y-2">
      <header className="flex items-center gap-3 px-1 py-2">
        <h1 className="text-xl font-black">ラッキー<span className="text-amber-400">7</span></h1>
        <span className="text-sm text-slate-400">R{state.round} ・ 山札 {state.deckCount}</span>
        <span className="ml-auto text-sm text-slate-300">
          {waiting ? (waiting.seat === mySeat ? 'あなたの番' : `${nameOf(waiting.seat)} の番`) : ''}
        </span>
        <Timer deadline={state.deadline} total={state.settings.turnSeconds} />
      </header>

      {ordered.map((p) => (
        <PlayerRow
          key={p.seat}
          player={p}
          name={nameOf(p.seat)}
          isMe={p.seat === mySeat}
          isTurn={waiting?.kind === 'turn' && waiting.seat === p.seat}
          isChoosing={state.pending?.bySeat === p.seat}
          lastCardId={lastCardId}
          shake={bustSeats.has(p.seat)}
        />
      ))}

      {mySeat === null && <p className="text-center text-slate-400 text-sm py-2">観戦中（次のゲームから参加できます）</p>}

      <div className="fixed bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
        <div className="max-w-lg mx-auto space-y-2">
          {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
          {myTurn && <Controls busy={busy} onHit={() => run('hit')} onStay={() => run('stay')} />}
        </div>
      </div>

      {myChoice && state.pending && mySeat !== null && (
        <TargetModal pending={state.pending} candidates={targetCandidates(state)} nameOf={nameOf} mySeat={mySeat} busy={busy}
          onChoose={(seat) => run('choose_target', { targetSeat: seat })} />
      )}
      {state.phase === 'round_end' && (
        <RoundEndOverlay state={state} nameOf={nameOf} isHost={isHost} busy={busy} onNext={() => run('next_round')} />
      )}
      <EventToast events={state.events} version={room.version} nameOf={nameOf} />
    </div>
  );
}
```

- [ ] **Step 6: ビルドと手動確認**

Run: `npm run build && npm run dev`
Expected: ホスト＋CPU2体で開始 → CPU が約1.5秒間隔で自動で引く/降りる → 自分の番で「引く」「降りる」が押せる → 氷結/三連を引くとモーダルが出る → 全員降りると集計オーバーレイ → 「次のラウンドへ」で継続。制限時間20秒で放置すると自動で降りる。

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): 卓画面（カード・手番・タイマー・対象選択・集計・tick）"
```

---

### Task 17: ラッキーモード長押し・リアクション・結果画面

**Files:**
- Create: `apps/web/src/hooks/useLongPress.ts`, `apps/web/src/components/ReactionBar.tsx`
- Modify: `apps/web/src/components/Table.tsx`, `apps/web/src/components/Result.tsx`

- [ ] **Step 1: 長押しフック**

`apps/web/src/hooks/useLongPress.ts`:
```ts
import { useRef } from 'react';

export function useLongPress(onLongPress: () => void, ms = 3000) {
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  return {
    onPointerDown: () => { clear(); timer.current = window.setTimeout(() => { timer.current = null; onLongPress(); }, ms); },
    onPointerUp: clear,
    onPointerLeave: clear,
  };
}
```

- [ ] **Step 2: リアクションバー（Broadcast）**

`apps/web/src/components/ReactionBar.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const EMOJIS = ['👍', '😱', '🔥', '😂'];
interface Floating { id: number; emoji: string; name: string; x: number }

export default function ReactionBar({ code, name }: { code: string; name: string }) {
  const [floating, setFloating] = useState<Floating[]>([]);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const ch = supabase.channel(`reactions:${code}`);
    ch.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const item: Floating = { id: seq.current++, emoji: payload.emoji, name: payload.name, x: 10 + Math.random() * 70 };
      setFloating((f) => [...f, item]);
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== item.id)), 1800);
    }).subscribe();
    channel.current = ch;
    return () => { void supabase.removeChannel(ch); channel.current = null; };
  }, [code]);

  const send = (emoji: string) => {
    void channel.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, name } });
  };

  return (
    <>
      <div className="flex justify-center gap-2">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => send(e)} className="h-10 w-10 rounded-full bg-slate-800 text-xl active:scale-90 transition">{e}</button>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-28 h-40 z-30">
        {floating.map((f) => (
          <div key={f.id} className="absolute animate-floatUp text-center" style={{ left: `${f.x}%` }}>
            <div className="text-3xl">{f.emoji}</div>
            <div className="text-[10px] text-slate-300">{f.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Table にラッキー長押しとリアクションを組み込む**

`apps/web/src/components/Table.tsx` を次のように変更する:

1. import を追加:
```tsx
import { useLongPress } from '../hooks/useLongPress';
import ReactionBar from './ReactionBar';
```
2. `Table` 関数内、`const [error, ...]` の直後に追加:
```tsx
  const [lucky, setLucky] = useState(false);
  const luckyPress = useLongPress(async () => {
    try {
      const r = await act('toggle_lucky', { code: room.code });
      setLucky(Boolean(r.lucky));
    } catch { /* 静かに無視 */ }
  });
```
3. ヘッダーのタイトルを次に置き換え（「7」の明度だけ変わる）:
```tsx
        <h1 className="text-xl font-black">ラッキー<span className={lucky ? 'text-amber-300' : 'text-amber-400/90'}>7</span></h1>
```
4. `PlayerRow` に自分の行だけ長押しハンドラを渡す:
```tsx
          onNamePress={p.seat === mySeat ? luckyPress : undefined}
```
5. 下部固定バーの `{myTurn && <Controls …/>}` の上に追加:
```tsx
          <ReactionBar code={room.code} name={me.name} />
```

- [ ] **Step 4: 結果画面**

`apps/web/src/components/Result.tsx`:
```tsx
import { useMemo, useState } from 'react';
import type { ScreenProps } from './Lobby';
import { act } from '../lib/api';

export default function Result({ room, players, me, isHost }: ScreenProps) {
  const state = room.state!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOf = useMemo(() => {
    const map = new Map(players.filter((p) => p.seat !== null).map((p) => [p.seat!, p.name]));
    return (seat: number) => map.get(seat) ?? `座席${seat}`;
  }, [players]);
  const rows = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const winners = new Set(state.winnerSeats ?? []);
  const iWon = me.seat !== null && winners.has(me.seat);

  const again = async () => {
    setBusy(true);
    setError(null);
    try { await act('next_game', { code: room.code }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-full max-w-lg mx-auto p-5 flex flex-col gap-6">
      <h1 className="text-3xl font-black text-center">{iWon ? '🎉 勝利！' : 'ゲーム終了'}</h1>
      <p className="text-center text-amber-400 font-bold">
        優勝: {[...winners].map(nameOf).join(' / ')}
      </p>
      <ol className="space-y-2">
        {rows.map((p, i) => (
          <li key={p.seat} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${winners.has(p.seat) ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}>
            <span className="w-6 font-black">{i + 1}</span>
            <span className="flex-1 font-bold">{nameOf(p.seat)}</span>
            <span className="font-black text-lg">{p.totalScore}</span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <button disabled={busy} onClick={again} className="rounded-xl bg-amber-400 text-slate-900 font-bold py-4 text-lg disabled:opacity-40">もう一回（同じメンバー）</button>
      ) : (
        <p className="text-center text-slate-400">ホストの操作を待っています…</p>
      )}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: ビルドと手動確認**

Run: `npm run build && npm run dev`
Expected: 自分の名前を3秒長押しすると「7」がわずかに明るくなり、その後は重複数字を引かなくなる（他プレイヤーの画面には何も出ない）。絵文字を押すと全員の画面に浮かぶ。目標点到達で結果画面 → ホストの「もう一回」で新ゲームが始まり、観戦者が席に入る。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): ラッキーモード長押し・リアクション・結果画面"
```

---

### Task 18: デプロイ設定と README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: GitHub Pages ワークフロー**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README**

`README.md`:
```markdown
# ラッキーセブン

友達と遊ぶオンライン カードゲーム（最大12人・CPU対戦あり）。

## 構成
- `packages/engine` ルールエンジン（純粋 TypeScript、Vitest）
- `supabase/` スキーマと Edge Function `act`
- `apps/web` Vite + React クライアント（PWA）

## 初回セットアップ
1. Supabase でプロジェクトを作成し、`Project URL` と `anon key` を控える
2. `npx supabase login` → `npx supabase link --project-ref <ref>`
3. `npx supabase db push` でテーブルを作成
4. `npm run sync-engine && npx supabase functions deploy act --no-verify-jwt`
5. `apps/web/.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を書く
6. `npm install && npm run dev`

## 公開（GitHub Pages）
リポジトリの Settings → Pages → Source を「GitHub Actions」にし、Secrets に
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を登録して `main` に push する。

## 開発
- `npm test` エンジンのテスト
- エンジンを変更したら `npm run sync-engine` してから Edge Function を再デプロイ
```

- [ ] **Step 3: 最終確認**

Run: `npm test && npm run build`
Expected: エンジンのテストが全て PASS、Web のビルドが成功。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: デプロイワークフローと README"
```
