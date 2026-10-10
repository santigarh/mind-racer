import type { Rng } from '../../rng';
import { DIVIDE, MINUS, PLUS, SQRT, SQUARED, TIMES, bin, paren } from './format';

/** A generated problem before it becomes a Challenge. */
export interface Problem {
  prompt: string;
  answer: number;
  /** Operation family, used by tests. */
  op: string;
}

export type Template = (rng: Rng) => Problem;

interface WeightedTemplate {
  weight: number;
  make: Template;
}

export interface LevelDefinition {
  level: number;
  description: string;
  targetTimeMs: number;
  templates: WeightedTemplate[];
}

// ---------- templates ----------

const add = (a: number, b: number, op = 'add'): Problem => ({ prompt: bin(a, PLUS, b), answer: a + b, op });
const sub = (a: number, b: number, op = 'sub'): Problem => ({ prompt: bin(a, MINUS, b), answer: a - b, op });
const mul = (a: number, b: number, op = 'mul'): Problem => ({ prompt: bin(a, TIMES, b), answer: a * b, op });
const div = (quotient: number, divisor: number, op = 'div'): Problem => ({
  prompt: bin(quotient * divisor, DIVIDE, divisor),
  answer: quotient,
  op,
});

/** Two numbers whose sum needs no carrying. */
function noCarryPair(rng: Rng): [number, number] {
  const tensA = rng.int(1, 8);
  const tensB = rng.int(0, 9 - tensA);
  const unitsA = rng.int(0, 9);
  const unitsB = rng.int(0, 9 - unitsA);
  return [tensA * 10 + unitsA, tensB * 10 + unitsB];
}

/** a − b with no borrowing (a ≥ b digit by digit). */
function noBorrowPair(rng: Rng): [number, number] {
  const tensA = rng.int(1, 9);
  const tensB = rng.int(0, tensA);
  const unitsA = rng.int(0, 9);
  const unitsB = rng.int(0, unitsA);
  return [tensA * 10 + unitsA, tensB * 10 + unitsB];
}

const PERCENTAGES: ReadonlyArray<{ pct: number; step: number }> = [
  { pct: 10, step: 10 },
  { pct: 20, step: 5 },
  { pct: 25, step: 4 },
  { pct: 50, step: 2 },
  { pct: 75, step: 4 },
];

function percentOf(rng: Rng, maxMultiple: number): Problem {
  const { pct, step } = rng.pick(PERCENTAGES);
  const base = step * rng.int(1, maxMultiple);
  return { prompt: `${pct} % de ${base}`, answer: (pct * base) / 100, op: 'percent' };
}

function precedence(rng: Rng, lo: number, hi: number): Problem {
  const a = rng.int(lo, hi);
  const b = rng.int(lo, hi);
  const c = rng.int(lo, hi);
  switch (rng.int(0, 4)) {
    case 0:
      return { prompt: `${a} ${PLUS} ${b} ${TIMES} ${c}`, answer: a + b * c, op: 'precedence' };
    case 1:
      return { prompt: `${a} ${TIMES} ${b} ${MINUS} ${c}`, answer: a * b - c, op: 'precedence' };
    case 2:
      return { prompt: `${paren(bin(a, PLUS, b))} ${TIMES} ${c}`, answer: (a + b) * c, op: 'parens' };
    case 3:
      return { prompt: `${a} ${MINUS} ${b} ${TIMES} ${c}`, answer: a - b * c, op: 'precedence' };
    default:
      return { prompt: `${paren(bin(a, MINUS, b))} ${TIMES} ${c}`, answer: (a - b) * c, op: 'parens' };
  }
}

function threeOps(rng: Rng): Problem {
  switch (rng.int(0, 4)) {
    case 0: {
      const [a, b, c, d] = [rng.int(3, 15), rng.int(3, 15), rng.int(3, 15), rng.int(3, 15)];
      return { prompt: `${a} ${TIMES} ${b} ${PLUS} ${c} ${TIMES} ${d}`, answer: a * b + c * d, op: 'three-ops' };
    }
    case 1: {
      const [a, b, c, d] = [rng.int(5, 30), rng.int(5, 30), rng.int(3, 12), rng.int(10, 99)];
      return {
        prompt: `${paren(bin(a, PLUS, b))} ${TIMES} ${c} ${MINUS} ${d}`,
        answer: (a + b) * c - d,
        op: 'three-ops',
      };
    }
    case 2: {
      const [n, m, k] = [rng.int(6, 20), rng.int(3, 15), rng.int(3, 15)];
      return { prompt: `${n}${SQUARED} ${MINUS} ${m} ${TIMES} ${k}`, answer: n * n - m * k, op: 'three-ops' };
    }
    case 3: {
      const p = percentOf(rng, 50);
      const y = rng.int(10, 199);
      return { prompt: `${p.prompt} ${PLUS} ${y}`, answer: p.answer + y, op: 'three-ops' };
    }
    default: {
      const [r, c, d] = [rng.int(4, 20), rng.int(3, 12), rng.int(10, 99)];
      return { prompt: `${SQRT}${r * r} ${TIMES} ${c} ${MINUS} ${d}`, answer: r * c - d, op: 'three-ops' };
    }
  }
}

// ---------- catalog (design.md D5) ----------

export const MATH_LEVELS: readonly LevelDefinition[] = [
  {
    level: 1,
    description: 'Sumas de una cifra',
    targetTimeMs: 2500,
    templates: [{ weight: 1, make: (r) => add(r.int(1, 9), r.int(1, 9)) }],
  },
  {
    level: 2,
    description: 'Sumas y restas de una cifra',
    targetTimeMs: 2500,
    templates: [
      { weight: 1, make: (r) => add(r.int(1, 9), r.int(1, 9)) },
      {
        weight: 1,
        make: (r) => {
          const a = r.int(1, 9);
          return sub(a, r.int(0, a));
        },
      },
    ],
  },
  {
    level: 3,
    description: 'Sumas y restas hasta dos cifras sin llevar',
    targetTimeMs: 3500,
    templates: [
      { weight: 1, make: (r) => add(...noCarryPair(r)) },
      { weight: 1, make: (r) => sub(...noBorrowPair(r)) },
    ],
  },
  {
    level: 4,
    description: 'Tablas de multiplicar del 2 al 10',
    targetTimeMs: 3000,
    templates: [{ weight: 1, make: (r) => mul(r.int(2, 10), r.int(2, 10)) }],
  },
  {
    level: 5,
    description: 'Divisiones de las tablas; sumas y restas de dos cifras',
    targetTimeMs: 3500,
    templates: [
      { weight: 2, make: (r) => div(r.int(2, 10), r.int(2, 10)) },
      { weight: 1, make: (r) => add(r.int(15, 89), r.int(15, 89), 'add-carry') },
      {
        weight: 1,
        make: (r) => {
          const a = r.int(20, 99);
          return sub(a, r.int(11, a), 'sub-borrow');
        },
      },
    ],
  },
  {
    level: 6,
    description: 'Las cuatro operaciones con dos cifras',
    targetTimeMs: 4500,
    templates: [
      { weight: 1, make: (r) => add(r.int(25, 99), r.int(25, 99)) },
      {
        weight: 1,
        make: (r) => {
          const a = r.int(40, 99);
          return sub(a, r.int(12, a));
        },
      },
      { weight: 1, make: (r) => mul(r.int(11, 49), r.int(2, 9)) },
      {
        weight: 1,
        make: (r) => {
          const divisor = r.int(2, 9);
          return div(r.int(11, Math.max(11, Math.floor(99 / divisor))), divisor);
        },
      },
    ],
  },
  {
    level: 7,
    description: 'Negativos, tres cifras y cuadrados',
    targetTimeMs: 5500,
    templates: [
      {
        weight: 1,
        make: (r) => {
          const a = r.int(2, 49);
          return sub(a, r.int(a + 1, a + 50), 'sub-negative');
        },
      },
      { weight: 1, make: (r) => add(r.int(100, 999), r.int(11, 99), 'add-3d') },
      { weight: 1, make: (r) => sub(r.int(100, 999), r.int(11, 99), 'sub-3d') },
      {
        weight: 1,
        make: (r) => {
          const n = r.int(2, 15);
          return { prompt: `${n}${SQUARED}`, answer: n * n, op: 'square' };
        },
      },
    ],
  },
  {
    level: 8,
    description: 'Dos operaciones con precedencia y paréntesis',
    targetTimeMs: 6500,
    templates: [{ weight: 1, make: (r) => precedence(r, 2, 12) }],
  },
  {
    level: 9,
    description: 'Dos cifras por dos cifras, raíces y porcentajes',
    targetTimeMs: 7000,
    templates: [
      { weight: 1, make: (r) => mul(r.int(11, 25), r.int(11, 19)) },
      {
        weight: 1,
        make: (r) => {
          const n = r.int(2, 20);
          return { prompt: `${SQRT}${n * n}`, answer: n, op: 'sqrt' };
        },
      },
      { weight: 1, make: (r) => percentOf(r, 100) },
    ],
  },
  {
    level: 10,
    description: 'Mezcla avanzada con tres operaciones',
    targetTimeMs: 8000,
    templates: [
      { weight: 2, make: threeOps },
      { weight: 1, make: (r) => precedence(r, 6, 25) },
      { weight: 1, make: (r) => mul(r.int(15, 49), r.int(12, 29)) },
    ],
  },
];

export function getLevelDefinition(level: number): LevelDefinition {
  const index = Math.min(Math.max(Math.round(level), 1), MATH_LEVELS.length) - 1;
  return MATH_LEVELS[index]!;
}

export function generateProblem(level: number, rng: Rng): Problem {
  const { templates } = getLevelDefinition(level);
  const total = templates.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng.next() * total;
  for (const t of templates) {
    roll -= t.weight;
    if (roll < 0) return t.make(rng);
  }
  return templates[templates.length - 1]!.make(rng);
}
