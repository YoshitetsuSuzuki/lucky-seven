import { assertEquals } from 'jsr:@std/assert';
import { cleanName, freeSeatOrNull, genCode, validateSettings } from './api.ts';

// ---------- genCode ----------

Deno.test('genCode: 6桁の数字を返す', () => {
  const code = genCode();
  assertEquals(/^\d{6}$/.test(code), true);
});

Deno.test('genCode: 50回呼んでも40種類以上のばらつきがある', () => {
  const codes = new Set(Array.from({ length: 50 }, () => genCode()));
  assertEquals(codes.size >= 40, true);
});

// ---------- freeSeatOrNull ----------

Deno.test('freeSeatOrNull: 空なら 0', () => {
  assertEquals(freeSeatOrNull([]), 0);
});

Deno.test('freeSeatOrNull: 穴があれば埋める', () => {
  const players = [
    { id: 'a', room_id: 'r', name: 'A', seat: 0, is_cpu: false },
    { id: 'b', room_id: 'r', name: 'B', seat: 2, is_cpu: false },
  ];
  assertEquals(freeSeatOrNull(players), 1);
});

Deno.test('freeSeatOrNull: 12人埋まっていれば null', () => {
  const players = Array.from({ length: 12 }, (_, seat) => ({
    id: `p${seat}`,
    room_id: 'r',
    name: `P${seat}`,
    seat,
    is_cpu: false,
  }));
  assertEquals(freeSeatOrNull(players), null);
});

Deno.test('freeSeatOrNull: 観戦者（seat null）は無視する', () => {
  const players = [
    { id: 'a', room_id: 'r', name: 'A', seat: null, is_cpu: false },
    { id: 'b', room_id: 'r', name: 'B', seat: 0, is_cpu: false },
  ];
  assertEquals(freeSeatOrNull(players), 1);
});

// ---------- validateSettings ----------

Deno.test('validateSettings: 不正な値は既定値（20秒 / points / 200）になる', () => {
  assertEquals(validateSettings({ turnSeconds: 'ハイジャック', endMode: 'nonsense', target: 999 }), {
    turnSeconds: 20,
    endMode: 'points',
    target: 200,
  });
});

Deno.test('validateSettings: turnSeconds は null（無制限）を明示した場合のみ通す', () => {
  assertEquals(validateSettings({ turnSeconds: null, endMode: 'points', target: 100 }).turnSeconds, null);
});

Deno.test('validateSettings: undefined 入力でも安全な既定値を返す', () => {
  assertEquals(validateSettings(undefined), { turnSeconds: 20, endMode: 'points', target: 200 });
});

Deno.test('validateSettings: rounds モードの target は 3|5|10 から選ぶ', () => {
  assertEquals(validateSettings({ endMode: 'rounds', target: 5 }).target, 5);
  assertEquals(validateSettings({ endMode: 'rounds', target: 999 }).target, 5);
});

// ---------- cleanName ----------

Deno.test('cleanName: 前後の空白をトリムする', () => {
  assertEquals(cleanName('  よしてつ  '), 'よしてつ');
});

Deno.test('cleanName: 空文字はエラー', () => {
  let threw = false;
  try {
    cleanName('   ');
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test('cleanName: 13文字以上はエラー', () => {
  let threw = false;
  try {
    cleanName('あ'.repeat(13));
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test('cleanName: 12文字ちょうどは許可', () => {
  assertEquals(cleanName('あ'.repeat(12)), 'あ'.repeat(12));
});
