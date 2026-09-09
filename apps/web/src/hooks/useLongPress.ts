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
