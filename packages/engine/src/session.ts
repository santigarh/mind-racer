import { mathChallengeSource } from './challenges/math/source';
import type { RaceConfig } from './config';
import { BOT_PROFILES, BotAgent, pickBotNames, type BotMove, type BotProfileId } from './bots';
import { Race } from './race';
import { deriveRng, hashSeed } from './rng';
import type { AnswerOutcome, ChallengeSource, RaceSnapshot, RunnerSpec } from './types';

export const PLAYER_ID = 'player';
export const DEFAULT_BOT_PROFILES: readonly BotProfileId[] = ['tortuga', 'crucero', 'turbo'];

export interface HumanRunner {
  id: string;
  name: string;
  /** Level this person chose; defaults to the session level. */
  level?: number;
}

export interface BotRunner {
  profile: BotProfileId;
  /** Level for this bot; defaults to the session level. */
  level?: number;
}

export interface RaceSessionOptions {
  seed: number;
  /** Default level for runners without their own. */
  level: number;
  humans: readonly HumanRunner[];
  bots: readonly BotRunner[];
  source?: ChallengeSource;
  config?: Partial<RaceConfig>;
}

interface BotSlot {
  agent: BotAgent;
  pending: BotMove | null;
}

/**
 * A race with any mix of people and bots: owns the Race and feeds it bot answers in time order,
 * interleaved with the people's answers. Used for local races and by the multiplayer server.
 */
export class RaceSession {
  readonly race: Race;
  readonly humanIds: readonly string[];
  private readonly bots: BotSlot[];

  constructor(options: RaceSessionOptions) {
    const names = pickBotNames(deriveRng(options.seed, -1, 'bot-names'), options.bots.length);
    const runners: RunnerSpec[] = options.humans.map((h) => ({
      id: h.id,
      name: h.name,
      kind: 'human',
      ...(h.level !== undefined ? { level: h.level } : {}),
    }));
    const botSpecs = options.bots.map((bot, i) => ({
      id: `bot-${bot.profile}-${i}`,
      name: names[i] ?? `Bot ${i + 1}`,
      kind: 'bot' as const,
      profile: bot.profile,
      ...(bot.level !== undefined ? { level: bot.level } : {}),
    }));
    runners.push(...botSpecs.map(({ profile: _profile, ...spec }) => spec));

    this.humanIds = options.humans.map((h) => h.id);
    this.race = new Race({
      seed: options.seed,
      level: options.level,
      runners,
      source: options.source ?? mathChallengeSource,
      ...(options.config ? { config: options.config } : {}),
    });
    this.bots = botSpecs.map((spec) => ({
      agent: new BotAgent(spec.id, BOT_PROFILES[spec.profile], deriveRng(hashSeed(options.seed, spec.id), 0, 'bot')),
      pending: null,
    }));
  }

  start(atMs: number): void {
    this.race.start(atMs);
  }

  /** Advances to `nowMs`, applying every bot answer due before it, in time order. */
  advanceTo(nowMs: number): void {
    const race = this.race;
    if (race.phase === 'countdown') race.advanceTo(Math.min(nowMs, race.racingStartAtMs));
    while (race.phase === 'racing') {
      const next = this.nextBotMove();
      if (!next || next.move.atMs > nowMs) break;
      next.slot.pending = null;
      race.submitAnswer(next.slot.agent.runnerId, next.move.input, next.move.atMs);
    }
    race.advanceTo(nowMs);
  }

  /** Submits a person's answer at `atMs`, optionally with an externally measured response time. */
  submit(runnerId: string, input: string, atMs: number, responseMs?: number): AnswerOutcome | null {
    if (!this.humanIds.includes(runnerId)) return null;
    this.advanceTo(atMs);
    return this.race.submitAnswer(runnerId, input, atMs, responseMs !== undefined ? { responseMs } : {});
  }

  /**
   * Runs the rest of the race instantly with the same rules (bots keep answering, people who
   * have not finished stop answering). Bots depend only on the seed, so for runners that are
   * already done the ranking equals waiting. Returns the final snapshot.
   */
  finishNow(): RaceSnapshot {
    const race = this.race;
    if (race.phase === 'countdown' || race.phase === 'racing') {
      // The race always ends within timeLimit of racing start.
      this.advanceTo(race.racingStartAtMs + race.config.timeLimitMs);
    }
    return race.snapshot();
  }

  snapshot(): RaceSnapshot {
    return this.race.snapshot();
  }

  /** Bot profile per runner id, for the UI. */
  botProfiles(): Record<string, BotProfileId> {
    return Object.fromEntries(this.bots.map((b) => [b.agent.runnerId, b.agent.profile.id]));
  }

  private nextBotMove(): { slot: BotSlot; move: BotMove } | null {
    let best: { slot: BotSlot; move: BotMove } | null = null;
    for (const slot of this.bots) {
      const challenge = this.race.peekChallenge(slot.agent.runnerId);
      if (!challenge) {
        slot.pending = null;
        continue;
      }
      if (slot.pending?.seq !== challenge.seq) slot.pending = slot.agent.plan(challenge);
      const move = slot.pending;
      if (!best || move.atMs < best.move.atMs) best = { slot, move };
    }
    return best;
  }
}

export interface LocalRaceOptions {
  seed: number;
  level: number;
  /** Omit for bot-only races (simulations). */
  playerName?: string;
  bots?: readonly BotProfileId[];
  source?: ChallengeSource;
  config?: Partial<RaceConfig>;
}

/** A single player against local bots, everyone at the chosen level. */
export class LocalRaceSession {
  readonly race: Race;
  readonly hasPlayer: boolean;
  private readonly session: RaceSession;

  constructor(options: LocalRaceOptions) {
    this.hasPlayer = options.playerName !== undefined;
    this.session = new RaceSession({
      seed: options.seed,
      level: options.level,
      humans: this.hasPlayer ? [{ id: PLAYER_ID, name: options.playerName! }] : [],
      bots: (options.bots ?? DEFAULT_BOT_PROFILES).map((profile) => ({ profile })),
      ...(options.source ? { source: options.source } : {}),
      ...(options.config ? { config: options.config } : {}),
    });
    this.race = this.session.race;
  }

  start(atMs: number): void {
    this.session.start(atMs);
  }

  advanceTo(nowMs: number): void {
    this.session.advanceTo(nowMs);
  }

  /** Submits the human player's answer at `atMs`. */
  submit(input: string, atMs: number): AnswerOutcome | null {
    return this.session.submit(PLAYER_ID, input, atMs);
  }

  finishNow(): RaceSnapshot {
    return this.session.finishNow();
  }

  snapshot(): RaceSnapshot {
    return this.session.snapshot();
  }

  botProfiles(): Record<string, BotProfileId> {
    return this.session.botProfiles();
  }
}
