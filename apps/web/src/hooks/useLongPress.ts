import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** 長押しハンドラ一式（PlayerRow などにスプレッドして使う） */
export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onPointerMove: (e: ReactPointerEvent) => void;
}

/** この距離（px）を超えて指が動いたらスクロールとみなして長押しを中止する */
const MOVE_TOLERANCE = 10;

export function useLongPress(onLongPress: () => void, ms = 3000): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  };
  return {
    onPointerDown: (e) => {
      clear();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { timer.current = null; start.current = null; onLongPress(); }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove: (e) => {
      if (timer.current === null || start.current === null) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) clear();
    },
  };
}
