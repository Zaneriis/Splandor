import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from '../../src/engine/rng.js';

describe('RNG', () => {
  it('est déterministe pour une même graine', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('diffère selon la graine', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('shuffle renvoie une permutation sans modifier l’original', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, createRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
    expect(shuffle(input, createRng(7))).toEqual(out);
  });
});
