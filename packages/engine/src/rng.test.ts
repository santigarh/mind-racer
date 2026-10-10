import { describe, expect, it } from 'vitest';
import { deriveRng, hashSeed, mulberry32 } from './rng';

const take = (rng: { next(): number }, n: number) => Array.from({ length: n }, () => rng.next());

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(mulberry32(42), 50)).toEqual(take(mulberry32(42), 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(mulberry32(1), 10)).not.toEqual(take(mulberry32(2), 10));
  });

  it('stays in [0, 1) and int() respects bounds', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it('normal() has mean ~0 and sd ~1', () => {
    const rng = mulberry32(99);
    const xs = Array.from({ length: 20_000 }, () => rng.normal());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe('deriveRng', () => {
  it('is reproducible per (seed, runner, purpose)', () => {
    expect(take(deriveRng(5, 1, 'bot'), 20)).toEqual(take(deriveRng(5, 1, 'bot'), 20));
  });

  it('gives uncorrelated streams for different runners and purposes', () => {
    const streams = [deriveRng(5, 0, 'bot'), deriveRng(5, 1, 'bot'), deriveRng(5, 0, 'challenges')];
    const seqs = streams.map((s) => take(s, 5_000));
    for (let a = 0; a < seqs.length; a++) {
      for (let b = a + 1; b < seqs.length; b++) {
        expect(Math.abs(correlation(seqs[a]!, seqs[b]!))).toBeLessThan(0.05);
        expect(seqs[a]!.slice(0, 5)).not.toEqual(seqs[b]!.slice(0, 5));
      }
    }
  });

  it('hashSeed distinguishes "1" from 1', () => {
    expect(hashSeed('1')).not.toBe(hashSeed(1));
  });
});

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i]! - mx) * (ys[i]! - my);
    vx += (xs[i]! - mx) ** 2;
    vy += (ys[i]! - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}
