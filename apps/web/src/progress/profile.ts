import { MAX_LEVEL, MIN_LEVEL } from '@mind-racer/engine';

export type StartingPoint = 'beginner' | 'intermediate' | 'advanced';

export const STARTING_POINTS: ReadonlyArray<{ id: StartingPoint; label: string; level: number; hint: string }> = [
  { id: 'beginner', label: 'Principiante', level: 1, hint: 'Empieza con sumas de una cifra' },
  { id: 'intermediate', label: 'Intermedio', level: 4, hint: 'Desbloquea hasta las tablas de multiplicar' },
  { id: 'advanced', label: 'Avanzado', level: 7, hint: 'Desbloquea hasta negativos y cuadrados' },
];

export const NAME_MAX_LENGTH = 20;
export const UNLOCK_MIN_ACCURACY = 0.8;
export const UNLOCK_MAX_POSITION = 2;

export interface LevelStats {
  races: number;
  wins: number;
  bestTimeMs: number | null;
  bestCorrectPerMinute: number;
  bestAccuracy: number;
}

export interface Profile {
  version: 1;
  name: string;
  /** Highest level the player can select. */
  unlockedLevel: number;
  /** Keyed by level ("1".."10"). */
  stats: Record<string, LevelStats>;
}

/** What the progress logic needs from a finished race. */
export interface RaceOutcome {
  level: number;
  position: number;
  finished: boolean;
  finishTimeMs: number | null;
  accuracy: number;
  correctPerMinute: number;
}

export interface ProgressUpdate {
  profile: Profile;
  /** Newly unlocked level, if any. */
  unlockedLevel: number | null;
  records: { time: boolean; correctPerMinute: boolean; accuracy: boolean };
}

/** Returns the trimmed name, or null when it is not 1–20 characters. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX_LENGTH ? name : null;
}

export function createProfile(rawName: string, start: StartingPoint): Profile {
  const name = normalizeName(rawName);
  if (name === null) throw new Error('El nombre debe tener entre 1 y 20 caracteres');
  const point = STARTING_POINTS.find((p) => p.id === start);
  if (!point) throw new Error(`Punto de partida desconocido: ${start}`);
  return { version: 1, name, unlockedLevel: point.level, stats: {} };
}

export function emptyStats(): LevelStats {
  return { races: 0, wins: 0, bestTimeMs: null, bestCorrectPerMinute: 0, bestAccuracy: 0 };
}

export function statsFor(profile: Profile, level: number): LevelStats {
  return profile.stats[String(level)] ?? emptyStats();
}

export function isLevelUnlocked(profile: Profile, level: number): boolean {
  return level >= MIN_LEVEL && level <= profile.unlockedLevel;
}

/** Applies a completed (not abandoned) race to the profile. Pure. */
export function applyRaceResult(profile: Profile, outcome: RaceOutcome): ProgressUpdate {
  const previous = statsFor(profile, outcome.level);
  const time =
    outcome.finished &&
    outcome.finishTimeMs !== null &&
    (previous.bestTimeMs === null || outcome.finishTimeMs < previous.bestTimeMs);
  const correctPerMinute = outcome.correctPerMinute > previous.bestCorrectPerMinute;
  const accuracy = outcome.accuracy > previous.bestAccuracy;

  const stats: LevelStats = {
    races: previous.races + 1,
    wins: previous.wins + (outcome.position === 1 ? 1 : 0),
    bestTimeMs: time ? outcome.finishTimeMs : previous.bestTimeMs,
    bestCorrectPerMinute: correctPerMinute ? outcome.correctPerMinute : previous.bestCorrectPerMinute,
    bestAccuracy: accuracy ? outcome.accuracy : previous.bestAccuracy,
  };

  const unlocks =
    outcome.level === profile.unlockedLevel &&
    profile.unlockedLevel < MAX_LEVEL &&
    outcome.position <= UNLOCK_MAX_POSITION &&
    outcome.accuracy >= UNLOCK_MIN_ACCURACY;

  return {
    profile: {
      ...profile,
      unlockedLevel: unlocks ? profile.unlockedLevel + 1 : profile.unlockedLevel,
      stats: { ...profile.stats, [String(outcome.level)]: stats },
    },
    unlockedLevel: unlocks ? profile.unlockedLevel + 1 : null,
    records: { time, correctPerMinute, accuracy },
  };
}
