import type { BotProfileId, RaceSnapshot } from '@mind-racer/engine';
import type { Car, Presence } from '@mind-racer/protocol';

export interface RaceViewState {
  snapshot: RaceSnapshot;
  /** Race clock frozen (tab hidden, exit dialog, or resume countdown). Always false online. */
  paused: boolean;
  /** Ms left of the resume countdown, 0 when not resuming. */
  resumeRemainingMs: number;
  botProfiles: Readonly<Record<string, BotProfileId>>;
  /**
   * Runners to draw when the server only sends some of them (class races: you and the leaders);
   * null means everyone.
   */
  visibleRunnerIds: readonly string[] | null;
  /** Garage car of each person (local: the player; online: everyone). Bots have none. */
  cars: Readonly<Record<string, Car>>;
  /** Presence of people in an online race; empty for local races. */
  presence: Readonly<Record<string, Presence>>;
  /** Connection to the server lost and being restored (online only). */
  reconnecting: boolean;
}

/** What the race screen needs, whether the race runs locally or on the server. */
export interface RaceViewSource {
  readonly mode: 'local' | 'network';
  readonly seed: number;
  readonly playerId: string;
  /** Delay before showing results once the race is finished. */
  readonly resultsDelayMs: number;
  subscribe(listener: () => void): () => void;
  getState(): RaceViewState;
  start(): void;
  /** Pause requests (tab hidden, exit dialog). Ignored where pausing is not allowed. */
  hold(reason: string): void;
  release(reason: string): void;
  submit(input: string): void;
  /** "Ver resultados": only for local races where the player already finished. */
  canFinishNow(): boolean;
  finishNow(): RaceSnapshot | null;
  dispose(): void;
}
