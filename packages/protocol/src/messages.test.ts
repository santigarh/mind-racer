import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES } from './codes';
import { encode, parseClientMessage, parseServerMessage, publicChallengeSchema } from './messages';

const ok = (raw: unknown) => {
  const result = parseClientMessage(raw);
  if (!result.ok) throw new Error(result.error);
  return result.message;
};
const rejected = (raw: unknown) => parseClientMessage(raw).ok === false;

describe('mensajes cliente → servidor', () => {
  it('acepta crear y unirse, normalizando nombre y código', () => {
    expect(ok(JSON.stringify({ type: 'create', name: '  Ana   María ', level: 4 }))).toEqual({
      type: 'create',
      name: 'Ana María',
      level: 4,
    });
    expect(ok(JSON.stringify({ type: 'join', code: ' k7qf ', name: 'Leo', level: 2 }))).toMatchObject({
      code: 'K7QF',
    });
  });

  it('acepta el resto de mensajes', () => {
    for (const message of [
      { type: 'rejoin', code: 'K7QF', token: 'abc' },
      { type: 'setLevel', level: 10 },
      { type: 'start' },
      { type: 'answer', seq: 3, input: '-12' },
      { type: 'abandon' },
      { type: 'backToRoom' },
      { type: 'pong', id: 7 },
      { type: 'leave' },
    ]) {
      expect(ok(encode(message as never))).toMatchObject(message);
    }
  });

  it('rechaza nombres de 0 o 21 caracteres', () => {
    expect(rejected(JSON.stringify({ type: 'create', name: '   ', level: 1 }))).toBe(true);
    expect(rejected(JSON.stringify({ type: 'create', name: 'a'.repeat(21), level: 1 }))).toBe(true);
    expect(rejected(JSON.stringify({ type: 'create', name: 'a'.repeat(20), level: 1 }))).toBe(false);
  });

  it('rechaza niveles 0, 11 y no enteros', () => {
    for (const level of [0, 11, 15, 2.5, '3']) {
      expect(rejected(JSON.stringify({ type: 'setLevel', level }))).toBe(true);
    }
  });

  it('rechaza tipos desconocidos, JSON roto, no texto y mensajes demasiado grandes', () => {
    expect(rejected(JSON.stringify({ type: 'hack' }))).toBe(true);
    expect(rejected('{"type":')).toBe(true);
    expect(rejected(42)).toBe(true);
    expect(rejected(JSON.stringify({ type: 'leave', pad: 'x'.repeat(MAX_MESSAGE_BYTES) }))).toBe(true);
  });

  it('rechaza respuestas demasiado largas', () => {
    expect(rejected(JSON.stringify({ type: 'answer', seq: 1, input: '1'.repeat(13) }))).toBe(true);
  });
});

describe('mensajes servidor → cliente', () => {
  it('un desafío público no admite la respuesta', () => {
    const challenge = { seq: 1, level: 4, prompt: '7 × 8', answerLength: 2, issuedAtMs: 0 };
    expect(publicChallengeSchema.safeParse(challenge).success).toBe(true);
    expect(publicChallengeSchema.safeParse({ ...challenge, answer: '56' }).success).toBe(false);
  });

  it('valida un estado de carrera', () => {
    const result = parseServerMessage(
      JSON.stringify({
        type: 'state',
        phase: 'racing',
        elapsedMs: 1200,
        countdownRemainingMs: 0,
        runners: [
          {
            id: 'p1',
            distance: 12.5,
            speed: 9,
            streak: 1,
            nitroActive: false,
            position: 1,
            level: 4,
            maxLevel: 4,
            correct: 1,
            wrong: 0,
            finishTimeMs: null,
            presence: 'connected',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rechaza errores con códigos desconocidos', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'error', code: 'boom', message: 'x' })).ok).toBe(false);
  });
});
