import type { Rng } from './rng';
import type { Challenge } from './types';

export type BotProfileId = 'tortuga' | 'crucero' | 'turbo';

export interface BotProfile {
  id: BotProfileId;
  label: string;
  /** Multiplier over the challenge's target time. */
  speedFactor: number;
  /** Probability of answering correctly. */
  accuracy: number;
}

/** design.md D8 */
export const BOT_PROFILES: Readonly<Record<BotProfileId, BotProfile>> = Object.freeze({
  tortuga: { id: 'tortuga', label: 'Tortuga', speedFactor: 1.35, accuracy: 0.85 },
  crucero: { id: 'crucero', label: 'Crucero', speedFactor: 1.05, accuracy: 0.9 },
  turbo: { id: 'turbo', label: 'Turbo', speedFactor: 0.8, accuracy: 0.95 },
});

export const BOT_NAMES: readonly string[] = [
  'Ada',
  'Euler',
  'Hipatia',
  'Gauss',
  'Noether',
  'Turing',
  'Ramanujan',
  'Pitágoras',
  'Fibonacci',
  'Sofía',
  'Arquímedes',
  'Emmy',
];

/** Log-normal spread of response times. */
const RESPONSE_SIGMA = 0.25;
const MIN_RESPONSE_MS = 300;

export interface BotMove {
  /** Seq of the challenge being answered. */
  seq: number;
  /** Absolute clock time of the answer. */
  atMs: number;
  input: string;
}

/** Decides when and what a bot answers; it never touches the race state directly. */
export class BotAgent {
  constructor(
    readonly runnerId: string,
    readonly profile: BotProfile,
    private readonly rng: Rng,
  ) {}

  plan(challenge: Challenge & { seq: number; issuedAtMs: number }): BotMove {
    // Always draw the same amount of randomness per decision.
    const spread = Math.exp(RESPONSE_SIGMA * this.rng.normal());
    const correct = this.rng.next() < this.profile.accuracy;
    const offset = this.rng.int(1, 10) * (this.rng.next() < 0.5 ? -1 : 1);

    const delay = Math.max(MIN_RESPONSE_MS, challenge.targetTimeMs * this.profile.speedFactor * spread);
    return {
      seq: challenge.seq,
      atMs: challenge.issuedAtMs + delay,
      input: correct ? challenge.answer : wrongAnswer(challenge.answer, offset),
    };
  }
}

function wrongAnswer(answer: string, offset: number): string {
  const value = Number(answer);
  return Number.isInteger(value) ? String(value + offset) : `${answer}?`;
}

/** Picks `count` distinct names. */
export function pickBotNames(rng: Rng, count: number): string[] {
  const pool = [...BOT_NAMES];
  const names: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    names.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  }
  return names;
}
