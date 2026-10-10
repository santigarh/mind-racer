import { mathChallengeSource } from './challenges/math/source';
import type { RaceConfig } from './config';
import { BOT_PROFILES, BotAgent, pickBotNames, type BotMove, type BotProfileId } from './bots';
import { Race } from './race';
import { deriveRng, hashSeed } from './rng';
import type { AnswerOutcome, ChallengeSource, RaceSnapshot, RunnerSpec } from './types';

export const PLAYER_ID = 'player';
const DEFAULT_BOT_PROFILES: readonly BotProfileId[] = ['tortuga', 'crucero', 'turbo'];

export interface LocalRaceOptions {
  seed: number;
  level: number;
  /** Omit for bot-only races (simulations). */
  playerName?: string;
  bots?: readonly BotProfileId[];
  source?: ChallengeSource;
  config?: Partial<RaceConfig>;
}

interface BotSlot {
  agent: BotAgent;
  pending: BotMove | null;
}

/** A race against local bots: owns the Race and feeds it bot answers in time order. */
export class LocalRaceSession {
  readonly race: Race;
  readonly hasPlayer: boolean;
  private readonly bots: BotSlot[];

  constructor(options: LocalRaceOptions) {
    const profiles = options.bots ?? DEFAULT_BOT_PROFILES;
    const names = pickBotNames(deriveRng(options.seed, -1, 'bot-names'), profiles.length);
    const runners: RunnerSpec[] = [];
    if (options.playerName !== undefined) {
      runners.push({ id: PLAYER_ID, name: options.playerName, kind: 'human' });
    }
    const botSpecs = profiles.map((profile, i) => ({
      id: `bot-${profile}-${i}`,
      name: names[i] ?? `Bot ${i + 1}`,
      kind: 'bot' as const,
      profile,
    }));
    runners.push(...botSpecs.map(({ id, name, kind }) => ({ id, name, kind })));

    this.hasPlayer = options.playerName !== undefined;
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

  /** Submits the human player's answer at `atMs`. */
  submit(input: string, atMs: number): AnswerOutcome | null {
    if (!this.hasPlayer) return null;
    this.advanceTo(atMs);
    return this.race.submitAnswer(PLAYER_ID, input, atMs);
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
