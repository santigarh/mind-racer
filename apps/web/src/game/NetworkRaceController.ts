import {
  DEFAULT_RACE_CONFIG,
  type AnswerOutcome,
  type BotProfileId,
  type PublicChallenge,
  type RacePhase,
  type RaceSnapshot,
  type RunnerResult,
  type RunnerState,
} from '@mind-racer/engine';
import type { Car, ClientMessage, NetRunnerResult, NetRunnerState, Presence, RaceRunner, ServerMessage } from '@mind-racer/protocol';
import type { ConnectionStatus } from '../net/NetClient';
import type { RaceViewSource, RaceViewState } from './RaceViewSource';

/** The part of NetClient the controller uses. */
export interface RaceChannel {
  readonly status: ConnectionStatus;
  send(message: ClientMessage): void;
  onMessage(listener: (message: ServerMessage) => void): () => void;
  onStatus(listener: (status: ConnectionStatus) => void): () => void;
}

export interface NetworkRaceOptions {
  channel: RaceChannel;
  raceStart: Extract<ServerMessage, { type: 'raceStart' }>;
  playerId: string;
  now?: () => number;
  autoLoop?: boolean;
}

/** Longest stretch we extrapolate without news from the server. */
const MAX_EXTRAPOLATION_MS = 500;
/** Time to blend away the jump when a new state corrects our estimate. */
const CORRECTION_MS = 100;
const DECAY_K = Math.LN2 / DEFAULT_RACE_CONFIG.speedHalfLifeS;

interface Received {
  message: Extract<ServerMessage, { type: 'state' }>;
  at: number;
}

/** Last news about one runner: class races only send each person some of the runners (design D3). */
interface Known {
  runner: NetRunnerState;
  at: number;
}

/**
 * Race view for an online race: the server decides everything; this mirrors its `state`
 * messages, estimates car positions between them with the engine's physics and sends answers.
 */
export class NetworkRaceController implements RaceViewSource {
  readonly mode = 'network' as const;
  /** The server already skips waiting for bots; show results right away. */
  readonly resultsDelayMs = 0;
  readonly seed: number;
  readonly playerId: string;
  /** 1, 2, 3… since the room opened; null when an older server does not send it. */
  readonly raceNumber: number | null;
  /** Unix ms when the countdown began; null when an older server does not send it. */
  readonly startedAt: number | null;
  private readonly channel: RaceChannel;
  private readonly runners: readonly RaceRunner[];
  private readonly distance: number;
  private readonly now: () => number;
  private readonly autoLoop: boolean;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: Array<() => void> = [];
  private readonly botProfiles: Readonly<Record<string, BotProfileId>>;
  private readonly cars: Readonly<Record<string, Car>>;
  private received: Received | null = null;
  /** Latest state of every runner ever received; a runner missing from a message keeps its last one. */
  private readonly known = new Map<string, Known>();
  /** Distance offsets being blended away, per runner. */
  private corrections = new Map<string, { offset: number; at: number }>();
  private challenge: PublicChallenge | null = null;
  private lastAnswer: AnswerOutcome | null = null;
  private results: NetRunnerResult[] | null = null;
  private reconnecting: boolean;
  private frame: number | null = null;
  private started = false;
  private disposed = false;
  private state: RaceViewState;

  constructor(options: NetworkRaceOptions) {
    this.channel = options.channel;
    this.seed = options.raceStart.seed;
    this.raceNumber = options.raceStart.raceNumber ?? null;
    this.startedAt = options.raceStart.startedAt ?? null;
    this.runners = options.raceStart.runners;
    this.distance = options.raceStart.distance;
    this.playerId = options.playerId;
    this.now = options.now ?? (() => performance.now());
    this.autoLoop = options.autoLoop ?? true;
    this.botProfiles = Object.freeze(
      Object.fromEntries(this.runners.filter((r) => r.botProfile).map((r) => [r.id, r.botProfile!])),
    );
    this.cars = Object.freeze(Object.fromEntries(this.runners.filter((r) => r.car).map((r) => [r.id, r.car!])));
    this.reconnecting = this.channel.status !== 'open';
    this.unsubscribe.push(
      this.channel.onMessage((message) => this.receive(message)),
      this.channel.onStatus((status) => {
        this.reconnecting = status !== 'open';
        this.publish();
      }),
    );
    this.state = this.buildState();
  }

  // ---------- RaceViewSource ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): RaceViewState => this.state;

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    if (this.autoLoop) this.frame = requestAnimationFrame(this.loop);
  }

  /** Online races never pause (multiplayer-race › Sin pausa en multijugador). */
  hold(): void {}
  release(): void {}

  submit(input: string): void {
    if (!this.challenge || this.results) return;
    this.channel.send({ type: 'answer', seq: this.challenge.seq, input });
  }

  canFinishNow(): boolean {
    return false;
  }

  finishNow(): RaceSnapshot | null {
    return null;
  }

  /** Leaves the race; the car stops for the others and nothing counts for progress. */
  abandon(): void {
    this.channel.send({ type: 'abandon' });
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const off of this.unsubscribe.splice(0)) off();
    this.listeners.clear();
  }

  /** Recomputes the estimated positions for the current time (called every frame). */
  tick(): void {
    if (!this.disposed) this.publish();
  }

  // ---------- server messages ----------

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'state': {
        const now = this.now();
        const before = this.received ? this.estimate(now) : null;
        this.received = { message, at: now };
        for (const runner of message.runners) this.known.set(runner.id, { runner, at: now });
        if (before) {
          const after = this.estimate(now);
          for (const [id, distance] of before) {
            const offset = distance - (after.get(id) ?? distance);
            if (Math.abs(offset) > 1e-6) this.corrections.set(id, { offset, at: now });
          }
        }
        break;
      }
      case 'challenge':
        this.challenge = message.challenge;
        break;
      case 'answer':
        this.lastAnswer = message.outcome;
        this.challenge = message.challenge;
        break;
      case 'results':
        this.results = message.results;
        this.challenge = null;
        break;
      default:
        return;
    }
    this.publish();
  }

  // ---------- estimation ----------

  private loop = (): void => {
    this.tick();
    if (!this.disposed && !this.results) this.frame = requestAnimationFrame(this.loop);
    else this.frame = null;
  };

  /** Server distance advanced with the engine's speed decay since the state arrived. */
  private estimate(now: number): Map<string, number> {
    const out = new Map<string, number>();
    const received = this.received;
    if (!received) return out;
    for (const { runner: r, at } of this.known.values()) {
      // A runner we stopped hearing about is extrapolated at most this long, then stays put.
      const dt = Math.min(MAX_EXTRAPOLATION_MS, Math.max(0, now - at)) / 1000;
      const moving = received.message.phase === 'racing' && r.finishTimeMs === null;
      const travel = moving ? (r.speed * (1 - Math.exp(-DECAY_K * dt))) / DECAY_K : 0;
      out.set(r.id, Math.min(this.distance, r.distance + travel));
    }
    return out;
  }

  private displayedDistance(id: string, estimated: number, now: number): number {
    const correction = this.corrections.get(id);
    if (!correction) return estimated;
    const remaining = 1 - (now - correction.at) / CORRECTION_MS;
    if (remaining <= 0) {
      this.corrections.delete(id);
      return estimated;
    }
    return Math.min(this.distance, Math.max(0, estimated + correction.offset * remaining));
  }

  // ---------- view state ----------

  private buildState(): RaceViewState {
    const now = this.now();
    const received = this.received;
    const sinceMs = received ? now - received.at : 0;
    const serverRunners = new Map<string, NetRunnerState>([...this.known].map(([id, k]) => [id, k.runner]));
    const estimated = this.estimate(now);
    const presence: Record<string, Presence> = {};

    let phase: RacePhase = received?.message.phase ?? 'countdown';
    if (this.results) phase = 'finished';

    const runners: RunnerState[] = this.runners.map((meta, index) => {
      const s = serverRunners.get(meta.id);
      const isMe = meta.id === this.playerId;
      presence[meta.id] = s?.presence ?? 'connected';
      const moving = phase === 'racing' && s?.finishTimeMs === null;
      const heardMs = now - (this.known.get(meta.id)?.at ?? now);
      return {
        id: meta.id,
        name: meta.name,
        kind: meta.kind,
        level: s?.level ?? meta.chosenLevel,
        index,
        chosenLevel: meta.chosenLevel,
        distance: this.displayedDistance(meta.id, estimated.get(meta.id) ?? 0, now),
        speed: s ? (moving ? s.speed * Math.exp((-DECAY_K * Math.min(MAX_EXTRAPOLATION_MS, heardMs)) / 1000) : s.speed) : 0,
        streak: s?.streak ?? 0,
        nitroActive: s?.nitroActive ?? false,
        correct: s?.correct ?? 0,
        wrong: s?.wrong ?? 0,
        maxLevel: s?.maxLevel ?? meta.chosenLevel,
        finishTimeMs: s?.finishTimeMs ?? null,
        position: s?.position ?? index + 1,
        challenge: isMe ? this.challenge : null,
        lastAnswer: isMe ? this.lastAnswer : null,
      };
    });

    const me = this.runners.find((r) => r.id === this.playerId);
    const message = received?.message;
    const snapshot: RaceSnapshot = {
      phase,
      level: me?.chosenLevel ?? 1,
      seed: this.seed,
      distance: this.distance,
      elapsedMs: message ? message.elapsedMs + (message.phase === 'racing' ? sinceMs : 0) : -DEFAULT_RACE_CONFIG.countdownMs,
      countdownRemainingMs: message
        ? message.phase === 'countdown'
          ? Math.max(0, message.countdownRemainingMs - sinceMs)
          : message.countdownRemainingMs
        : DEFAULT_RACE_CONFIG.countdownMs,
      runners,
      results: this.results ? this.results.map(toRunnerResult) : null,
    };
    if (this.results) for (const r of this.results) presence[r.id] = r.presence;

    return {
      snapshot,
      paused: false,
      resumeRemainingMs: 0,
      botProfiles: this.botProfiles,
      cars: this.cars,
      visibleRunnerIds:
        received && received.message.runners.length < this.runners.length
          ? received.message.runners.map((r) => r.id)
          : null,
      presence,
      reconnecting: this.reconnecting,
    };
  }

  private publish(): void {
    this.state = this.buildState();
    for (const listener of this.listeners) listener();
  }
}

function toRunnerResult({ presence: _presence, ...result }: NetRunnerResult): RunnerResult {
  return result;
}
