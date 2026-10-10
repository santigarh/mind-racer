import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../rng';
import type { Challenge } from '../../types';
import { mathChallengeSource as source, parseIntegerAnswer } from './source';

const challenge = (answer: string, prompt = 'x'): Challenge => ({
  key: prompt,
  level: 1,
  prompt,
  answer,
  targetTimeMs: 1000,
});

describe('mathChallengeSource.next', () => {
  it('entrega desafíos del nivel pedido con su tiempo objetivo', () => {
    const c = source.next(4, mulberry32(1), []);
    expect(c.level).toBe(4);
    expect(c.prompt).toMatch(/^\d+ × \d+$/);
    expect(c.targetTimeMs).toBe(3000);
    expect(c.key).toBe(c.prompt);
  });

  it('texto de 7 × 8 con respuesta 56', () => {
    // Busca el problema en la secuencia para no depender de valores internos del PRNG.
    const rng = mulberry32(3);
    let found: Challenge | undefined;
    for (let i = 0; i < 2000 && !found; i++) {
      const c = source.next(4, rng, []);
      if (c.prompt === '7 × 8') found = c;
    }
    expect(found?.answer).toBe('56');
  });

  it('no repite un problema dentro de los últimos 10', () => {
    for (const level of [1, 2, 4, 8]) {
      const rng = mulberry32(level * 31);
      const recent: string[] = [];
      for (let i = 0; i < 500; i++) {
        const c = source.next(level, rng, recent);
        expect(recent).not.toContain(c.key);
        recent.push(c.key);
        if (recent.length > 10) recent.shift();
      }
    }
  });

  it('es reproducible con la misma semilla y niveles', () => {
    const levels = [1, 3, 5, 7, 9, 10, 2];
    const run = () => {
      const rng = mulberry32(2024);
      return levels.map((l) => source.next(l, rng, []));
    };
    expect(run()).toEqual(run());
  });
});

describe('validación de respuestas', () => {
  it('acepta ceros a la izquierda y espacios', () => {
    expect(source.check(challenge('56'), '056')).toBe(true);
    expect(source.check(challenge('56'), ' 5 6 ')).toBe(true);
  });

  it('acepta signo menos ASCII o matemático', () => {
    expect(source.check(challenge('-12'), '-12')).toBe(true);
    expect(source.check(challenge('-12'), '−12')).toBe(true);
    expect(source.check(challenge('-12'), '12')).toBe(false);
  });

  it('rechaza entradas no numéricas o vacías', () => {
    for (const input of ['', 'abc', '5a', '5.0', '--5', '+5', '1e2']) {
      expect(source.check(challenge('5'), input)).toBe(false);
    }
    expect(parseIntegerAnswer('1e2')).toBeNull();
  });

  it('rechaza respuestas incorrectas', () => {
    expect(source.check(challenge('56'), '55')).toBe(false);
  });
});
