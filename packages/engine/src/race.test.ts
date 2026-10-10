import { describe, expect, it } from 'vitest';
import { DEFAULT_RACE_CONFIG } from './config';
import { mathChallengeSource } from './challenges/math/source';
import { Race, type RaceOptions } from './race';
import type { ChallengeSource, RunnerSpec } from './types';

/** Non-math source: always asks for the word "ok"; target time = level seconds. */
const wordSource: ChallengeSource = {
  next(level, rng) {
    const n = rng.int(0, 1_000_000);
    return { key: `w${n}`, level, prompt: `Escribe ok (${n})`, answer: 'ok', targetTimeMs: level * 1000 };
  },
  check: (challenge, input) => input.trim() === challenge.answer,
};

const runners = (n: number): RunnerSpec[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `Runner ${i}`, kind: i === 0 ? 'human' : 'bot' }));

function makeRace(overrides: Partial<RaceOptions> = {}): Race {
  return new Race({ seed: 1, level: 3, runners: runners(2), source: wordSource, ...overrides });
}

const COUNTDOWN = DEFAULT_RACE_CONFIG.countdownMs;

/** Starts at 0 and advances to racing start. */
function racing(overrides: Partial<RaceOptions> = {}): Race {
  const race = makeRace(overrides);
  race.start(0);
  race.advanceTo(COUNTDOWN);
  expect(race.phase).toBe('racing');
  return race;
}

const runner = (race: Race, id = 'r0') => race.snapshot().runners.find((r) => r.id === id)!;

describe('fases de la carrera', () => {
  it('waiting → countdown (3 s) → racing', () => {
    const race = makeRace();
    expect(race.phase).toBe('waiting');
    race.start(1000);
    expect(race.phase).toBe('countdown');
    race.advanceTo(1000 + COUNTDOWN - 10);
    expect(race.phase).toBe('countdown');
    expect(race.snapshot().countdownRemainingMs).toBe(10);
    race.advanceTo(1000 + COUNTDOWN);
    expect(race.phase).toBe('racing');
    expect(race.snapshot().elapsedMs).toBe(0);
  });

  it('el primer desafío aparece al empezar racing', () => {
    const race = makeRace();
    race.start(0);
    expect(runner(race).challenge).toBeNull();
    race.advanceTo(COUNTDOWN);
    expect(runner(race).challenge).not.toBeNull();
  });

  it('ignora respuestas en waiting y countdown sin ganar velocidad', () => {
    const race = makeRace();
    expect(race.submitAnswer('r0', 'ok', 0)).toBeNull();
    race.start(0);
    expect(race.submitAnswer('r0', 'ok', 1500)).toBeNull();
    expect(runner(race).speed).toBe(0);
    expect(runner(race).correct).toBe(0);
  });

  it('no puede iniciarse dos veces', () => {
    const race = makeRace();
    race.start(0);
    expect(() => race.start(10)).toThrow();
  });
});

describe('modelo de velocidad', () => {
  it('una respuesta correcta acelera inmediatamente', () => {
    const race = racing();
    const outcome = race.submitAnswer('r0', 'ok', COUNTDOWN + 2000);
    expect(outcome?.correct).toBe(true);
    expect(runner(race).speed).toBeGreaterThan(0);
  });

  it('el impulso es c · T · q', () => {
    const race = racing({ level: 3 });
    // Respuesta justo en el tiempo objetivo (3 s) → q = 1.
    race.submitAnswer('r0', 'ok', COUNTDOWN + 3000);
    expect(runner(race).speed).toBeCloseTo(DEFAULT_RACE_CONFIG.boostPerTargetSecond * 3, 6);
  });

  it('un desafío más difícil da más impulso con el mismo tiempo de respuesta', () => {
    const boostAt = (level: number) => {
      const race = racing({ level });
      race.submitAnswer('r0', 'ok', COUNTDOWN + 2000);
      return runner(race).speed;
    };
    expect(boostAt(4)).toBeGreaterThan(boostAt(2));
  });

  it('responder más rápido da más impulso', () => {
    const boostAfter = (ms: number) => {
      const race = racing();
      race.submitAnswer('r0', 'ok', COUNTDOWN + ms);
      return runner(race).speed;
    };
    expect(boostAfter(2000)).toBeGreaterThan(boostAfter(4000));
  });

  it('no supera la velocidad máxima', () => {
    const race = racing({ level: 10, config: { nitroStreak: 1000 } });
    for (let i = 1; i <= 8; i++) race.submitAnswer('r0', 'ok', COUNTDOWN + i * 100);
    expect(runner(race).speed).toBe(DEFAULT_RACE_CONFIG.maxSpeed);
  });

  it('la velocidad decae a la mitad en la vida media y llega a cero sin responder', () => {
    const race = racing();
    race.submitAnswer('r0', 'ok', COUNTDOWN);
    const v0 = runner(race).speed;
    race.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.speedHalfLifeS * 1000);
    expect(runner(race).speed).toBeCloseTo(v0 / 2, 6);
    race.advanceTo(COUNTDOWN + 60_000);
    expect(runner(race).speed).toBe(0);
  });

  it('una respuesta incorrecta frena a la mitad, reinicia la racha y entrega otro desafío', () => {
    const race = racing();
    race.submitAnswer('r0', 'ok', COUNTDOWN + 1000);
    race.submitAnswer('r0', 'ok', COUNTDOWN + 2000);
    const before = runner(race);
    expect(before.streak).toBe(2);
    const outcome = race.submitAnswer('r0', 'nope', COUNTDOWN + 2000);
    const after = runner(race);
    expect(outcome).toMatchObject({ correct: false, expected: 'ok', given: 'nope' });
    expect(after.speed).toBeCloseTo(before.speed * DEFAULT_RACE_CONFIG.wrongAnswerSpeedFactor, 6);
    expect(after.streak).toBe(0);
    expect(after.wrong).toBe(1);
    expect(after.challenge!.seq).toBe(before.challenge!.seq + 1);
  });
});

describe('racha y nitro', () => {
  it('el 5.º acierto seguido activa nitro, supera vMax y reinicia la racha', () => {
    const race = racing({ level: 10 });
    for (let i = 1; i <= 4; i++) {
      expect(race.submitAnswer('r0', 'ok', COUNTDOWN + i * 100)?.nitro).toBe(false);
    }
    expect(runner(race).streak).toBe(4);
    const fifth = race.submitAnswer('r0', 'ok', COUNTDOWN + 500);
    expect(fifth?.nitro).toBe(true);
    const state = runner(race);
    expect(state.nitroActive).toBe(true);
    expect(state.streak).toBe(0);
    expect(state.speed).toBeGreaterThan(DEFAULT_RACE_CONFIG.maxSpeed);
  });

  it('el nitro dura 2 s', () => {
    const race = racing({ config: { nitroStreak: 1 } });
    race.submitAnswer('r0', 'ok', COUNTDOWN + 1000);
    race.advanceTo(COUNTDOWN + 1000 + DEFAULT_RACE_CONFIG.nitroDurationMs - 10);
    expect(runner(race).nitroActive).toBe(true);
    race.advanceTo(COUNTDOWN + 1000 + DEFAULT_RACE_CONFIG.nitroDurationMs);
    expect(runner(race).nitroActive).toBe(false);
  });

  it('un error durante la racha impide el nitro', () => {
    const race = racing();
    for (let i = 1; i <= 4; i++) race.submitAnswer('r0', 'ok', COUNTDOWN + i * 100);
    race.submitAnswer('r0', 'x', COUNTDOWN + 500);
    expect(race.submitAnswer('r0', 'ok', COUNTDOWN + 600)?.nitro).toBe(false);
  });
});

describe('meta, límite de tiempo y clasificación', () => {
  /** Answers correctly every `everyMs` until finishing. */
  function drive(race: Race, id: string, everyMs: number, untilMs: number) {
    for (let t = COUNTDOWN + everyMs; t <= untilMs && race.phase === 'racing'; t += everyMs) {
      race.submitAnswer(id, 'ok', t);
    }
  }

  it('un corredor que alcanza la distancia queda terminado y no recibe más desafíos', () => {
    const race = racing({ runners: runners(2) });
    drive(race, 'r0', 500, COUNTDOWN + 120_000);
    const r0 = runner(race, 'r0');
    expect(r0.finishTimeMs).not.toBeNull();
    expect(r0.distance).toBe(DEFAULT_RACE_CONFIG.distance);
    expect(r0.challenge).toBeNull();
    expect(race.submitAnswer('r0', 'ok', race.nowMs + 10)).toBeNull();
    expect(race.phase).toBe('racing'); // r1 sigue corriendo
  });

  it('cuando todos llegan, la carrera termina y ordena por tiempo', () => {
    const race = racing({ runners: runners(3) });
    for (let t = COUNTDOWN + 100; race.phase === 'racing'; t += 100) {
      // r2 responde más seguido que r1, y r1 más que r0.
      if ((t / 100) % 2 === 0) race.submitAnswer('r1', 'ok', t);
      race.submitAnswer('r2', 'ok', t);
      if ((t / 100) % 3 === 0) race.submitAnswer('r0', 'ok', t);
    }
    const results = race.snapshot().results!;
    expect(results.map((r) => r.id)).toEqual(['r2', 'r1', 'r0']);
    expect(results.every((r) => r.finished)).toBe(true);
    expect(results[0]!.finishTimeMs!).toBeLessThan(results[1]!.finishTimeMs!);
    expect(results.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('al agotarse 3 minutos termina y los no terminados van detrás por distancia', () => {
    const race = racing({ runners: runners(3) });
    drive(race, 'r1', 500, COUNTDOWN + 120_000);
    // r0 y r2 avanzan poco: r2 más que r0.
    race.submitAnswer('r2', 'ok', race.nowMs + 10);
    race.submitAnswer('r2', 'ok', race.nowMs + 10);
    race.submitAnswer('r0', 'ok', race.nowMs + 10);
    race.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs - 10);
    expect(race.phase).toBe('racing');
    race.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
    expect(race.phase).toBe('finished');
    const results = race.snapshot().results!;
    expect(results.map((r) => r.id)).toEqual(['r1', 'r2', 'r0']);
    expect(results[0]!.finished).toBe(true);
    expect(results[1]!.finished).toBe(false);
    expect(results[1]!.distance).toBeGreaterThan(results[2]!.distance);
  });

  it('calcula aciertos, errores, precisión y correctas por minuto', () => {
    const race = racing({ runners: runners(1), config: { timeLimitMs: 60_000 } });
    for (let i = 1; i <= 3; i++) race.submitAnswer('r0', 'ok', COUNTDOWN + i * 1000);
    race.submitAnswer('r0', 'mal', COUNTDOWN + 5000);
    race.advanceTo(COUNTDOWN + 60_000);
    const [result] = race.snapshot().results!;
    expect(result).toMatchObject({ correct: 3, wrong: 1, accuracy: 0.75, finished: false, position: 1 });
    expect(result!.correctPerMinute).toBeCloseTo(3, 6);
  });

  it('la posición en vivo refleja quién va adelante', () => {
    const race = racing();
    race.submitAnswer('r1', 'ok', COUNTDOWN + 1000);
    race.advanceTo(COUNTDOWN + 2000);
    expect(runner(race, 'r1').position).toBe(1);
    expect(runner(race, 'r0').position).toBe(2);
  });
});

describe('determinismo e independencia de variante', () => {
  type Event = [string, string, number];

  function replay(seed: number, events: Event[]) {
    const race = new Race({ seed, level: 5, runners: runners(3), source: mathChallengeSource });
    race.start(0);
    const prompts: string[] = [];
    for (const [id, kind, at] of events) {
      race.advanceTo(at);
      const challenge = race.peekChallenge(id);
      if (!challenge) continue;
      prompts.push(challenge.prompt);
      race.submitAnswer(id, kind === 'right' ? challenge.answer : '-999', at);
    }
    race.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
    return { snapshot: race.snapshot(), prompts };
  }

  const events: Event[] = Array.from({ length: 300 }, (_, i) => [
    `r${i % 3}`,
    i % 7 === 0 ? 'wrong' : 'right',
    COUNTDOWN + 250 + i * 330,
  ]);

  it('misma semilla y eventos ⇒ mismo estado y clasificación', () => {
    const a = replay(77, events);
    const b = replay(77, events);
    expect(a.snapshot).toEqual(b.snapshot);
    expect(a.prompts).toEqual(b.prompts);
    expect(a.snapshot.results).not.toBeNull();
  });

  it('otra semilla ⇒ otros desafíos', () => {
    expect(replay(77, events).prompts).not.toEqual(replay(78, events).prompts);
  });

  it('funciona con una fuente de desafíos no matemática', () => {
    const race = racing({ source: wordSource, runners: runners(1) });
    expect(runner(race).challenge!.prompt).toMatch(/^Escribe ok/);
    for (let t = COUNTDOWN + 400; race.phase === 'racing'; t += 400) race.submitAnswer('r0', 'ok', t);
    const [result] = race.snapshot().results!;
    expect(result).toMatchObject({ finished: true, position: 1, wrong: 0 });
  });

  it('peekChallenge expone la respuesta solo al motor; la instantánea solo su longitud', () => {
    const race = racing({ source: mathChallengeSource });
    const full = race.peekChallenge('r0')!;
    const pub = runner(race).challenge!;
    expect(pub).not.toHaveProperty('answer');
    expect(pub.answerLength).toBe(full.answer.length);
    expect(pub.prompt).toBe(full.prompt);
  });
});
