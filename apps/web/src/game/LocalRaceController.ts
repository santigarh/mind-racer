import {
  LocalRaceSession,
  PLAYER_ID,
  type AnswerOutcome,
  type BotProfileId,
  type RaceConfig,
  type RaceSnapshot,
} from '@mind-racer/engine';
import type { Car } from '@mind-racer/protocol';
import type { RaceViewSource, RaceViewState } from './RaceViewSource';

export const RESUME_COUNTDOWN_MS = 3000;
/** Caps one frame's progress so a stalled tab never jumps the race forward. */
const MAX_FRAME_MS = 250;

export interface LocalRaceControllerOptions {
  seed: number;
  level: number;
  playerName: string;
  /** The player's garage car; the classic look when omitted. */
  car?: Car;
  config?: Partial<RaceConfig>;
  /** Wall clock, injectable for tests. */
  now?: () => number;
  /** Run a requestAnimationFrame loop. Tests turn it off and call tick(). */
  autoLoop?: boolean;
}

type Listener = () => void;
const NO_PRESENCE = Object.freeze({});

/**
 * Glue between the engine and React: owns the race clock (which stops while paused),
 * drives the session every frame and publishes immutable view states.
 */
export class LocalRaceController implements RaceViewSource {
  readonly mode = 'local' as const;
  readonly resultsDelayMs = 1500;
  readonly seed: number;
  readonly level: number;
  private readonly session: LocalRaceSession;
  private readonly now: () => number;
  private readonly autoLoop: boolean;
  private readonly listeners = new Set<Listener>();
  private readonly holds = new Set<string>();
  private readonly botProfiles: Readonly<Record<string, BotProfileId>>;
  private readonly cars: Readonly<Record<string, Car>>;
  private raceMs = 0;
  private lastWallMs: number | null = null;
  private resumeRemainingMs = 0;
  private frame: number | null = null;
  private started = false;
  private disposed = false;
  private state: RaceViewState;

  constructor(options: LocalRaceControllerOptions) {
    this.seed = options.seed;
    this.level = options.level;
    this.now = options.now ?? (() => performance.now());
    this.autoLoop = options.autoLoop ?? true;
    this.session = new LocalRaceSession({
      seed: options.seed,
      level: options.level,
      playerName: options.playerName,
      ...(options.config ? { config: options.config } : {}),
    });
    this.botProfiles = Object.freeze(this.session.botProfiles());
    const cars: Record<string, Car> = options.car ? { [PLAYER_ID]: options.car } : {};
    this.cars = Object.freeze(cars);
    this.state = this.buildState();
  }

  // ---------- React store API ----------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): RaceViewState => this.state;

  // ---------- lifecycle ----------

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.session.start(0);
    this.lastWallMs = this.now();
    this.publish();
    if (this.autoLoop) this.frame = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.listeners.clear();
  }

  /** Advances the race clock by the wall time since the last tick. */
  tick(): void {
    if (!this.started || this.disposed) return;
    const wall = this.now();
    const delta = Math.min(MAX_FRAME_MS, Math.max(0, wall - (this.lastWallMs ?? wall)));
    this.lastWallMs = wall;

    if (this.holds.size === 0) {
      if (this.resumeRemainingMs > 0) {
        this.resumeRemainingMs = Math.max(0, this.resumeRemainingMs - delta);
      } else {
        this.raceMs += delta;
        this.session.advanceTo(this.raceMs);
      }
    }
    this.publish();
  }

  /**
   * Freezes the race clock while `reason` holds (e.g. "hidden", "exit-dialog").
   * Releasing the last hold starts a 3 s resume countdown.
   */
  hold(reason: string): void {
    if (this.isFinished() || this.holds.has(reason)) return;
    this.holds.add(reason);
    this.publish();
  }

  release(reason: string): void {
    if (!this.holds.delete(reason)) return;
    if (this.holds.size === 0 && this.isRacing()) this.resumeRemainingMs = RESUME_COUNTDOWN_MS;
    this.lastWallMs = this.now();
    this.publish();
  }

  /** Submits the player's answer at the current race time. Ignored while paused. */
  submit(input: string): AnswerOutcome | null {
    if (!this.started || this.isPaused()) return null;
    this.tick();
    const outcome = this.session.submit(input, this.raceMs);
    this.publish();
    return outcome;
  }

  /** True once the player crossed the line while bots are still racing. */
  canFinishNow(): boolean {
    const player = this.state.snapshot.runners.find((r) => r.id === PLAYER_ID);
    return this.state.snapshot.phase === 'racing' && player?.finishTimeMs != null;
  }

  /**
   * Runs the rest of the race instantly with the same rules. Bots only depend on the seed,
   * so the final ranking is identical to waiting. Returns the final snapshot, or null if
   * the player has not finished yet.
   */
  finishNow(): RaceSnapshot | null {
    if (!this.canFinishNow()) return null;
    this.holds.clear();
    this.resumeRemainingMs = 0;
    // The race always ends within timeLimit of racing start, which is before raceMs.
    this.raceMs += this.session.race.config.timeLimitMs;
    this.session.advanceTo(this.raceMs);
    this.publish();
    return this.state.snapshot;
  }

  get playerId(): string {
    return PLAYER_ID;
  }

  // ---------- internals ----------

  private loop = (): void => {
    this.tick();
    if (!this.disposed && this.state.snapshot.phase !== 'finished') {
      this.frame = requestAnimationFrame(this.loop);
    } else {
      this.frame = null;
    }
  };

  private isPaused(): boolean {
    return this.holds.size > 0 || this.resumeRemainingMs > 0;
  }

  private isRacing(): boolean {
    return this.session.race.phase === 'racing';
  }

  private isFinished(): boolean {
    return this.session.race.phase === 'finished';
  }

  private buildState(): RaceViewState {
    return {
      snapshot: this.session.snapshot(),
      paused: this.isPaused(),
      resumeRemainingMs: this.resumeRemainingMs,
      botProfiles: this.botProfiles,
      cars: this.cars,
      visibleRunnerIds: null,
      presence: NO_PRESENCE,
      reconnecting: false,
    };
  }

  private publish(): void {
    this.state = this.buildState();
    for (const listener of this.listeners) listener();
  }
}
