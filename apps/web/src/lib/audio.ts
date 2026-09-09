/**
 * Web Audio API で合成する BGM と効果音。音声ファイルは一切持たない。
 * 将来 mp3 に差し替える場合も、外から見える窓口は
 * unlock / startBgm / stopBgm / playSfx / setSoundOn だけに閉じてある。
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

const STORAGE_KEY = 'lucky7:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bgmBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

let enabled = loadEnabled();
let bgmWanted = false;
let timer: number | null = null;
let step = 0;
let nextTime = 0;

const listeners = new Set<() => void>();

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSoundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (on) {
    unlock();
    if (bgmWanted) startScheduler();
  } else {
    stopScheduler();
  }
  emit();
}

/** ユーザー操作の中から呼ぶこと（自動再生制限の解除） */
export function unlock() {
  if (!enabled) return;
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
  const bus = opts.bus ?? sfxBus;
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
  const bus = opts.bus ?? sfxBus;
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

export function playSfx(name: SfxName) {
  if (!enabled) return;
  unlock();
  if (!ctx || !sfxBus) return;
  if (ctx.state === 'suspended') void ctx.resume();
  SFX[name](ctx.currentTime + 0.01);
}

/* ---------------- BGM ---------------- */

const BPM = 92;
const EIGHTH = 60 / BPM / 2;
const STEPS = 64; // 8小節 × 8分音符8つ
const LOOKAHEAD_S = 0.2;
const TIMER_MS = 100;

/** F: I - vi - IV - V （2小節ずつ）。暖かい響きになる並び */
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 41, notes: [65, 69, 72] }, // F  : F3 A3 C4
  { root: 38, notes: [62, 65, 69] }, // Dm : D3 F3 A3
  { root: 46, notes: [58, 62, 65] }, // Bb : Bb2 D3 F3
  { root: 36, notes: [60, 64, 67] }, // C  : C3 E3 G3
];

function pad(at: number, chordIndex: number) {
  if (!ctx || !bgmBus) return;
  const dur = EIGHTH * 16;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.24, at + 0.5);
  g.gain.setValueAtTime(0.24, at + dur * 0.62);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(g).connect(bgmBus);
  for (const n of CHORDS[chordIndex].notes) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(n);
    o.detune.value = (Math.random() - 0.5) * 8;
    o.connect(filter);
    o.start(at);
    o.stop(at + dur + 0.1);
  }
}

function scheduleStep(i: number, at: number) {
  if (!ctx || !bgmBus) return;
  const chordIndex = Math.floor(i / 16) % CHORDS.length;
  if (i % 16 === 0) pad(at, chordIndex);

  // ベース：小節頭と3拍目
  if (i % 8 === 0 || i % 8 === 4) {
    const root = CHORDS[chordIndex].root + (i % 8 === 4 ? 7 : 0);
    tone(midi(root), at, 0.34, { type: 'sine', peak: 0.3, to: midi(root) * 0.985, bus: bgmBus });
  }
  // ハイハット：裏拍
  if (i % 2 === 1) noise(at, 0.045, { hp: 8200, peak: i % 4 === 1 ? 0.055 : 0.035, bus: bgmBus });
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
  if (!enabled || !bgmWanted) return;
  unlock();
  if (!ctx || !bgmBus) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (timer !== null) return;
  step = 0;
  nextTime = ctx.currentTime + 0.12;
  bgmBus.gain.cancelScheduledValues(ctx.currentTime);
  bgmBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bgmBus.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.2);
  timer = window.setInterval(scheduler, TIMER_MS);
  scheduler();
}

function stopScheduler() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  if (ctx && bgmBus) {
    bgmBus.gain.cancelScheduledValues(ctx.currentTime);
    bgmBus.gain.setValueAtTime(Math.max(0.0001, bgmBus.gain.value), ctx.currentTime);
    bgmBus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  }
}

export function startBgm() {
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
