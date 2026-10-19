import { describe, expect, it } from 'vitest';
import type { RunnerResult } from '@mind-racer/engine';
import { STANDINGS_HEADERS, standingsRows } from './standings';

const result = (extra: Partial<RunnerResult> = {}): RunnerResult => ({
  id: 'p2',
  name: 'Leo',
  kind: 'human',
  position: 1,
  chosenLevel: 3,
  finished: true,
  finishTimeMs: 42_300,
  distance: 1000,
  correct: 18,
  wrong: 2,
  accuracy: 0.9,
  correctPerMinute: 25.5,
  maxLevel: 3,
  ...extra,
});

/** The row of one result as {header: cell}. */
const row = (r: RunnerResult, presence: Record<string, 'connected' | 'disconnected' | 'left'> = {}) => {
  const [first] = standingsRows([r], presence, 1000);
  return Object.fromEntries(STANDINGS_HEADERS.map((h, i) => [h, first!.cells[i]]));
};

describe('filas de la clasificación', () => {
  it('quien llegó: estado "Llegó", su tiempo y avance completo', () => {
    expect(row(result())).toMatchObject({ Estado: 'Llegó', Tiempo: '0:42,3', Avance: '100 %', Precisión: '90 %' });
  });

  it('quien abandonó a mitad del recorrido dice "Se fue", sin tiempo (Alumno que abandonó)', () => {
    const r = result({ finished: false, finishTimeMs: null, distance: 487 });
    expect(row(r, { p2: 'left' })).toMatchObject({ Estado: 'Se fue', Tiempo: '—', Avance: '49 %' });
  });

  it('quien se desconectó dice "Desconectado" (Alumno desconectado al terminar)', () => {
    const r = result({ finished: false, finishTimeMs: null, distance: 300 });
    expect(row(r, { p2: 'disconnected' }).Estado).toBe('Desconectado');
    expect(row(r, { p2: 'connected' }).Estado).toBe('Sin llegar');
    expect(row(r).Estado).toBe('Sin llegar');
  });

  it('sin respuestas, la precisión no es 0 % (Alumno sin respuestas)', () => {
    const r = result({ finished: false, finishTimeMs: null, distance: 0, correct: 0, wrong: 0, accuracy: 0 });
    expect(row(r).Precisión).toBe('sin respuestas');
    expect(row(result({ correct: 0, wrong: 4, accuracy: 0 })).Precisión).toBe('0 %');
  });

  it('muestra el nivel elegido y el máximo alcanzado (Subió de nivel)', () => {
    expect(row(result({ chosenLevel: 3, maxLevel: 5 }))).toMatchObject({ Nivel: '3', 'Nivel máximo': '5', Tablas: '—' });
  });

  it('ordena por puesto', () => {
    const rows = standingsRows([result({ id: 'b', position: 2 }), result({ id: 'a', position: 1 })], {}, 1000);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('carrera de tablas', () => {
  it('dice qué se practicó y deja los niveles en "—" (Carrera de tablas)', () => {
    const [first] = standingsRows([result({ chosenLevel: 4, maxLevel: 4 })], {}, 1000, { tables: [7, 8], divisions: true });
    const cells = Object.fromEntries(STANDINGS_HEADERS.map((h, i) => [h, first!.cells[i]]));
    expect(cells).toMatchObject({ Nivel: '—', 'Nivel máximo': '—', Tablas: '7, 8 + divisiones' });
  });
});
