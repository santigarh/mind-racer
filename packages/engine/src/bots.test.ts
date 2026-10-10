import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, BotAgent, pickBotNames } from './bots';
import { DEFAULT_RACE_CONFIG } from './config';
import { mulberry32 } from './rng';
import { LocalRaceSession, PLAYER_ID } from './session';

const COUNTDOWN = DEFAULT_RACE_CONFIG.countdownMs;

const challenge = (level: number, targetTimeMs: number) => ({
  key: 'k',
  level,
  prompt: 'p',
  answer: '42',
  targetTimeMs,
  seq: 1,
  issuedAtMs: 1000,
});

describe('BotAgent', () => {
  it('tarda más en desafíos de mayor nivel (calibración)', () => {
    const plansAt = (targetTimeMs: number) => {
      const bot = new BotAgent('b', BOT_PROFILES.crucero, mulberry32(5));
      return Array.from({ length: 500 }, () => bot.plan(challenge(1, targetTimeMs)).atMs - 1000);
    };
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(plansAt(8000))).toBeGreaterThan(mean(plansAt(2500)) * 2);
  });

  it('acierta con la probabilidad de su perfil y falla con respuestas plausibles', () => {
    const bot = new BotAgent('b', BOT_PROFILES.tortuga, mulberry32(9));
    const moves = Array.from({ length: 4000 }, () => bot.plan(challenge(3, 3000)));
    const wrong = moves.filter((m) => m.input !== '42');
    expect(wrong.length / moves.length).toBeCloseTo(1 - BOT_PROFILES.tortuga.accuracy, 1);
    for (const m of wrong) {
      const diff = Math.abs(Number(m.input) - 42);
      expect(diff).toBeGreaterThanOrEqual(1);
      expect(diff).toBeLessThanOrEqual(10);
    }
  });

  it('elige nombres distintos', () => {
    const names = pickBotNames(mulberry32(1), 3);
    expect(new Set(names).size).toBe(3);
  });
});

describe('LocalRaceSession', () => {
  it('una carrera local tiene al jugador y 3 bots con nombres distintos', () => {
    const session = new LocalRaceSession({ seed: 1, level: 2, playerName: 'Santi' });
    const runners = session.snapshot().runners;
    expect(runners).toHaveLength(4);
    expect(runners[0]).toMatchObject({ id: PLAYER_ID, name: 'Santi', kind: 'human' });
    const bots = runners.filter((r) => r.kind === 'bot');
    expect(bots).toHaveLength(3);
    expect(new Set(bots.map((b) => b.name)).size).toBe(3);
    expect(Object.values(session.botProfiles()).sort()).toEqual(['crucero', 'tortuga', 'turbo']);
  });

  it('los bots no responden ni avanzan antes de racing', () => {
    const session = new LocalRaceSession({ seed: 2, level: 1 });
    session.start(0);
    session.advanceTo(COUNTDOWN - 10);
    for (const r of session.snapshot().runners) {
      expect(r.correct + r.wrong).toBe(0);
      expect(r.distance).toBe(0);
    }
  });

  it('un bot que falla recibe la misma penalización que un jugador', () => {
    const session = new LocalRaceSession({ seed: 11, level: 3, bots: ['tortuga'] });
    session.start(0);
    let before = session.snapshot().runners[0]!;
    for (let t = COUNTDOWN; t < COUNTDOWN + 180_000; t += 10) {
      session.advanceTo(t);
      const now = session.snapshot().runners[0]!;
      if (now.wrong > before.wrong) {
        const elapsed = now.lastAnswer!.atMs - (before.lastAnswer?.atMs ?? 0);
        expect(now.lastAnswer!.correct).toBe(false);
        expect(now.streak).toBe(0);
        // Velocidad tras el error ≈ mitad de la velocidad decaída justo antes.
        expect(now.speed).toBeLessThan(before.speed * 0.5 + 1e-9);
        expect(elapsed).toBeGreaterThan(0);
        return;
      }
      before = now;
    }
    throw new Error('El bot nunca falló');
  });

  it('las respuestas del jugador se aplican en orden con las de los bots', () => {
    const session = new LocalRaceSession({ seed: 4, level: 1, playerName: 'P' });
    session.start(0);
    session.advanceTo(COUNTDOWN);
    const prompt = session.snapshot().runners[0]!.challenge!;
    expect(prompt.prompt).toMatch(/^\d \+ \d$/);
    const [a, b] = prompt.prompt.split(' + ').map(Number) as [number, number];
    expect(session.submit(String(a + b), COUNTDOWN + 1500)?.correct).toBe(true);
    expect(session.race.nowMs).toBe(COUNTDOWN + 1500);
  });
});

describe('simulación de muchas carreras solo con bots', () => {
  const RACES_PER_LEVEL = 200;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('nivel %i: Turbo < Crucero < Tortuga y Crucero ~60–80 s', (level) => {
    const times: Record<string, number[]> = { turbo: [], crucero: [], tortuga: [] };
    for (let i = 0; i < RACES_PER_LEVEL; i++) {
      const session = new LocalRaceSession({ seed: i * 7919 + level, level });
      session.start(0);
      session.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
      const profiles = session.botProfiles();
      for (const r of session.snapshot().results!) {
        times[profiles[r.id]!]!.push(r.finishTimeMs ?? DEFAULT_RACE_CONFIG.timeLimitMs);
      }
    }
    const turbo = mean(times.turbo!);
    const crucero = mean(times.crucero!);
    const tortuga = mean(times.tortuga!);
    expect(turbo).toBeLessThan(crucero);
    expect(crucero).toBeLessThan(tortuga);
    expect(crucero).toBeGreaterThan(60_000);
    expect(crucero).toBeLessThan(80_000);
  });

  it('misma semilla sin jugador ⇒ misma clasificación y tiempos', () => {
    const run = (withIdlePlayer: boolean) => {
      const session = new LocalRaceSession({ seed: 99, level: 6, ...(withIdlePlayer ? { playerName: 'P' } : {}) });
      session.start(0);
      for (let t = 0; t <= COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs; t += 16) session.advanceTo(t);
      session.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
      return session.snapshot().results!.filter((r) => r.kind === 'bot');
    };
    expect(run(false)).toEqual(run(false));
    // Un jugador que no responde no cambia lo que hacen los bots.
    expect(run(true).map(({ position: _p, ...r }) => r)).toEqual(run(false).map(({ position: _p, ...r }) => r));
  });

  it('el resultado no depende del ritmo de cuadros con que se avanza', () => {
    const run = (frameMs: number) => {
      const session = new LocalRaceSession({ seed: 5, level: 4 });
      session.start(0);
      for (let t = 0; t <= COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs; t += frameMs) session.advanceTo(t);
      session.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
      return session.snapshot().results;
    };
    expect(run(16)).toEqual(run(33));
  });
});
