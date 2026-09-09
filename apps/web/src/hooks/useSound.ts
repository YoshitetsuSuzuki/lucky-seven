import { useEffect, useSyncExternalStore } from 'react';
import type { PublicState } from '@lucky7/engine';
import {
  handleVisibility,
  isBgmOn,
  isSfxOn,
  isTableBgmOn,
  playSfx,
  startBgm,
  stopBgm,
  subscribeSound,
} from '../lib/audio';
import type { SfxName } from '../lib/audio';

/** BGM の ON/OFF を React に橋渡しする */
export function useBgmEnabled(): boolean {
  return useSyncExternalStore(subscribeSound, isBgmOn, () => true);
}

/** 効果音の ON/OFF を React に橋渡しする */
export function useSfxEnabled(): boolean {
  return useSyncExternalStore(subscribeSound, isSfxOn, () => true);
}

/** 卓で BGM を鳴らす設定（既定 OFF） */
export function useTableBgm(): boolean {
  return useSyncExternalStore(subscribeSound, isTableBgmOn, () => false);
}

/**
 * この画面にいる間だけ BGM を鳴らす。
 * active=false（卓の既定）なら鳴らさず、ボタンで ON にした瞬間に鳴り始める。
 */
export function useBgm(active = true) {
  const on = useBgmEnabled();
  useEffect(() => {
    if (!active || !on) {
      stopBgm();
      return;
    }
    startBgm();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopBgm();
    };
  }, [active, on]);
}

const EVENT_SFX: Record<string, SfxName> = {
  bust: 'bust',
  freeze: 'freeze',
  triple: 'triple',
  insurance_used: 'insurance',
  give_insurance: 'insurance',
  seven: 'seven',
  stay: 'stay',
};

/** 残り何秒からカウント音を鳴らすか */
const TICK_FROM = 5;

/**
 * state.events を効果音へ写す。
 * めくる音（flip）は飛行アニメーション側（useCardFlights）が鳴らすのでここでは扱わない。
 */
export function useSound(state: PublicState | null, version: number) {
  const events = state?.events;
  useEffect(() => {
    if (!events) return;
    const played = new Set<SfxName>();
    for (const e of events) {
      const name = EVENT_SFX[e.type];
      if (!name || played.has(name)) continue;
      played.add(name);
      playSfx(name);
    }
    // version が変わったときだけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const deadline = state?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    let last = -1;
    const id = window.setInterval(() => {
      const remain = Math.ceil((deadline - Date.now()) / 1000);
      if (remain <= TICK_FROM && remain >= 1 && remain !== last) {
        last = remain;
        playSfx('tick');
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [deadline]);
}
