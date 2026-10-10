import { describe, expect, it } from 'vitest';
import { DEFAULT_RACE_CONFIG } from './config';
import { RaceSession } from './session';

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
