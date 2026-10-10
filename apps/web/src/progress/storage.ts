import { MAX_LEVEL, MIN_LEVEL } from '@mind-racer/engine';
import { NAME_MAX_LENGTH, type LevelStats, type Profile } from './profile';

export const PROFILE_KEY = 'mind-racer:profile:v1';

/** Minimal Storage surface, so tests can pass a fake. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw with blocked site data.
  }
}

/** Returns the saved profile, or null if missing, unreadable or invalid. */
export function loadProfile(storage: KeyValueStorage | null = defaultStorage()): Profile | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    return isProfile(data) ? data : null;
  } catch {
    return null;
  }
}

/** Saves the profile; returns false if storage is unavailable. */
export function saveProfile(profile: Profile, storage: KeyValueStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isNonNegative = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

function isLevelStats(x: unknown): x is LevelStats {
  return (
    isRecord(x) &&
    isCount(x.races) &&
    isCount(x.wins) &&
    (x.wins as number) <= (x.races as number) &&
    (x.bestTimeMs === null || isNonNegative(x.bestTimeMs)) &&
    isNonNegative(x.bestCorrectPerMinute) &&
    isNonNegative(x.bestAccuracy) &&
    (x.bestAccuracy as number) <= 1
  );
}

export function isProfile(x: unknown): x is Profile {
  if (!isRecord(x) || x.version !== 1) return false;
  if (typeof x.name !== 'string') return false;
  const nameLength = [...x.name.trim()].length;
  if (nameLength < 1 || nameLength > NAME_MAX_LENGTH) return false;
  if (!Number.isInteger(x.unlockedLevel)) return false;
  const unlocked = x.unlockedLevel as number;
  if (unlocked < MIN_LEVEL || unlocked > MAX_LEVEL) return false;
  if (!isRecord(x.stats)) return false;
  return Object.entries(x.stats).every(([level, stats]) => {
    const n = Number(level);
    return Number.isInteger(n) && n >= MIN_LEVEL && n <= MAX_LEVEL && isLevelStats(stats);
  });
}
