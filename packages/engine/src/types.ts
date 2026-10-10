import type { Rng } from './rng';

/** Identity of a challenge, used to avoid immediate repeats. */
export type ChallengeKey = string;

export interface Challenge {
  key: ChallengeKey;
  /** Difficulty level 1–10. */
  level: number;
  /** Text shown to the player, e.g. "7 × 8". */
  prompt: string;
  /** Canonical answer, e.g. "56" or "-12". Hidden from the player. */
  answer: string;
  targetTimeMs: number;
}

/** What the UI may see of a challenge (answer hidden, only its length). */
export interface PublicChallenge {
  /** Increments with every challenge a runner receives. */
  seq: number;
  level: number;
  prompt: string;
  answerLength: number;
  issuedAtMs: number;
}

/** Any kind of mental challenge (math, logic, memory...). The engine knows nothing else. */
export interface ChallengeSource {
  next(level: number, rng: Rng, recent: readonly ChallengeKey[]): Challenge;
  check(challenge: Challenge, input: string): boolean;
}

export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'finished';
export type RunnerKind = 'human' | 'bot';

export interface RunnerSpec {
  id: string;
  name: string;
  kind: RunnerKind;
}

export interface AnswerOutcome {
  /** Increments with every answer the runner submits. */
  seq: number;
  correct: boolean;
  expected: string;
  given: string;
  nitro: boolean;
  atMs: number;
}

export interface RunnerState extends RunnerSpec {
  index: number;
  distance: number;
  /** Effective speed including nitro, m/s. */
  speed: number;
  streak: number;
  nitroActive: boolean;
  correct: number;
  wrong: number;
  /** Level of the current challenge. */
  level: number;
  maxLevel: number;
  /** Ms since racing start; null while running. */
  finishTimeMs: number | null;
  /** 1-based live position. */
  position: number;
  challenge: PublicChallenge | null;
  lastAnswer: AnswerOutcome | null;
}

export interface RunnerResult {
  id: string;
  name: string;
  kind: RunnerKind;
  position: number;
  finished: boolean;
  finishTimeMs: number | null;
  distance: number;
  correct: number;
  wrong: number;
  /** 0–1; 0 when no answers. */
  accuracy: number;
  correctPerMinute: number;
  maxLevel: number;
}

export interface RaceSnapshot {
  phase: RacePhase;
  level: number;
  seed: number;
  distance: number;
  /** Ms since racing start (negative during countdown). */
  elapsedMs: number;
  /** Ms left of the countdown (0 once racing). */
  countdownRemainingMs: number;
  runners: RunnerState[];
  results: RunnerResult[] | null;
}
