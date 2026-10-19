import type { Rng } from '../../rng';
import type { Challenge, ChallengeKey, ChallengeSource } from '../../types';
import { DIVIDE, TIMES, bin } from './format';
import { getLevelDefinition } from './levels';
import { parseIntegerAnswer } from './source';

/** A multiplication tables practice: which tables, and whether their divisions come too. */
export interface TablesSelection {
  tables: number[];
  divisions: boolean;
}

export const TABLES_MIN = 2;
export const TABLES_MAX = 10;
/** Each table goes from N × 1 to N × TABLES_FACTOR_MAX. */
export const TABLES_FACTOR_MAX = 10;
/** Level whose expected time and pace a multiplication (and a whole tables race) uses (design D3). */
export const TABLES_LEVEL = 4;
/** Level whose expected time a division uses. */
const DIVISION_LEVEL = 5;

/** Sorted, without duplicates; null when no table is left or one is out of range. */
export function normalizeTables(selection: TablesSelection): TablesSelection | null {
  const { tables, divisions } = selection;
  if (tables.some((n) => !Number.isInteger(n) || n < TABLES_MIN || n > TABLES_MAX)) return null;
  const unique = [...new Set(tables)].sort((a, b) => a - b);
  return unique.length > 0 ? { tables: unique, divisions } : null;
}

/** Every problem of the selection, in a fixed order so a seed always gives the same race. */
function buildPool(selection: TablesSelection): Challenge[] {
  const multiplication = getLevelDefinition(TABLES_LEVEL);
  const division = getLevelDefinition(DIVISION_LEVEL);
  const pool = new Map<ChallengeKey, Challenge>();
  const add = (prompt: string, answer: number, level: number, targetTimeMs: number) => {
    if (!pool.has(prompt)) pool.set(prompt, { key: prompt, level, prompt, answer: String(answer), targetTimeMs });
  };
  for (const n of selection.tables) {
    for (let k = 1; k <= TABLES_FACTOR_MAX; k++) {
      add(bin(n, TIMES, k), n * k, multiplication.level, multiplication.targetTimeMs);
      add(bin(k, TIMES, n), n * k, multiplication.level, multiplication.targetTimeMs);
    }
    if (selection.divisions) {
      for (let k = 1; k <= TABLES_FACTOR_MAX; k++) add(bin(n * k, DIVIDE, n), k, division.level, division.targetTimeMs);
    }
  }
  return [...pool.values()];
}

/**
 * Problems of the chosen tables only (spec tables-practice). Ignores the level it is asked for:
 * a tables race runs without adaptation. Picks among the problems not in `recent`, so the
 * no-repeat rule always holds (design D2).
 */
export function createTablesSource(selection: TablesSelection): ChallengeSource {
  const normalized = normalizeTables(selection);
  if (!normalized) throw new Error('Una práctica de tablas necesita al menos una tabla del 2 al 10');
  const pool = buildPool(normalized);
  return {
    next(_level: number, rng: Rng, recent: readonly ChallengeKey[]): Challenge {
      const fresh = pool.filter((c) => !recent.includes(c.key));
      return { ...rng.pick(fresh.length > 0 ? fresh : pool) };
    },

    check(challenge: Challenge, input: string): boolean {
      const value = parseIntegerAnswer(input);
      return value !== null && value === Number(challenge.answer);
    },
  };
}
