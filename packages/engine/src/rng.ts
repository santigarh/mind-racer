/** Seeded pseudo-random number generator. Never use Math.random() inside the engine. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Standard normal sample (mean 0, sd 1). */
  normal(): number;
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() on empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    normal() {
      // Box–Muller; 1 - next() keeps the log argument in (0, 1].
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

/** Hashes any mix of numbers and strings into a 32-bit seed (FNV-1a + final avalanche). */
export function hashSeed(...parts: ReadonlyArray<number | string>): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = `${typeof part}:${part}|`;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Independent stream for one runner and one purpose (e.g. "challenges", "bot"). */
export function deriveRng(seed: number, runnerIndex: number, purpose: string): Rng {
  return mulberry32(hashSeed(seed, runnerIndex, purpose));
}

/** Random 32-bit seed for a new race (UI layer only). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
