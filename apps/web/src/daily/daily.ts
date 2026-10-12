import { MAX_LEVEL, MIN_LEVEL, hashSeed } from '@mind-racer/engine';
import type { KeyValueStorage } from '../progress/storage';

/**
 * Daily challenge data (design D1, D3, D4). Kept apart from the profile so the profile needs no migration.
 * The race of a day depends on the seed below and on the engine (bots, race config, challenge generators):
 * changing those changes that day's race.
 */
export const DAILY_KEY = 'mind-racer:daily:v1';
const KEEP_DAYS = 30;
const DAY_MS = 86_400_000;

export interface DailyResult {
  level: number;
  position: number;
  finished: boolean;
  finishTimeMs: number | null;
  correct: number;
  wrong: number;
}

export interface DailyData {
  version: 1;
  /** Days in a row up to `lastDate`. */
  streak: number;
  bestStreak: number;
  /** Last day the challenge was done, "YYYY-MM-DD"; null if never. */
  lastDate: string | null;
  results: Record<string, DailyResult>;
}

export const EMPTY_DAILY: DailyData = Object.freeze({
  version: 1,
  streak: 0,
  bestStreak: 0,
  lastDate: null,
  results: Object.freeze({}),
}) as DailyData;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day: the challenge changes at the family's midnight, not UTC's. */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dailySeed(dateKey: string, level: number): number {
  return hashSeed('daily', dateKey, level);
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayNumber(dateKey: string): number {
  const m = DATE_KEY.exec(dateKey);
  if (!m) return NaN;
  // Calendar arithmetic in UTC, so daylight saving changes never make a day 23 or 25 hours.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

/** Whole calendar days from `a` to `b` ("2026-10-10" → "2026-10-11" is 1). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** The streak still alive today: it counts if the last challenge was today or yesterday. */
export function currentStreak(data: DailyData, today: string): number {
  if (!data.lastDate) return 0;
  const gap = daysBetween(data.lastDate, today);
  return gap === 0 || gap === 1 ? data.streak : 0;
}

/** Records today's finished challenge: one per day, keeping the last 30 days. */
export function recordDaily(data: DailyData, today: string, result: DailyResult): DailyData {
  if (data.results[today]) return data;
  const gap = data.lastDate ? daysBetween(data.lastDate, today) : NaN;
  const streak = gap === 1 ? data.streak + 1 : gap === 0 ? data.streak : 1;
  const kept = Object.keys(data.results)
    .filter((key) => daysBetween(key, today) < KEEP_DAYS)
    .reduce<Record<string, DailyResult>>((acc, key) => ({ ...acc, [key]: data.results[key]! }), {});
  return {
    version: 1,
    streak,
    bestStreak: Math.max(data.bestStreak, streak),
    lastDate: today,
    results: { ...kept, [today]: result },
  };
}

/** Ms until the next local midnight. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

// ---------- storage ----------

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw with blocked site data.
  }
}

/** Saved daily data; missing, unreadable or invalid data counts as no challenges yet. */
export function loadDaily(storage: KeyValueStorage | null = defaultStorage()): DailyData {
  try {
    const raw = storage?.getItem(DAILY_KEY);
    if (!raw) return EMPTY_DAILY;
    const data: unknown = JSON.parse(raw);
    return isDailyData(data) ? data : EMPTY_DAILY;
  } catch {
    return EMPTY_DAILY;
  }
}

export function saveDaily(data: DailyData, storage: KeyValueStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DAILY_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

function isDailyResult(x: unknown): x is DailyResult {
  return (
    isRecord(x) &&
    Number.isInteger(x.level) &&
    (x.level as number) >= MIN_LEVEL &&
    (x.level as number) <= MAX_LEVEL &&
    isCount(x.position) &&
    (x.position as number) >= 1 &&
    typeof x.finished === 'boolean' &&
    (x.finishTimeMs === null || (typeof x.finishTimeMs === 'number' && x.finishTimeMs >= 0)) &&
    isCount(x.correct) &&
    isCount(x.wrong)
  );
}

export function isDailyData(x: unknown): x is DailyData {
  if (!isRecord(x) || x.version !== 1) return false;
  if (!isCount(x.streak) || !isCount(x.bestStreak) || (x.streak as number) > (x.bestStreak as number)) return false;
  if (x.lastDate !== null && (typeof x.lastDate !== 'string' || Number.isNaN(dayNumber(x.lastDate)))) return false;
  if (!isRecord(x.results)) return false;
  return Object.entries(x.results).every(([key, result]) => !Number.isNaN(dayNumber(key)) && isDailyResult(result));
}
