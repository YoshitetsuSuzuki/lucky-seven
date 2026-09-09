import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Card, GameEvent } from '@lucky7/engine';
import { playSfx } from '../lib/audio';

export interface FlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Flight {
  key: string;
  card: Card;
  /** land: 手札の枠へ着地して実体と入れ替わる / ghost: 捨て札へ飛んで消える */
  mode: 'land' | 'ghost';
  from: FlightRect;
  to: FlightRect;
  delay: number;
}

/** 1枚の飛行時間 */
export const FLIGHT_MS = 450;
/** 複数枚（配り・三連）のずらし */
export const FLIGHT_STAGGER = 320;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
/** めくれて表が見え始める割合 */
const REVEAL_AT = 0.62;
/** 捨て札へ消えるまでの余韻 */
const GHOST_HOLD_MS = 420;
const GHOST_FADE_MS = 260;

const EMPTY: ReadonlySet<string> = new Set<string>();

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function rectOf(el: Element): FlightRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function findCardEl(root: HTMLElement | null, id: string): HTMLElement | null {
  if (!root || !/^[\w.-]+$/.test(id)) return null;
  return root.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
}

/** その event が「山札から出てきた1枚」なら、そのカードを返す */
function drawnCard(e: GameEvent): { card: Card; toHand: boolean } | null {
  if (e.type === 'draw') return { card: e.card, toHand: true };
  if (e.type === 'bust') return { card: e.card, toHand: true };
  if (e.type === 'insurance_used' || e.type === 'bonus_discard') return { card: e.card, toHand: false };
  return null;
}

/**
 * room.version が進むたび、その版で引かれたカードを山札から手元へ飛ばす。
 * - 飛行中の実体カードは hidden で隠し、着地で入れ替える
 * - prefers-reduced-motion なら演出を丸ごと省く
 * - 版が進んだ／画面を離れたときは走っているアニメーションを必ず止める
 */
export function useCardFlights({
  version,
  events,
  deckRef,
  discardRef,
  boardRef,
}: {
  version: number;
  events: GameEvent[] | undefined;
  deckRef: RefObject<HTMLElement>;
  discardRef: RefObject<HTMLElement>;
  boardRef: RefObject<HTMLElement>;
}) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(EMPTY);

  const anims = useRef<Animation[]>([]);
  const timers = useRef<number[]>([]);
  const started = useRef<Set<string>>(new Set());
  const settled = useRef<Set<string>>(new Set());
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const stopAll = useCallback(() => {
    for (const a of anims.current) {
      try {
        a.cancel();
      } catch {
        /* すでに終了 */
      }
    }
    anims.current = [];
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    started.current.clear();
    settled.current.clear();
  }, []);

  const remove = useCallback((key: string) => {
    setFlights((prev) => (prev.some((f) => f.key === key) ? prev.filter((f) => f.key !== key) : prev));
  }, []);

  const reveal = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    stopAll();
    const evs = eventsRef.current;
    const deck = deckRef.current;
    if (!evs || evs.length === 0 || !deck) {
      setFlights([]);
      setHiddenIds(EMPTY);
      return stopAll;
    }
    const from = rectOf(deck);
    // 山札が測れない（描画前）／動きを減らす設定なら演出しない
    if (from.width === 0 || reducedMotion()) {
      setFlights([]);
      setHiddenIds(EMPTY);
      return stopAll;
    }
    const discardRect = discardRef.current ? rectOf(discardRef.current) : null;

    const list: Flight[] = [];
    const hide = new Set<string>();
    for (const e of evs) {
      const d = drawnCard(e);
      if (!d) continue;
      const el = d.toHand ? findCardEl(boardRef.current, d.card.id) : null;
      let to: FlightRect | null = null;
      let mode: Flight['mode'] = 'ghost';
      if (el) {
        to = rectOf(el);
        mode = 'land';
      } else if (discardRect) {
        // 手札に残らない札（アクション・保険で回避・達成後の余り）は捨て札へ
        to = discardRect;
      }
      if (!to) continue;
      list.push({ key: `${version}:${list.length}`, card: d.card, mode, from, to, delay: list.length * FLIGHT_STAGGER });
      if (mode === 'land') hide.add(d.card.id);
    }

    setFlights(list);
    setHiddenIds(hide.size === 0 ? EMPTY : hide);
    return stopAll;
    // version が進んだときだけ演出する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  /** FlyingCards の各要素から、マウント直後に一度だけ呼ばれる */
  const startFlight = useCallback(
    (f: Flight, wrap: HTMLElement, inner: HTMLElement) => {
      if (started.current.has(f.key)) return;
      started.current.add(f.key);

      const dx = f.to.left - f.from.left;
      const dy = f.to.top - f.from.top;
      const scale = f.from.width > 0 ? f.to.width / f.from.width : 1;
      const mid = (1 + scale) / 2;

      const move = wrap.animate(
        [
          { transform: 'translate(0px,0px) rotate(-7deg) scale(1)' },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 42}px) rotate(6deg) scale(${mid})`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${scale})` },
        ],
        { duration: FLIGHT_MS, delay: f.delay, easing: EASE, fill: 'both' },
      );
      const flip = inner.animate(
        [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(0deg)', offset: REVEAL_AT },
          { transform: 'rotateY(180deg)' },
        ],
        { duration: FLIGHT_MS, delay: f.delay, easing: 'ease-out', fill: 'both' },
      );
      anims.current.push(move, flip);

      timers.current.push(window.setTimeout(() => playSfx('flip'), f.delay + FLIGHT_MS * REVEAL_AT));

      // 着地の後始末。タブが裏にいると WAAPI の finished が解決しないことがあるため、
      // アニメーションの完了と保険のタイマーの「早い方」で必ず一度だけ実行する。
      const settle = () => {
        if (settled.current.has(f.key)) return;
        settled.current.add(f.key);
        if (f.mode === 'land') {
          reveal(f.card.id);
          // 実体が出るのを待ってから重ねを外す（ちらつき防止）
          timers.current.push(window.setTimeout(() => remove(f.key), 70));
          return;
        }
        const fade = wrap.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: GHOST_FADE_MS,
          delay: GHOST_HOLD_MS,
          easing: 'ease-in',
          fill: 'both',
        });
        anims.current.push(fade);
        timers.current.push(window.setTimeout(() => remove(f.key), GHOST_HOLD_MS + GHOST_FADE_MS + 40));
      };

      move.finished.then(settle).catch(() => undefined);
      timers.current.push(window.setTimeout(settle, f.delay + FLIGHT_MS + 200));
    },
    [remove, reveal],
  );

  return { flights, hiddenIds, startFlight };
}
