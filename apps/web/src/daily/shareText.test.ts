import { describe, expect, it } from 'vitest';
import { dailyShareText, longDate } from './shareText';

describe('texto para compartir el desafío', () => {
  it('con llegada: fecha, nivel, puesto, tiempo, correctas y racha', () => {
    const text = dailyShareText(
      '2026-10-11',
      { level: 3, position: 1, finished: true, finishTimeMs: 42_300, correct: 18, wrong: 2 },
      5,
    );
    expect(text).toBe('Mind Racer · Desafío del 11 oct · Nivel 3\n🏁 1.º · 0:42,3 · 18/20\n🔥 Racha de 5 días');
  });

  it('sin llegar a la meta, y racha de 1 día en singular', () => {
    const text = dailyShareText(
      '2026-01-02',
      { level: 7, position: 4, finished: false, finishTimeMs: null, correct: 15, wrong: 7 },
      1,
    );
    expect(text).toBe('Mind Racer · Desafío del 2 ene · Nivel 7\n🏁 Sin llegar · 15/22\n🔥 Racha de 1 día');
  });

  it('la fecha larga lleva el día de la semana', () => {
    expect(longDate('2026-10-11')).toBe('dom 11 oct');
  });
});
