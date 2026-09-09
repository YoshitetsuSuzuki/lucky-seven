import { useState } from 'react';
import { act } from '../lib/api';
import { loadLucky, saveLucky } from '../lib/session';
import { useLongPress } from './useLongPress';

/** 名前の長押しで「7」の演出フラグを切り替える（失敗しても画面には出さない） */
export function useLuckyToggle(code: string, playerId: string) {
  const [lucky, setLucky] = useState(() => loadLucky(code, playerId));
  const handlers = useLongPress(async () => {
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
  return { lucky, handlers };
}
