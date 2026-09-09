import { useMemo } from 'react';
import type { RoomPlayer } from './useRoom';

/** 座席番号 → 表示名。未着席の座席はフォールバック表記にする */
export function useNameOf(players: RoomPlayer[]) {
  return useMemo(() => {
    const map = new Map(players.filter((p) => p.seat !== null).map((p) => [p.seat!, p.name]));
    return (seat: number) => map.get(seat) ?? `座席${seat}`;
  }, [players]);
}
