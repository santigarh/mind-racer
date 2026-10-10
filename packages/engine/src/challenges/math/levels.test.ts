import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../rng';
import { MATH_LEVELS, generateProblem, type Problem } from './levels';

const SAMPLES = 3000;

function sample(level: number, seed = level): Problem[] {
  const rng = mulberry32(seed);
  return Array.from({ length: SAMPLES }, () => generateProblem(level, rng));
}

/** Evaluates a prompt independently of the generator: + − × ÷ ( ) ² √ "p % de n". */
function evaluate(prompt: string): number {
  const tokens = prompt.match(/\d+|[+−×÷()²√%]|de/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function primary(): number {
    const t = take();
    if (t === '(') {
      const v = expr();
      expect(take()).toBe(')');
      return postfix(v);
    }
    if (t === '√') {
      const v = Number(take());
      const r = Math.sqrt(v);
      expect(Number.isInteger(r)).toBe(true);
      return r;
    }
    if (t === undefined || !/^\d+$/.test(t)) throw new Error(`Unexpected token ${t} in "${prompt}"`);
    let v = Number(t);
    if (peek() === '%') {
      take();
      expect(take()).toBe('de');
      v = (v * Number(take())) / 100;
    }
    return postfix(v);
  }
  function postfix(v: number): number {
    if (peek() === '²') {
      take();
      return v * v;
    }
    return v;
  }
  function term(): number {
    let v = primary();
    while (peek() === '×' || peek() === '÷') {
      const op = take();
      const rhs = primary();
      if (op === '÷') {
        expect(rhs).not.toBe(0);
        expect(v % rhs).toBe(0);
        v = v / rhs;
      } else {
        v = v * rhs;
      }
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '−') {
      v = take() === '+' ? v + term() : v - term();
    }
    return v;
  }
  const result = expr();
  expect(pos).toBe(tokens.length);
  return result;
}

const operandsOf = (p: Problem) => (p.prompt.match(/\d+/g) ?? []).map(Number);

describe('catálogo de niveles', () => {
  it('define 10 niveles ordenados del 1 al 10', () => {
    expect(MATH_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(MATH_LEVELS.map((l) => l.level))('nivel %i: el prompt evalúa a la respuesta entera', (level) => {
    for (const p of sample(level)) {
      expect(Number.isInteger(p.answer)).toBe(true);
      expect(evaluate(p.prompt)).toBe(p.answer);
    }
  });
});

describe('niveles 1–5', () => {
  it.each([1, 2, 3, 4, 5])('nivel %i: respuestas ≥ 0', (level) => {
    for (const p of sample(level)) expect(p.answer).toBeGreaterThanOrEqual(0);
  });

  it('nivel 1: suma de dos números de una cifra', () => {
    for (const p of sample(1)) {
      expect(p.prompt).toMatch(/^\d \+ \d$/);
    }
  });

  it('nivel 2: sumas y restas de una cifra', () => {
    const ops = new Set<string>();
    for (const p of sample(2)) {
      expect(p.prompt).toMatch(/^\d [+−] \d$/);
      ops.add(p.op);
    }
    expect(ops).toEqual(new Set(['add', 'sub']));
  });

  it('nivel 3: hasta dos cifras sin llevar ni prestar', () => {
    for (const p of sample(3)) {
      const [a, b] = operandsOf(p) as [number, number];
      expect(a).toBeLessThan(100);
      expect(b).toBeLessThan(100);
      if (p.op === 'add') {
        expect((a % 10) + (b % 10)).toBeLessThan(10);
        expect(a + b).toBeLessThan(100);
      } else {
        expect(a % 10).toBeGreaterThanOrEqual(b % 10);
      }
    }
  });

  it('nivel 4: tablas del 2 al 10', () => {
    for (const p of sample(4)) {
      expect(p.prompt).toMatch(/^\d+ × \d+$/);
      for (const n of operandsOf(p)) {
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(10);
      }
    }
  });

  it('nivel 5: divisiones exactas de las tablas y sumas/restas de dos cifras', () => {
    const ops = new Set<string>();
    for (const p of sample(5)) {
      ops.add(p.op);
      if (p.op === 'div') {
        const [dividend, divisor] = operandsOf(p) as [number, number];
        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(10);
        expect(dividend % divisor).toBe(0);
      }
    }
    expect(ops).toEqual(new Set(['div', 'add-carry', 'sub-borrow']));
  });
});

describe('niveles 6–10', () => {
  it('nivel 6: las cuatro operaciones con dos cifras', () => {
    const ops = new Set(sample(6).map((p) => p.op));
    expect(ops).toEqual(new Set(['add', 'sub', 'mul', 'div']));
  });

  it('nivel 7: incluye negativos, tres cifras y cuadrados', () => {
    const problems = sample(7);
    expect(problems.some((p) => p.answer < 0)).toBe(true);
    expect(problems.some((p) => p.op === 'square' && p.prompt.endsWith('²'))).toBe(true);
    expect(problems.some((p) => operandsOf(p).some((n) => n >= 100))).toBe(true);
  });

  it('nivel 8: dos operaciones con precedencia o paréntesis', () => {
    const problems = sample(8);
    for (const p of problems) {
      expect((p.prompt.match(/[+−×÷]/g) ?? []).length).toBe(2);
    }
    expect(problems.some((p) => p.prompt.includes('('))).toBe(true);
  });

  it('nivel 9: dos cifras × dos cifras, raíces y porcentajes', () => {
    const ops = new Set(sample(9).map((p) => p.op));
    expect(ops).toEqual(new Set(['mul', 'sqrt', 'percent']));
  });

  it('nivel 10: combina varias operaciones, potencias o porcentajes', () => {
    const problems = sample(10);
    expect(problems.some((p) => (p.prompt.match(/[+−×÷]/g) ?? []).length >= 3)).toBe(true);
    expect(problems.some((p) => p.prompt.includes('²'))).toBe(true);
    expect(problems.some((p) => p.prompt.includes('%'))).toBe(true);
  });
});
