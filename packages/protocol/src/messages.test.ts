import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, MAX_SERVER_MESSAGE_BYTES } from './codes';
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

describe('auto del garaje en los mensajes', () => {
  const join = (car?: unknown) =>
    parseClientMessage(JSON.stringify({ type: 'join', code: 'k7qf', name: 'Lucía', level: 2, ...(car === undefined ? {} : { car }) }));

  it('acepta un auto válido en crear y unirse', () => {
    expect(join({ body: 'motorcycle', paint: 'red' })).toMatchObject({
      ok: true,
      message: { car: { body: 'motorcycle', paint: 'red' } },
    });
    const create = parseClientMessage(
      JSON.stringify({ type: 'create', name: 'Papá', level: 8, car: { body: 'truck', paint: 'blue' } }),
    );
    expect(create).toMatchObject({ ok: true, message: { car: { body: 'truck', paint: 'blue' } } });
  });

  it('sin auto sigue siendo válido (versión vieja del juego)', () => {
    const parsed = join();
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && 'car' in parsed.message ? parsed.message.car : undefined).toBeUndefined();
  });

  it('un auto inválido no rechaza el mensaje: se trata como ausente', () => {
    for (const car of [{ body: 'nave', paint: 'red' }, { body: 'truck', paint: 'neon' }, 'rojo', null, 42]) {
      const parsed = join(car);
      expect(parsed.ok).toBe(true);
      expect(parsed.ok && parsed.message.type === 'join' ? parsed.message.car : 'x').toBeUndefined();
    }
  });

  it('la sala y la carrera llevan el auto de cada persona', () => {
    const room = parseServerMessage(
      JSON.stringify({
        type: 'room',
        code: 'K7QF',
        phase: 'lobby',
        hostId: 'p1',
        players: [{ id: 'p1', name: 'Papá', level: 8, connected: true, status: 'lobby', car: { body: 'truck', paint: 'blue' } }],
      }),
    );
    expect(room).toMatchObject({ ok: true, message: { players: [{ car: { body: 'truck', paint: 'blue' } }] } });
    const start = parseServerMessage(
      JSON.stringify({
        type: 'raceStart',
        seed: 1,
        distance: 1000,
        runners: [
          { id: 'p1', name: 'Papá', kind: 'human', chosenLevel: 8, car: { body: 'van', paint: 'gold' } },
          { id: 'b', name: 'Euler', kind: 'bot', chosenLevel: 8, botProfile: 'turbo' },
        ],
      }),
    );
    expect(start).toMatchObject({ ok: true, message: { runners: [{ car: { body: 'van', paint: 'gold' } }, { botProfile: 'turbo' }] } });
  });
});

describe('modo clase en los mensajes', () => {
  const parse = (m: unknown) => parseClientMessage(JSON.stringify(m));

  it('crear una sala de clase, y sin modo sigue siendo una sala familiar', () => {
    expect(parse({ type: 'create', name: 'Profe Ana', level: 5, mode: 'class' })).toMatchObject({
      ok: true,
      message: { mode: 'class' },
    });
    const family = parse({ type: 'create', name: 'Papá', level: 5 });
    expect(family.ok && family.message.type === 'create' ? family.message.mode : 'x').toBeUndefined();
    expect(parse({ type: 'create', name: 'Papá', level: 5, mode: 'escuela' }).ok).toBe(false);
  });

  it('quitar a un alumno y cerrar la sala', () => {
    expect(parse({ type: 'kick', playerId: 'p7' })).toMatchObject({ ok: true, message: { type: 'kick', playerId: 'p7' } });
    expect(parse({ type: 'kick' }).ok).toBe(false);
    expect(parse({ type: 'kick', playerId: '' }).ok).toBe(false);
    expect(parse({ type: 'closeRoom' })).toMatchObject({ ok: true });
  });

  it('la sala informa su modo y el rol de cada persona, y los mensajes viejos siguen valiendo', () => {
    const room = (extra: object, player: object = {}) =>
      parseServerMessage(
        JSON.stringify({
          type: 'room',
          code: 'K7QF',
          phase: 'lobby',
          hostId: 'p1',
          players: [{ id: 'p1', name: 'Profe Ana', level: 5, connected: true, status: 'lobby', ...player }],
          ...extra,
        }),
      );
    expect(room({ mode: 'class' }, { role: 'teacher' })).toMatchObject({
      ok: true,
      message: { mode: 'class', players: [{ role: 'teacher' }] },
    });
    expect(room({}).ok).toBe(true);
    expect(room({ mode: 'colegio' }).ok).toBe(false);
  });

  it('el inicio de carrera trae su número y su hora, y sin ellos sigue valiendo', () => {
    const start = (extra: object) =>
      parseServerMessage(JSON.stringify({ type: 'raceStart', seed: 1, distance: 1000, runners: [], ...extra }));
    expect(start({ raceNumber: 2, startedAt: 1_792_000_000_000 })).toMatchObject({
      ok: true,
      message: { raceNumber: 2, startedAt: 1_792_000_000_000 },
    });
    expect(start({}).ok).toBe(true);
    expect(start({ raceNumber: 1.5 }).ok).toBe(false);
    expect(start({ raceNumber: 0 }).ok).toBe(false);
  });

  it('errores nuevos para quien fue quitado y para la sala cerrada', () => {
    for (const code of ['removed', 'room-closed']) {
      expect(parseServerMessage(JSON.stringify({ type: 'error', code, message: 'x' })).ok).toBe(true);
    }
  });
});

describe('tamaño de los mensajes del servidor', () => {
  const result = (i: number) => ({
    id: `p${i}`, name: `Alumno número ${i}`, kind: 'human', position: i, chosenLevel: 3, finished: true,
    finishTimeMs: 61_234.5678, distance: 1000, correct: 20, wrong: 2, accuracy: 0.9090909, correctPerMinute: 19.6543, maxLevel: 4,
    presence: 'connected',
  });

  it('acepta la clasificación de una clase de 40, aunque supere el límite de los clientes', () => {
    const raw = JSON.stringify({ type: 'results', results: Array.from({ length: 40 }, (_, i) => result(i + 1)) });
    expect(raw.length).toBeGreaterThan(MAX_MESSAGE_BYTES);
    expect(parseServerMessage(raw).ok).toBe(true);
  });

  it('sigue rechazando mensajes del servidor enormes', () => {
    const raw = JSON.stringify({ type: 'ping', id: 1, pad: 'x'.repeat(MAX_SERVER_MESSAGE_BYTES) });
    expect(parseServerMessage(raw)).toMatchObject({ ok: false });
  });
});
