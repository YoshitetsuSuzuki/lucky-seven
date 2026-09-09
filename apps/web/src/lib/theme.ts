import { useSyncExternalStore } from 'react';

/**
 * 見た目のテーマ。
 *
 * 色・質感のほとんどは `src/index.css` の `:root[data-theme="…"]` に置いた
 * CSS 変数で表現する（React の再描画なしで切り替わる）。
 * ここに置くのは CSS だけでは書けないもの——
 *   ・0〜12 の数字色と、その上に乗せる文字色（コントラストから機械的に決める）
 *   ・カード裏面の模様の種類と配色
 *   ・テーマ選択 UI に出す見本の色
 * だけ。
 */

export type ThemeId = 'salon' | 'wa' | 'candy' | 'arcade' | 'picnic';

export const THEME_IDS: ThemeId[] = ['salon', 'wa', 'candy', 'arcade', 'picnic'];
export const DEFAULT_THEME: ThemeId = 'salon';
const KEY = 'lucky7:theme';

/** カード裏面の模様 */
export type BackPattern = 'salon' | 'seigaiha' | 'candy' | 'arcade' | 'gingham';

export interface CardBackStyle {
  pattern: BackPattern;
  /** 地の色（上→下のグラデーション） */
  bg: [string, string];
  /** 模様の色 */
  ink: string;
  /** 外側の細い縁 */
  frame: string;
  /** 内側のさらに細い縁 */
  frameSoft: string;
}

/**
 * 数字の上に乗せる文字色の決め方。
 *  contrast … 明／暗のうちコントラストが高い方を選ぶ
 *  light    … つねに明るい方（サロンの既存の見た目を変えないため）
 *  self     … 数字色そのもの（アーケード：暗い面にネオンの数字）
 */
type InkMode = 'contrast' | 'light' | 'self';

export interface Theme {
  id: ThemeId;
  name: string;
  tagline: string;
  /** 表題の上に置く小さな欧文 */
  eyebrow: string;
  /** 暗いテーマか（ステータスバーの色など、CSS の外で使う） */
  dark: boolean;
  /** テーマ色（ネイティブのステータスバー / PWA の theme-color） */
  themeColor: string;
  /** 0〜12 の地色 */
  numbers: string[];
  /** 数字の上に乗せる文字の候補 */
  ink: { light: string; dark: string };
  inkMode: InkMode;
  back: CardBackStyle;
  /** テーマ選択 UI の見本（卓の色・地の色・差し色・カードの紙色） */
  swatch: { bg: string; felt: string; accent: string; card: string };
}

/* ---------------- 5つのテーマ ---------------- */

const SALON: Theme = {
  id: 'salon',
  name: '深夜のカードサロン',
  tagline: '漆黒の卓に、ランプの金がひとすじ',
  eyebrow: 'MIDNIGHT CARD SALON',
  dark: true,
  themeColor: '#0a0e1a',
  numbers: [
    '#5b6470', '#c0392b', '#e67e22', '#d4a017', '#7cb518', '#1e8f5a', '#159a9c',
    '#2a7de1', '#4b4bd6', '#7d3cd6', '#b8338f', '#d6457a', '#8b1a1a',
  ],
  ink: { light: '#ffffff', dark: '#101010' },
  inkMode: 'light',
  back: { pattern: 'salon', bg: ['#1b2647', '#0c1226'], ink: '#f2c14e', frame: '#f2c14e', frameSoft: '#f2c14e' },
  swatch: { bg: '#0a0e1a', felt: '#124633', accent: '#f2c14e', card: '#fbf7ec' },
};

/** 和：伝統色を、彩度の並び（灰→赤→橙→黄→緑→青→紫→紅）に沿って割り当てる */
const WA: Theme = {
  id: 'wa',
  name: '和 — 畳と金箔',
  tagline: '生成りの紙、畳の卓、藍と朱',
  eyebrow: 'TATAMI & GOLD LEAF',
  dark: false,
  themeColor: '#efe6d2',
  numbers: [
    '#6e7573', // 利休鼠
    '#c73e2e', // 朱
    '#ed6d3d', // 柿
    '#e8a300', // 山吹
    '#8fae3a', // 萌黄
    '#35784f', // 若竹
    '#0e8f96', // 浅葱
    '#1e50a2', // 瑠璃
    '#4a3f9e', // 菫
    '#7b4b9e', // 菖蒲
    '#c8438c', // 躑躅
    '#d1436a', // 紅
    '#8f2233', // 臙脂
  ],
  ink: { light: '#f9f4e8', dark: '#241f1c' },
  inkMode: 'contrast',
  back: { pattern: 'seigaiha', bg: ['#f3ecdb', '#e6dbc3'], ink: '#1f3b5b', frame: '#9a7218', frameSoft: '#9a7218' },
  swatch: { bg: '#efe6d2', felt: '#55703f', accent: '#c9a227', card: '#fdfaf2' },
};

const CANDY: Theme = {
  id: 'candy',
  name: 'ポップ・キャンディ',
  tagline: '昼のミントとクリーム、ぜんぶ甘い',
  eyebrow: 'POP CANDY TABLE',
  dark: false,
  themeColor: '#fff7ed',
  numbers: [
    '#a9b0c4', '#ff7a90', '#ffa14d', '#ffd447', '#9ede5a', '#4fd6a1', '#46cfe0',
    '#6fb0ff', '#9a8bff', '#cf8bf0', '#ff8ad0', '#ff6f91', '#ef5350',
  ],
  ink: { light: '#ffffff', dark: '#38243a' },
  inkMode: 'contrast',
  back: { pattern: 'candy', bg: ['#ffe3ef', '#d7f5ee'], ink: '#e0457b', frame: '#ffffff', frameSoft: '#ffffff' },
  swatch: { bg: '#fff7ed', felt: '#cdf0e6', accent: '#e0457b', card: '#ffffff' },
};

const ARCADE: Theme = {
  id: 'arcade',
  name: 'レトロ・アーケード',
  tagline: '暗闇に浮かぶ、ネオンのグリッド',
  eyebrow: 'NEON ARCADE 7',
  dark: true,
  themeColor: '#05060b',
  numbers: [
    '#7d8bb5', '#ff3b6b', '#ff8a1f', '#ffe23d', '#7dff4d', '#21e08a', '#22e6ff',
    '#3aa0ff', '#7a6bff', '#b44dff', '#ff2ea6', '#ff6f9e', '#ff2a2a',
  ],
  ink: { light: '#e8fbff', dark: '#05060b' },
  inkMode: 'self',
  back: { pattern: 'arcade', bg: ['#0d1226', '#05060b'], ink: '#22e6ff', frame: '#ff2ea6', frameSoft: '#22e6ff' },
  swatch: { bg: '#05060b', felt: '#0a1020', accent: '#22e6ff', card: '#141a2e' },
};

const PICNIC: Theme = {
  id: 'picnic',
  name: '森のピクニック',
  tagline: '木のテーブル、クラフト紙、木漏れ日',
  eyebrow: 'FOREST PICNIC',
  dark: false,
  themeColor: '#f7f0e0',
  numbers: [
    '#8a8578', '#b8402f', '#c9713a', '#cf9a1c', '#6f8f3a', '#3f7d4f', '#2f7a6a',
    '#3d7fb0', '#4a5a9c', '#7a4a86', '#a34a7a', '#b05a63', '#7a3b28',
  ],
  ink: { light: '#fdf6e6', dark: '#2b1e12' },
  inkMode: 'contrast',
  back: { pattern: 'gingham', bg: ['#e2cfa4', '#d1b98c'], ink: '#7d4e12', frame: '#7d4e12', frameSoft: '#7d4e12' },
  swatch: { bg: '#f7f0e0', felt: '#7a5230', accent: '#7d4e12', card: '#e6d3ab' },
};

export const THEMES: Theme[] = [SALON, WA, CANDY, ARCADE, PICNIC];

const BY_ID: Record<ThemeId, Theme> = {
  salon: SALON,
  wa: WA,
  candy: CANDY,
  arcade: ARCADE,
  picnic: PICNIC,
};

export function themeById(id: string | null | undefined): Theme {
  return (id && BY_ID[id as ThemeId]) || BY_ID[DEFAULT_THEME];
}

/* ---------------- 文字色の決定（コントラスト） ---------------- */

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** #rrggbb の相対輝度（WCAG） */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** 2色のコントラスト比（1〜21） */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 数字の地色に対して、読みやすい方の文字色を返す */
export function numeralInk(theme: Theme, bg: string): string {
  if (theme.inkMode === 'self') return bg;
  if (theme.inkMode === 'light') return theme.ink.light;
  return contrast(bg, theme.ink.light) >= contrast(bg, theme.ink.dark) ? theme.ink.light : theme.ink.dark;
}

/**
 * `--num-0 … --num-12` と `--num-0-ink … --num-12-ink`。
 * ルートに流し込むほか、テーマ見本のプレビューにもそのまま style として渡せる。
 */
export function numberVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  theme.numbers.forEach((c, i) => {
    vars[`--num-${i}`] = c;
    vars[`--num-${i}-ink`] = numeralInk(theme, c);
  });
  return vars;
}

/* ---------------- 保存と適用 ---------------- */

export function loadThemeId(): ThemeId {
  try {
    return themeById(localStorage.getItem(KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}

let current: ThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

/** ルート要素へテーマを流し込む。初回は index.html のインラインスクリプトが
 *  data-theme を先に立てているので、ここでは数字色だけを足すことになる。 */
function apply(id: ThemeId) {
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  const theme = BY_ID[id];
  const vars = numberVars(theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.themeColor);
}

// モジュール読み込み時に一度だけ（数字色はここで初めて入る）
if (typeof document !== 'undefined') {
  current = loadThemeId();
  apply(current);
}

export function getThemeId(): ThemeId {
  return current;
}

export function getTheme(): Theme {
  return BY_ID[current];
}

export function setTheme(id: ThemeId) {
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  apply(id);
  listeners.forEach((f) => f());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 現在のテーマ（切り替えで再描画される） */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => BY_ID[DEFAULT_THEME]);
}
