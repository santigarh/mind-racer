import { MAX_LEVEL, MIN_LEVEL } from './config';

/** Rules from the adaptive-difficulty spec. */
export const DIFFICULTY_RULES = Object.freeze({
  levelsBelow: 1,
  levelsAbove: 2,
  fastStreakToRaise: 3,
  wrongToLower: 2,
  lowerWindow: 4,
});

export type LevelChange = 'up' | 'down' | null;

/** Decides the level of each runner's next challenge from its recent performance. */
export class DifficultyController {
  readonly baseLevel: number;
  readonly minLevel: number;
  readonly maxLevel: number;
  private current: number;
  private highest: number;
  private fastStreak = 0;
  private window: boolean[] = [];

  /** With `adaptive: false` the range collapses to the base level: answers never change it. */
  constructor(baseLevel: number, { adaptive = true }: { adaptive?: boolean } = {}) {
    this.baseLevel = clamp(Math.round(baseLevel), MIN_LEVEL, MAX_LEVEL);
    this.minLevel = adaptive ? Math.max(MIN_LEVEL, this.baseLevel - DIFFICULTY_RULES.levelsBelow) : this.baseLevel;
    this.maxLevel = adaptive ? Math.min(MAX_LEVEL, this.baseLevel + DIFFICULTY_RULES.levelsAbove) : this.baseLevel;
    this.current = this.baseLevel;
    this.highest = this.baseLevel;
  }

  get level(): number {
    return this.current;
  }

  /** Highest level this runner has received. */
  get maxReached(): number {
    return this.highest;
  }

  /** Records one answer and returns whether the level changed. */
  record(correct: boolean, responseMs: number, targetTimeMs: number): LevelChange {
    this.window.push(correct);
    if (this.window.length > DIFFICULTY_RULES.lowerWindow) this.window.shift();
    this.fastStreak = correct && responseMs < targetTimeMs ? this.fastStreak + 1 : 0;

    const wrongCount = this.window.filter((ok) => !ok).length;
    if (wrongCount >= DIFFICULTY_RULES.wrongToLower) {
      return this.shift(-1);
    }
    if (this.fastStreak >= DIFFICULTY_RULES.fastStreakToRaise) {
      return this.shift(+1);
    }
    return null;
  }

  private shift(delta: 1 | -1): LevelChange {
    this.fastStreak = 0;
    this.window = [];
    const next = clamp(this.current + delta, this.minLevel, this.maxLevel);
    if (next === this.current) return null;
    this.current = next;
    this.highest = Math.max(this.highest, next);
    return delta > 0 ? 'up' : 'down';
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
