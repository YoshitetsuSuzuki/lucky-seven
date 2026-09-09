import { useState } from 'react';
import { act } from '../lib/api';
import { LUCKY_ENABLED } from '../lib/flags';
import { loadLucky, saveLucky } from '../lib/session';
import { useLongPress } from './useLongPress';
import type { LongPressHandlers } from './useLongPress';

/** ビルドで無効化したときの、何もしないハンドラ一式 */
const NOOP: LongPressHandlers = {
  onPointerDown: () => {},
  onPointerUp: () => {},
  onPointerLeave: () => {},
  onPointerCancel: () => {},
  onPointerMove: () => {},
};

/** 名前の長押しで「7」の演出フラグを切り替える（失敗しても画面には出さない） */
export function useLuckyToggle(code: string, playerId: string) {
  const [lucky, setLucky] = useState(() => (LUCKY_ENABLED ? loadLucky(code, playerId) : false));
  const handlers = useLongPress(async () => {
    if (!LUCKY_ENABLED) return;
    // 通信の一時的な失敗のみ 1 回だけ再試行する
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await act('toggle_lucky', { code });
        const on = Boolean(r.lucky);
        setLucky(on);
        saveLucky(code, playerId, on);
        return;
      } catch { /* 静かに無視 */ }
    }
  });
  // VITE_ENABLE_LUCKY=0 のビルドでは完全に無効（長押ししても何も起きず、7 も明るくならない）
  if (!LUCKY_ENABLED) return { lucky: false, handlers: NOOP };
  return { lucky, handlers };
}
