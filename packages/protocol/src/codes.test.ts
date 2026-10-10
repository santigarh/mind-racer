import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@mind-racer/engine';
import { ROOM_CODE_ALPHABET, generateRoomCode, isRoomCode, normalizeRoomCode } from './codes';

describe('códigos de sala', () => {
  it('normaliza lo que escribe el jugador', () => {
    expect(normalizeRoomCode('k7qf')).toBe('K7QF');
    expect(normalizeRoomCode(' k7 qf ')).toBe('K7QF');
  });

  it('el alfabeto no tiene caracteres ambiguos', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
  });

  it('genera códigos de 4 caracteres válidos sin ambiguos', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 5000; i++) {
      const code = generateRoomCode(() => rng.next());
      expect(isRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('rechaza códigos con caracteres ambiguos o largo incorrecto', () => {
    for (const code of ['K0QF', 'KOQF', 'K1QF', 'KIQF', 'KLQF', 'K7Q', 'K7QFF', 'k7qf']) {
      expect(isRoomCode(code)).toBe(false);
    }
  });
});
