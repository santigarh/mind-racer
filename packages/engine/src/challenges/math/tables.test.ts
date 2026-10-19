import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../rng';
import type { Challenge } from '../../types';
import { createTablesSource, normalizeTables, type TablesSelection } from './tables';

/** Every distinct problem a selection can produce, by drawing many with no `recent`. */
function drawAll(selection: TablesSelection, draws = 3000, seed = 7): Map<string, Challenge> {
  const source = createTablesSource(selection);
  const rng = mulberry32(seed);
  const seen = new Map<string, Challenge>();
  for (let i = 0; i < draws; i++) {
    const c = source.next(4, rng, []);
    seen.set(c.prompt, c);
  }
  return seen;
}

describe('normalizeTables', () => {
  it('ordena y quita duplicados (Varias tablas)', () => {
    expect(normalizeTables({ tables: [8, 7, 7], divisions: false })).toEqual({ tables: [7, 8], divisions: false });
  });

  it('una selección vacía o fuera de rango no es una práctica', () => {
    expect(normalizeTables({ tables: [], divisions: false })).toBeNull();
    expect(normalizeTables({ tables: [7, 11], divisions: false })).toBeNull();
    expect(normalizeTables({ tables: [1], divisions: true })).toBeNull();
    expect(normalizeTables({ tables: [2.5], divisions: false })).toBeNull();
  });

  it('el generador no acepta una selección vacía', () => {
    expect(() => createTablesSource({ tables: [], divisions: false })).toThrow();
  });
});

describe('createTablesSource', () => {
  it('tabla del 7: 7 × k y k × 7, con k del 1 al 10 (19 problemas)', () => {
    const all = drawAll({ tables: [7], divisions: false });
    expect(all.size).toBe(19);
    for (const c of all.values()) {
      const [a, b] = c.prompt.split(' × ').map(Number) as [number, number];
      expect(a === 7 || b === 7).toBe(true);
      expect(Math.min(a, b) >= 1 && Math.max(a, b) <= 10).toBe(true);
      expect(c.answer).toBe(String(a * b));
      expect(c.level).toBe(4);
      expect(c.targetTimeMs).toBe(3000);
    }
  });

  it('orden mezclado: el 7 sale primero y también segundo', () => {
    const prompts = [...drawAll({ tables: [7], divisions: false }).keys()];
    expect(prompts).toContain('7 × 3');
    expect(prompts).toContain('3 × 7');
  });

  it('nada fuera de las tablas elegidas (3 y 9)', () => {
    for (const c of drawAll({ tables: [9, 3], divisions: false }).values()) {
      const [a, b] = c.prompt.split(' × ').map(Number) as [number, number];
      const ok = ([3, 9].includes(a) && b >= 1 && b <= 10) || ([3, 9].includes(b) && a >= 1 && a <= 10);
      expect(ok, c.prompt).toBe(true);
    }
  });

  it('divisiones de la tabla del 7: 21 ÷ 7, nunca 21 ÷ 3', () => {
    const all = drawAll({ tables: [7], divisions: true });
    expect(all.get('21 ÷ 7')).toMatchObject({ answer: '3', level: 5, targetTimeMs: 3500 });
    expect(all.has('21 ÷ 3')).toBe(false);
    const divisions = [...all.values()].filter((c) => c.prompt.includes('÷'));
    expect(divisions).toHaveLength(10);
    for (const c of divisions) expect(c.prompt).toMatch(/ ÷ 7$/);
  });

  it('divisiones apagadas: ninguna división', () => {
    for (const prompt of drawAll({ tables: [7], divisions: false }).keys()) expect(prompt).not.toContain('÷');
  });

  it('no repite un problema dentro de los últimos 10 (Una sola tabla)', () => {
    const source = createTablesSource({ tables: [2], divisions: false });
    const rng = mulberry32(99);
    const recent: string[] = [];
    for (let i = 0; i < 500; i++) {
      const c = source.next(4, rng, recent);
      expect(recent).not.toContain(c.key);
      recent.push(c.key);
      if (recent.length > 10) recent.shift();
    }
  });

  it('es reproducible con la misma semilla (Misma semilla)', () => {
    const run = () => {
      const source = createTablesSource({ tables: [4, 5], divisions: true });
      const rng = mulberry32(2024);
      const recent: string[] = [];
      return Array.from({ length: 50 }, () => {
        const c = source.next(4, rng, recent);
        recent.push(c.key);
        if (recent.length > 10) recent.shift();
        return c.prompt;
      });
    };
    expect(run()).toEqual(run());
  });

  it('valida respuestas enteras', () => {
    const source = createTablesSource({ tables: [7], divisions: false });
    const c = source.next(4, mulberry32(1), []);
    expect(source.check(c, c.answer)).toBe(true);
    expect(source.check(c, `${c.answer}1`)).toBe(false);
    expect(source.check(c, 'abc')).toBe(false);
  });
});
