import { describe, expect, it } from 'vitest';
import { DEFAULT_RACE_CONFIG } from './config';
import { hashSeed } from './rng';
import { LocalRaceSession, PLAYER_ID, RaceSession } from './session';

const COUNTDOWN = DEFAULT_RACE_CONFIG.countdownMs;

function familySession(seed = 3) {
  return new RaceSession({
    seed,
    level: 2,
    humans: [
      { id: 'papa', name: 'Papá', level: 8 },
      { id: 'hija', name: 'Lucía', level: 2 },
    ],
    bots: [
      { profile: 'tortuga', level: 2 },
      { profile: 'crucero', level: 2 },
    ],
  });
}

/** Answers correctly for one person every `everyMs` until they finish or `untilMs`. */
function drive(session: RaceSession, id: string, everyMs: number, untilMs: number) {
  for (let t = COUNTDOWN + everyMs; t <= untilMs; t += everyMs) {
    session.advanceTo(t);
    const challenge = session.race.peekChallenge(id);
    if (!challenge) continue;
    session.submit(id, challenge.answer, t);
  }
}

describe('RaceSession con varias personas y bots', () => {
  it('arma 4 corredores con sus niveles', () => {
    const session = familySession();
    const runners = session.snapshot().runners;
    expect(runners.map((r) => [r.kind, r.chosenLevel])).toEqual([
      ['human', 8],
      ['human', 2],
      ['bot', 2],
      ['bot', 2],
    ]);
    expect(session.humanIds).toEqual(['papa', 'hija']);
    expect(Object.values(session.botProfiles())).toEqual(['tortuga', 'crucero']);
  });

  it('cada persona responde por su id; los bots no aceptan respuestas externas', () => {
    const session = familySession();
    session.start(0);
    session.advanceTo(COUNTDOWN + 1000);
    const papa = session.race.peekChallenge('papa')!;
    expect(papa.level).toBe(8);
    expect(session.submit('papa', papa.answer, COUNTDOWN + 1000)?.correct).toBe(true);
    const botId = Object.keys(session.botProfiles())[0]!;
    expect(session.submit(botId, '1', COUNTDOWN + 1100)).toBeNull();
    expect(session.submit('desconocido', '1', COUNTDOWN + 1100)).toBeNull();
  });

  it('pasa el responseMs informado al motor', () => {
    const answerAfter = (responseMs?: number) => {
      const session = familySession();
      session.start(0);
      session.advanceTo(COUNTDOWN + 4000);
      const c = session.race.peekChallenge('hija')!;
      session.submit('hija', c.answer, COUNTDOWN + 4000, responseMs);
      return session.snapshot().runners.find((r) => r.id === 'hija')!.speed;
    };
    expect(answerAfter(1000)).toBeGreaterThan(answerAfter());
  });

  it('finishNow da la misma clasificación que esperar cuando las personas ya terminaron', () => {
    const run = (skip: boolean) => {
      const session = familySession(17);
      session.start(0);
      for (let t = COUNTDOWN; t < COUNTDOWN + 180_000; t += 250) {
        for (const id of ['papa', 'hija']) {
          session.advanceTo(t);
          const c = session.race.peekChallenge(id);
          if (c) session.submit(id, c.answer, t);
        }
        const humansDone = session
          .snapshot()
          .runners.filter((r) => r.kind === 'human')
          .every((r) => r.finishTimeMs !== null);
        if (humansDone) break;
      }
      if (skip) return session.finishNow().results;
      session.advanceTo(COUNTDOWN + 180_000);
      return session.snapshot().results;
    };
    const waited = run(false);
    expect(waited).not.toBeNull();
    expect(run(true)).toEqual(waited);
  });

  it('finishNow con una persona sin terminar la deja donde quedó', () => {
    const session = familySession();
    session.start(0);
    drive(session, 'papa', 300, COUNTDOWN + 6000);
    const results = session.finishNow().results!;
    const hija = results.find((r) => r.id === 'hija')!;
    expect(session.race.phase).toBe('finished');
    expect(hija.finished).toBe(false);
    expect(hija.distance).toBe(0);
  });
});

describe('desafío diario: misma carrera para todos', () => {
  const daily = () =>
    new LocalRaceSession({
      seed: hashSeed('daily', '2026-10-11', 3),
      level: 3,
      playerName: 'Ana',
      config: { adaptiveDifficulty: false },
    });

  /** Plays to the end; `answer` decides what to type for each challenge. Returns prompts seen and bot times. */
  function play(answer: (expected: string, i: number) => string) {
    const session = daily();
    session.start(0);
    const prompts: string[] = [];
    for (let t = COUNTDOWN + 700, i = 0; t <= COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs; t += 700, i++) {
      session.advanceTo(t);
      if (session.snapshot().phase === 'finished') break;
      const challenge = session.race.peekChallenge(PLAYER_ID);
      if (!challenge) continue;
      prompts.push(challenge.prompt);
      session.submit(answer(challenge.answer, i), t);
    }
    session.advanceTo(COUNTDOWN + DEFAULT_RACE_CONFIG.timeLimitMs);
    const bots = session
      .snapshot()
      .results!.filter((r) => r.kind === 'bot')
      .map((r) => [r.id, r.finishTimeMs]);
    return { prompts, bots };
  }

  it('jugadores que responden distinto reciben los mismos desafíos y los mismos bots', () => {
    const perfect = play((expected) => expected);
    const shaky = play((expected, i) => (i % 3 === 1 ? `${expected}9` : expected));
    const n = Math.min(perfect.prompts.length, shaky.prompts.length);
    expect(n).toBeGreaterThan(15);
    expect(shaky.prompts.slice(0, n)).toEqual(perfect.prompts.slice(0, n));
    expect(shaky.bots).toEqual(perfect.bots);
    expect(perfect.bots.some(([, time]) => time !== null)).toBe(true);
  });

  it('otro día u otro nivel dan otra carrera', () => {
    const first = (seed: number, level: number) => {
      const s = new LocalRaceSession({ seed, level, playerName: 'Ana', config: { adaptiveDifficulty: false } });
      s.start(0);
      s.advanceTo(COUNTDOWN);
      return s.race.peekChallenge(PLAYER_ID)!.prompt + s.snapshot().runners.map((r) => r.name).join();
    };
    const today = first(hashSeed('daily', '2026-10-11', 3), 3);
    expect(first(hashSeed('daily', '2026-10-12', 3), 3)).not.toBe(today);
    expect(first(hashSeed('daily', '2026-10-11', 4), 4)).not.toBe(today);
  });
});
