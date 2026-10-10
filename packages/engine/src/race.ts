import { DEFAULT_RACE_CONFIG, type RaceConfig } from './config';
import { DifficultyController } from './difficulty';
import { deriveRng, type Rng } from './rng';
import type {
  AnswerOutcome,
  Challenge,
  ChallengeKey,
  ChallengeSource,
  PublicChallenge,
  RacePhase,
  RaceSnapshot,
  RunnerResult,
  RunnerSpec,
  RunnerState,
} from './types';

const RECENT_CHALLENGES = 10;

export interface RaceOptions {
  seed: number;
  /** Level chosen for the race (1–10). */
  level: number;
  runners: readonly RunnerSpec[];
  source: ChallengeSource;
  config?: Partial<RaceConfig>;
}

interface Runner {
  spec: RunnerSpec;
  index: number;
  distance: number;
  /** Speed without nitro, m/s. */
  baseSpeed: number;
  /** Absolute clock ms until which nitro is active. */
  nitroUntilMs: number;
  streak: number;
  correct: number;
  wrong: number;
  finishTimeMs: number | null;
  challenge: Challenge | null;
  challengeSeq: number;
  issuedAtMs: number;
  recent: ChallengeKey[];
  rng: Rng;
  difficulty: DifficultyController;
  answerSeq: number;
  lastAnswer: AnswerOutcome | null;
}

/**
 * Deterministic race simulation (design.md D2/D3).
 * The clock is always supplied by the caller: `start(at)`, `advanceTo(now)`, `submitAnswer(..., at)`.
 * All times passed in are absolute ms on the caller's clock; times reported out are relative to racing start.
 */
export class Race {
  readonly config: Readonly<RaceConfig>;
  readonly seed: number;
  readonly level: number;
  private readonly source: ChallengeSource;
  private readonly runners: Runner[];
  private readonly byId = new Map<string, Runner>();
  private readonly decayPerTick: number;
  private phaseValue: RacePhase = 'waiting';
  private simMs = 0;
  private racingStartMs = 0;
  private endMs: number | null = null;
  private results: RunnerResult[] | null = null;

  constructor(options: RaceOptions) {
    this.config = Object.freeze({ ...DEFAULT_RACE_CONFIG, ...options.config });
    this.seed = options.seed >>> 0;
    this.level = options.level;
    this.source = options.source;
    if (options.runners.length === 0) throw new Error('A race needs at least one runner');
    this.runners = options.runners.map((spec, index) => {
      if (this.byId.has(spec.id)) throw new Error(`Duplicate runner id ${spec.id}`);
      const runner: Runner = {
        spec: { ...spec },
        index,
        distance: 0,
        baseSpeed: 0,
        nitroUntilMs: -Infinity,
        streak: 0,
        correct: 0,
        wrong: 0,
        finishTimeMs: null,
        challenge: null,
        challengeSeq: 0,
        issuedAtMs: 0,
        recent: [],
        // Keyed by id, not lane, so adding or removing a runner never changes the others' challenges.
        rng: deriveRng(this.seed, 0, `challenges:${spec.id}`),
        difficulty: new DifficultyController(options.level),
        answerSeq: 0,
        lastAnswer: null,
      };
      this.byId.set(spec.id, runner);
      return runner;
    });
    const k = Math.LN2 / this.config.speedHalfLifeS;
    this.decayPerTick = Math.exp((-k * this.config.tickMs) / 1000);
  }

  get phase(): RacePhase {
    return this.phaseValue;
  }

  /** Current simulation time on the caller's clock. */
  get nowMs(): number {
    return this.simMs;
  }

  /** Absolute clock ms at which racing starts (valid after start()). */
  get racingStartAtMs(): number {
    return this.racingStartMs;
  }

  /** Starts the countdown at `atMs`. */
  start(atMs: number): void {
    if (this.phaseValue !== 'waiting') throw new Error('Race already started');
    this.phaseValue = 'countdown';
    this.simMs = atMs;
    this.racingStartMs = atMs + this.config.countdownMs;
  }

  /** Runs every whole tick up to `nowMs`. */
  advanceTo(nowMs: number): void {
    if (this.phaseValue === 'waiting') return;
    while (this.phaseValue !== 'finished' && this.simMs + this.config.tickMs <= nowMs) {
      this.step();
    }
  }

  /**
   * Applies an answer at `atMs` (quantized to the last whole tick).
   * Returns null when it is ignored (not racing, finished runner, unknown runner).
   */
  submitAnswer(runnerId: string, input: string, atMs: number): AnswerOutcome | null {
    this.advanceTo(atMs);
    const runner = this.byId.get(runnerId);
    if (!runner || this.phaseValue !== 'racing' || runner.finishTimeMs !== null || !runner.challenge) {
      return null;
    }
    const challenge = runner.challenge;
    const at = this.simMs;
    const responseMs = Math.max(1, at - runner.issuedAtMs);
    const correct = this.source.check(challenge, input);
    let nitro = false;

    if (correct) {
      const cfg = this.config;
      const q = clamp(challenge.targetTimeMs / responseMs, cfg.quicknessMin, cfg.quicknessMax);
      const boost = cfg.boostPerTargetSecond * (challenge.targetTimeMs / 1000) * q;
      runner.baseSpeed = Math.min(cfg.maxSpeed, runner.baseSpeed + boost);
      runner.correct++;
      runner.streak++;
      if (runner.streak >= cfg.nitroStreak) {
        runner.streak = 0;
        runner.nitroUntilMs = at + cfg.nitroDurationMs;
        nitro = true;
      }
    } else {
      runner.baseSpeed *= this.config.wrongAnswerSpeedFactor;
      runner.nitroUntilMs = -Infinity;
      runner.wrong++;
      runner.streak = 0;
    }

    runner.difficulty.record(correct, responseMs, challenge.targetTimeMs);
    runner.lastAnswer = {
      seq: ++runner.answerSeq,
      correct,
      expected: challenge.answer,
      given: input,
      nitro,
      atMs: at - this.racingStartMs,
    };
    this.issueChallenge(runner, at);
    return runner.lastAnswer;
  }

  /** Full current challenge of a runner, answer included. For bots and servers only. */
  peekChallenge(runnerId: string): (Challenge & { seq: number; issuedAtMs: number }) | null {
    const runner = this.byId.get(runnerId);
    if (!runner?.challenge || runner.finishTimeMs !== null || this.phaseValue !== 'racing') return null;
    return { ...runner.challenge, seq: runner.challengeSeq, issuedAtMs: runner.issuedAtMs };
  }

  snapshot(): RaceSnapshot {
    const order = this.ranking();
    const positions = new Map(order.map((r, i) => [r, i + 1]));
    return {
      phase: this.phaseValue,
      level: this.level,
      seed: this.seed,
      distance: this.config.distance,
      elapsedMs: this.phaseValue === 'waiting' ? -this.config.countdownMs : this.simMs - this.racingStartMs,
      countdownRemainingMs:
        this.phaseValue === 'waiting' ? this.config.countdownMs : Math.max(0, this.racingStartMs - this.simMs),
      runners: this.runners.map((r) => this.runnerState(r, positions.get(r)!)),
      results: this.results ? this.results.map((r) => ({ ...r })) : null,
    };
  }

  // ---------- internals ----------

  private step(): void {
    const cfg = this.config;
    const t0 = this.simMs;
    const t1 = t0 + cfg.tickMs;

    if (this.phaseValue === 'countdown') {
      this.simMs = t1;
      if (t1 >= this.racingStartMs) {
        this.phaseValue = 'racing';
        this.racingStartMs = t1;
        for (const runner of this.runners) this.issueChallenge(runner, t1);
      }
      return;
    }

    const dt = cfg.tickMs / 1000;
    const nitroExtra = cfg.nitroExtraSpeedFactor * cfg.maxSpeed;
    for (const runner of this.runners) {
      if (runner.finishTimeMs !== null) continue;
      const speed = runner.baseSpeed + (runner.nitroUntilMs > t0 ? nitroExtra : 0);
      const travel = speed * dt;
      if (travel > 0 && runner.distance + travel >= cfg.distance) {
        const fraction = (cfg.distance - runner.distance) / travel;
        runner.distance = cfg.distance;
        runner.finishTimeMs = t0 + fraction * cfg.tickMs - this.racingStartMs;
        runner.baseSpeed = 0;
        runner.nitroUntilMs = -Infinity;
        runner.challenge = null;
        continue;
      }
      runner.distance += travel;
      runner.baseSpeed *= this.decayPerTick;
      if (runner.baseSpeed < 1e-3) runner.baseSpeed = 0;
    }
    this.simMs = t1;

    const allFinished = this.runners.every((r) => r.finishTimeMs !== null);
    if (allFinished || t1 - this.racingStartMs >= cfg.timeLimitMs) this.finish(t1);
  }

  private issueChallenge(runner: Runner, atMs: number): void {
    const challenge = this.source.next(runner.difficulty.level, runner.rng, runner.recent);
    runner.challenge = challenge;
    runner.challengeSeq++;
    runner.issuedAtMs = atMs;
    runner.recent.push(challenge.key);
    if (runner.recent.length > RECENT_CHALLENGES) runner.recent.shift();
  }

  private finish(atMs: number): void {
    this.phaseValue = 'finished';
    this.endMs = atMs;
    for (const runner of this.runners) runner.challenge = null;
    this.results = this.ranking().map((r, i) => this.result(r, i + 1));
  }

  /** Finished runners by time, then the rest by distance (ties by runner order). */
  private ranking(): Runner[] {
    return [...this.runners].sort((a, b) => {
      if (a.finishTimeMs !== null && b.finishTimeMs !== null) {
        return a.finishTimeMs - b.finishTimeMs || a.index - b.index;
      }
      if (a.finishTimeMs !== null) return -1;
      if (b.finishTimeMs !== null) return 1;
      return b.distance - a.distance || a.index - b.index;
    });
  }

  private result(r: Runner, position: number): RunnerResult {
    const answered = r.correct + r.wrong;
    const activeMs = r.finishTimeMs ?? (this.endMs ?? this.simMs) - this.racingStartMs;
    return {
      id: r.spec.id,
      name: r.spec.name,
      kind: r.spec.kind,
      position,
      finished: r.finishTimeMs !== null,
      finishTimeMs: r.finishTimeMs,
      distance: r.distance,
      correct: r.correct,
      wrong: r.wrong,
      accuracy: answered === 0 ? 0 : r.correct / answered,
      correctPerMinute: activeMs > 0 ? (r.correct * 60_000) / activeMs : 0,
      maxLevel: r.difficulty.maxReached,
    };
  }

  private runnerState(r: Runner, position: number): RunnerState {
    const nitroActive = r.nitroUntilMs > this.simMs && r.finishTimeMs === null;
    const challenge: PublicChallenge | null = r.challenge
      ? {
          seq: r.challengeSeq,
          level: r.challenge.level,
          prompt: r.challenge.prompt,
          answerLength: r.challenge.answer.length,
          issuedAtMs: r.issuedAtMs - this.racingStartMs,
        }
      : null;
    return {
      ...r.spec,
      index: r.index,
      distance: r.distance,
      speed: r.baseSpeed + (nitroActive ? this.config.nitroExtraSpeedFactor * this.config.maxSpeed : 0),
      streak: r.streak,
      nitroActive,
      correct: r.correct,
      wrong: r.wrong,
      level: r.challenge?.level ?? r.difficulty.level,
      maxLevel: r.difficulty.maxReached,
      finishTimeMs: r.finishTimeMs,
      position,
      challenge,
      lastAnswer: r.lastAnswer ? { ...r.lastAnswer } : null,
    };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
