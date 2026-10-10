/** Tunable constants of the race model (design.md D3). */
export interface RaceConfig {
  /** Race length in meters. */
  distance: number;
  /** Normal speed cap in m/s (nitro may exceed it). */
  maxSpeed: number;
  /** Seconds for speed to halve without correct answers. */
  speedHalfLifeS: number;
  /** Boost per second of the challenge's target time (m/s per s), "c" in D3. */
  boostPerTargetSecond: number;
  /** Bounds for the quickness factor q = target / responseTime. */
  quicknessMin: number;
  quicknessMax: number;
  /** Speed multiplier applied on a wrong answer. */
  wrongAnswerSpeedFactor: number;
  /** Consecutive correct answers needed for a nitro. */
  nitroStreak: number;
  /** Extra speed during nitro, as a fraction of maxSpeed. */
  nitroExtraSpeedFactor: number;
  nitroDurationMs: number;
  countdownMs: number;
  /** Max racing time before the race ends. */
  timeLimitMs: number;
  /** Fixed simulation step. */
  tickMs: number;
}

export const DEFAULT_RACE_CONFIG: Readonly<RaceConfig> = Object.freeze({
  distance: 1000,
  maxSpeed: 40,
  speedHalfLifeS: 4,
  boostPerTargetSecond: 3.12,
  quicknessMin: 0.5,
  quicknessMax: 1.5,
  wrongAnswerSpeedFactor: 0.5,
  nitroStreak: 5,
  nitroExtraSpeedFactor: 0.5,
  nitroDurationMs: 2000,
  countdownMs: 3000,
  timeLimitMs: 180_000,
  tickMs: 10,
});

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
