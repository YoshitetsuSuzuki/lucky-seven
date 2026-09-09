import { describe, it, expect } from 'vitest';
import type { Card } from '../src/cards.ts';
import { scoreCards, uniqueNumberCount } from '../src/score.ts';

const N = (value: number, i = 0): Card => ({ id: `n${value}-${i}`, kind: 'number', value });
const ADD = (value: number): Card => ({ id: `m-add-${value}`, kind: 'add', value });
const MUL: Card = { id: 'm-mul', kind: 'mul' };

describe('scoreCards', () => {
  it('数字の合計', () => expect(scoreCards([N(3), N(7), N(12)], false)).toBe(22));
  it('×2 は数字合計のみ2倍、修飾は後で加算', () => {
    expect(scoreCards([N(5), N(6), MUL, ADD(4)], false)).toBe(26);
  });
  it('数字なし・修飾のみは修飾分だけ', () => {
    expect(scoreCards([ADD(10)], false)).toBe(10);
    expect(scoreCards([MUL], false)).toBe(0);
  });
  it('7種達成で +15', () => {
    expect(scoreCards([N(0), N(1), N(2), N(3), N(4), N(5), N(6)], true)).toBe(36);
  });
  it('7種達成 + ×2 はボーナスを2倍しない', () => {
    expect(scoreCards([N(0), N(1), N(2), N(3), N(4), N(5), N(6), MUL], true)).toBe(57);
  });
});

describe('uniqueNumberCount', () => {
  it('数字カードの種類数を数える', () => {
    expect(uniqueNumberCount([N(0), N(4), ADD(2), MUL])).toBe(2);
    expect(uniqueNumberCount([])).toBe(0);
  });
});
