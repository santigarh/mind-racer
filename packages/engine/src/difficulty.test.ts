import { describe, expect, it } from 'vitest';
import { DEFAULT_RACE_CONFIG } from './config';
import { DifficultyController } from './difficulty';
import { Race } from './race';
import type { ChallengeSource } from './types';

const TARGET = 3000;
const fast = (c: DifficultyController) => c.record(true, TARGET - 1, TARGET);
const slow = (c: DifficultyController) => c.record(true, TARGET + 1, TARGET);
const wrong = (c: DifficultyController) => c.record(false, 1000, TARGET);

describe('DifficultyController', () => {
  it('empieza en el nivel elegido', () => {
    expect(new DifficultyController(4).level).toBe(4);
  });

  it('rango: elegido −1 a +2, dentro de 1–10', () => {
    expect(new DifficultyController(4)).toMatchObject({ minLevel: 3, maxLevel: 6 });
    expect(new DifficultyController(1)).toMatchObject({ minLevel: 1, maxLevel: 3 });
    expect(new DifficultyController(10)).toMatchObject({ minLevel: 9, maxLevel: 10 });
  });

  it('sube 1 tras 3 aciertos seguidos rápidos', () => {
    const c = new DifficultyController(4);
    fast(c);
    fast(c);
    expect(fast(c)).toBe('up');
    expect(c.level).toBe(5);
  });

  it('no sube si alguno de los 3 aciertos fue lento', () => {
    const c = new DifficultyController(4);
    fast(c);
    slow(c);
    fast(c);
    expect(c.level).toBe(4);
  });

  it('respeta el límite superior', () => {
    const c = new DifficultyController(4);
    for (let i = 0; i < 30; i++) fast(c);
    expect(c.level).toBe(6);
  });

  it('baja 1 tras 2 errores dentro de los últimos 4', () => {
    const c = new DifficultyController(5);
    wrong(c);
    slow(c);
    expect(wrong(c)).toBe('down');
    expect(c.level).toBe(4);
  });

  it('2 errores separados por más de 4 desafíos no bajan', () => {
    const c = new DifficultyController(5);
    wrong(c);
    slow(c);
    slow(c);
    slow(c);
    wrong(c);
    expect(c.level).toBe(5);
  });

  it('en el nivel 1 fallar repetidamente lo deja en 1', () => {
    const c = new DifficultyController(1);
    for (let i = 0; i < 10; i++) wrong(c);
    expect(c.level).toBe(1);
  });

  it('reinicia la ventana tras un cambio: hacen falta otros 3 rápidos', () => {
    const c = new DifficultyController(4);
    fast(c);
    fast(c);
    fast(c);
    expect(c.level).toBe(5);
    fast(c);
    fast(c);
    expect(c.level).toBe(5);
    fast(c);
    expect(c.level).toBe(6);
  });

  it('reinicia la ventana tras bajar: un error más no vuelve a bajar', () => {
    const c = new DifficultyController(5);
    wrong(c);
    wrong(c);
    expect(c.level).toBe(4);
    wrong(c);
    expect(c.level).toBe(4);
  });

  it('recuerda el nivel máximo alcanzado', () => {
    const c = new DifficultyController(4);
    for (let i = 0; i < 6; i++) fast(c);
    wrong(c);
    wrong(c);
    expect(c.level).toBe(5);
    expect(c.maxReached).toBe(6);
  });
});

describe('dificultad adaptativa en el motor', () => {
  // Fuente que codifica el nivel en el prompt y siempre espera "1".
  const levelSource: ChallengeSource = {
    next: (level, rng) => ({
      key: String(rng.next()),
      level,
      prompt: `nivel ${level}`,
      answer: '1',
      targetTimeMs: 2000,
    }),
    check: (_, input) => input === '1',
  };
  const COUNTDOWN = DEFAULT_RACE_CONFIG.countdownMs;

  function setup(level: number) {
    const race = new Race({
      seed: 3,
      level,
      runners: [{ id: 'p', name: 'P', kind: 'human' }],
      source: levelSource,
      config: { distance: 1e9 },
    });
    race.start(0);
    race.advanceTo(COUNTDOWN);
    return race;
  }
  const state = (race: Race) => race.snapshot().runners[0]!;

  it('el primer desafío es del nivel elegido', () => {
    expect(state(setup(4)).challenge!.level).toBe(4);
  });

  it('tras 3 aciertos rápidos el siguiente desafío es de nivel +1', () => {
    const race = setup(4);
    for (let i = 1; i <= 3; i++) race.submitAnswer('p', '1', COUNTDOWN + i * 1000);
    expect(state(race).challenge).toMatchObject({ level: 5, prompt: 'nivel 5' });
  });

  it('tras 2 errores en 4 el siguiente desafío es de nivel −1', () => {
    const race = setup(5);
    race.submitAnswer('p', '0', COUNTDOWN + 1000);
    race.submitAnswer('p', '0', COUNTDOWN + 2000);
    expect(state(race).challenge!.level).toBe(4);
  });

  it('la clasificación informa el nivel máximo alcanzado', () => {
    const race = setup(4);
    for (let i = 1; i <= 6; i++) race.submitAnswer('p', '1', COUNTDOWN + i * 1000);
    race.submitAnswer('p', '0', COUNTDOWN + 7000);
    race.submitAnswer('p', '0', COUNTDOWN + 8000);
    expect(state(race).maxLevel).toBe(6);
    race.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
    expect(race.snapshot().results![0]!.maxLevel).toBe(6);
  });
});
