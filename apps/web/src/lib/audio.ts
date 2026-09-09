/**
 * Web Audio API で合成する BGM と効果音。音声ファイルは一切持たない。
 * 将来 mp3 に差し替える場合も、外から見える窓口は
 * unlock / startBgm / stopBgm / playSfx と ON/OFF の出し入れだけに閉じてある。
 */

export type SfxName =
  | 'flip'
  | 'bust'
  | 'freeze'
  | 'triple'
  | 'insurance'
  | 'seven'
  | 'stay'
  | 'tick'
  | 'reaction'
  | 'win';

const BGM_KEY = 'lucky7:sound:bgm';
const SFX_KEY = 'lucky7:sound:sfx';
/** 旧: BGM と効果音がひとつだった頃の設定 */
const LEGACY_KEY = 'lucky7:sound';
/** 卓で BGM を鳴らすか（既定は鳴らさない。タブを閉じるまで有効） */
const TABLE_KEY = 'lucky7:bgm:table';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bgmBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** playSfx(name, gain) で一時的に差し込む、音量を落としたバス */
let softBus: GainNode | null = null;
let sfxTarget: GainNode | null = null;

let timer: number | null = null;
let step = 0;
let nextTime = 0;
let bgmWanted = false;

const listeners = new Set<() => void>();

/* ---------------- 設定の読み書き ---------------- */

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v !== '0';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 旧キーがあれば新しい2つへ引き継ぐ */
function migrate() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(BGM_KEY) === null) localStorage.setItem(BGM_KEY, legacy);
    if (localStorage.getItem(SFX_KEY) === null) localStorage.setItem(SFX_KEY, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
migrate();

let bgmOn = readFlag(BGM_KEY, true);
let sfxOn = readFlag(SFX_KEY, true);
let tableBgm = (() => {
  try {
    return sessionStorage.getItem(TABLE_KEY) === '1';
  } catch {
    return false;
  }
})();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isBgmOn(): boolean {
  return bgmOn;
}
export function isSfxOn(): boolean {
  return sfxOn;
}
/** 卓（対局中・結果）で BGM を鳴らす設定。既定 OFF、セッション内のみ保持 */
export function isTableBgmOn(): boolean {
  return tableBgm;
}

export function setBgmOn(on: boolean) {
  bgmOn = on;
  writeFlag(BGM_KEY, on);
  if (!on) stopBgm();
  emit();
}

export function setSfxOn(on: boolean) {
  sfxOn = on;
  writeFlag(SFX_KEY, on);
  if (on) unlock();
  emit();
}

export function setTableBgmOn(on: boolean) {
  tableBgm = on;
  try {
    sessionStorage.setItem(TABLE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
}

/** ユーザー操作の中から呼ぶこと（自動再生制限の解除） */
export function unlock() {
  if (!sfxOn && !bgmOn) return;
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master.connect(comp).connect(ctx.destination);

      bgmBus = ctx.createGain();
      bgmBus.gain.value = 0;
      bgmBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.42;
      sfxBus.connect(master);

      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/* ---------------- 合成のための小道具 ---------------- */

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(
  freq: number,
  at: number,
  dur: number,
  opts: { type?: OscillatorType; peak?: number; to?: number; attack?: number; bus?: GainNode | null } = {},
) {
  if (!ctx) return;
  const bus = opts.bus ?? sfxTarget ?? sfxBus;
  if (!bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.to !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), at + dur);
  const peak = opts.peak ?? 0.25;
  const atk = opts.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + dur + 0.03);
}

function noise(
  at: number,
  dur: number,
  opts: { peak?: number; hp?: number; bp?: number; q?: number; bus?: GainNode | null } = {},
) {
  if (!ctx || !noiseBuf) return;
  const bus = opts.bus ?? sfxTarget ?? sfxBus;
  if (!bus) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  if (opts.bp !== undefined) {
    f.type = 'bandpass';
    f.frequency.value = opts.bp;
    f.Q.value = opts.q ?? 1.2;
  } else {
    f.type = 'highpass';
    f.frequency.value = opts.hp ?? 3000;
  }
  const g = ctx.createGain();
  const peak = opts.peak ?? 0.12;
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(at);
  s.stop(at + dur + 0.02);
}

/* ---------------- 効果音 ---------------- */

const SFX: Record<SfxName, (t: number) => void> = {
  // めくる：短いクリック＋紙の擦れ
  flip: (t) => {
    noise(t, 0.07, { bp: 2400, q: 0.9, peak: 0.16 });
    tone(880, t, 0.05, { type: 'triangle', peak: 0.1, to: 620 });
  },
  // バースト：落ちる鋸波＋鈍い衝撃
  bust: (t) => {
    tone(240, t, 0.42, { type: 'sawtooth', peak: 0.2, to: 62 });
    tone(96, t + 0.02, 0.24, { type: 'sine', peak: 0.3, to: 44 });
    noise(t, 0.16, { hp: 900, peak: 0.1 });
  },
  // 氷結：高いサイン波が長く残る
  freeze: (t) => {
    tone(2350, t, 1.1, { type: 'sine', peak: 0.11, attack: 0.02 });
    tone(3130, t + 0.04, 0.95, { type: 'sine', peak: 0.07, attack: 0.03 });
    noise(t, 0.5, { hp: 6000, peak: 0.05 });
  },
  // 三連：上がる3連打
  triple: (t) => {
    [660, 880, 1170].forEach((f, i) => tone(f, t + i * 0.075, 0.1, { type: 'square', peak: 0.11 }));
  },
  // 保険：やわらかい2音チャイム
  insurance: (t) => {
    tone(880, t, 0.34, { type: 'sine', peak: 0.16, attack: 0.012 });
    tone(1320, t + 0.11, 0.42, { type: 'sine', peak: 0.13, attack: 0.012 });
  },
  // 7種達成：金のファンファーレ＋きらめき
  seven: (t) => {
    [0, 4, 7, 12].forEach((n, i) => {
      tone(midi(72 + n), t + i * 0.1, 0.3, { type: 'triangle', peak: 0.2 });
      tone(midi(60 + n), t + i * 0.1, 0.34, { type: 'square', peak: 0.06 });
    });
    for (let i = 0; i < 6; i++) noise(t + 0.4 + i * 0.05, 0.14, { hp: 7000, peak: 0.06 });
  },
  // 降りる：低くやわらかい一打
  stay: (t) => {
    tone(170, t, 0.26, { type: 'sine', peak: 0.22, to: 84 });
  },
  // 残り秒のカウント
  tick: (t) => {
    tone(1250, t, 0.028, { type: 'square', peak: 0.05 });
  },
  reaction: (t) => {
    tone(1400, t, 0.07, { type: 'sine', peak: 0.1, to: 2100 });
  },
  win: (t) => {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(midi(60 + n), t + i * 0.11, 0.42, { type: 'triangle', peak: 0.19 }));
    for (let i = 0; i < 8; i++) noise(t + 0.5 + i * 0.06, 0.18, { hp: 6500, peak: 0.055 });
  },
};

/** @param gain 1 未満にすると、その効果音だけ控えめに鳴る */
export function playSfx(name: SfxName, gain = 1) {
  if (!sfxOn) return;
  unlock();
  if (!ctx || !sfxBus) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (gain !== 1) {
    if (!softBus) {
      softBus = ctx.createGain();
      softBus.connect(sfxBus);
    }
    softBus.gain.value = gain;
    sfxTarget = softBus;
  }
  // SFX は同期的に予約されるので、この間だけ差し替えれば足りる
  try {
    SFX[name](ctx.currentTime + 0.01);
  } finally {
    sfxTarget = null;
  }
}

/* ---------------- BGM（明るいボードゲーム風のループ） ---------------- */

const BPM = 118;
const EIGHTH = 60 / BPM / 2;
const STEPS = 64; // 8小節 × 8分音符8つ
const LOOKAHEAD_S = 0.2;
const TIMER_MS = 100;
/** BGM バスの音量（控えめに） */
const BGM_GAIN = 0.09;
const FADE_IN_S = 0.6;
const FADE_OUT_S = 0.15;

/** C: I - V - vi - IV（2小節ずつ）。明るく前向きな並び */
const CHORDS: { bass: number; lead: number[] }[] = [
  { bass: 48, lead: [72, 76, 79, 84] }, // C  : C3 / C5 E5 G5 C6
  { bass: 43, lead: [71, 74, 79, 83] }, // G  : G2 / B4 D5 G5 B5
  { bass: 45, lead: [69, 72, 76, 81] }, // Am : A2 / A4 C5 E5 A5
  { bass: 41, lead: [69, 72, 77, 81] }, // F  : F2 / A4 C5 F5 A5
];

/** 2小節ぶんのメロディ（lead の添字、-1 は休符）。少し食う形でノリを出す */
const MELODY: number[][] = [
  [0, -1, 1, 2, -1, 2, 3, -1, 2, -1, 1, 0, -1, 1, -1, 2],
  [3, -1, 2, 1, -1, 1, 0, -1, 1, 2, -1, 2, 3, -1, 2, -1],
];

/** マリンバ風の短い一撃 */
function pluck(note: number, at: number, peak: number) {
  tone(midi(note), at, 0.22, { type: 'triangle', peak, attack: 0.004, bus: bgmBus });
  tone(midi(note + 12), at, 0.08, { type: 'sine', peak: peak * 0.35, attack: 0.003, bus: bgmBus });
}

/** 2拍4拍の軽い手拍子 */
function clap(at: number) {
  for (let i = 0; i < 3; i++) noise(at + i * 0.011, 0.075, { bp: 1650, q: 0.7, peak: 0.075 - i * 0.015, bus: bgmBus });
}

function scheduleStep(i: number, at: number) {
  if (!ctx || !bgmBus) return;
  const chordIndex = Math.floor(i / 16) % CHORDS.length;
  const chord = CHORDS[chordIndex];
  const inBar = i % 8;

  // ベース：1拍目と3拍目（1拍目は根音、3拍目は5度）
  if (inBar === 0) pluck(chord.bass, at, 0.34);
  else if (inBar === 4) pluck(chord.bass + 7, at, 0.26);

  // 手拍子：2拍目と4拍目
  if (inBar === 2 || inBar === 6) clap(at);

  // クローズドハイハット：裏拍
  if (i % 2 === 1) noise(at, 0.03, { hp: 9000, peak: i % 4 === 1 ? 0.045 : 0.03, bus: bgmBus });

  // メロディ：8分音符でコードトーンをなぞる
  const pattern = MELODY[chordIndex % MELODY.length];
  const idx = pattern[i % 16];
  if (idx >= 0) pluck(chord.lead[idx], at, inBar === 0 || inBar === 4 ? 0.2 : 0.15);
}

function scheduler() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(step, nextTime);
    step = (step + 1) % STEPS;
    nextTime += EIGHTH;
  }
}

function startScheduler() {
  if (!bgmOn || !bgmWanted) return;
  unlock();
  if (!ctx || !bgmBus) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (timer !== null) return;
  step = 0;
  nextTime = ctx.currentTime + 0.12;
  bgmBus.gain.cancelScheduledValues(ctx.currentTime);
  bgmBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bgmBus.gain.exponentialRampToValueAtTime(BGM_GAIN, ctx.currentTime + FADE_IN_S);
  timer = window.setInterval(scheduler, TIMER_MS);
  scheduler();
}

/** 予約済みの音も 150ms で消える。止めるときは即座に */
function stopScheduler() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  if (ctx && bgmBus) {
    const now = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setValueAtTime(Math.max(0.0001, bgmBus.gain.value), now);
    bgmBus.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
  }
}

export function startBgm() {
  if (!bgmOn) return;
  bgmWanted = true;
  startScheduler();
}

export function stopBgm() {
  bgmWanted = false;
  stopScheduler();
}

/** タブが隠れている間は止める（復帰時に再開） */
export function handleVisibility() {
  if (document.visibilityState === 'hidden') stopScheduler();
  else if (bgmWanted) startScheduler();
}
