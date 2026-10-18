import { afterEach, describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import type { NetRunnerResult, NetRunnerState, ServerMessage } from '@mind-racer/protocol';
import { media } from '../test/setup';
import { classRoomMessage, classSetup, student, teacherPlayer } from './testHarness';

afterEach(() => window.history.replaceState(null, '', '/'));

const N = 28;
const ids = Array.from({ length: N }, (_, i) => `p${i + 2}`);
const ME = 'p13';
const name = (id: string) => (id === ME ? 'Lucía' : `Alumno ${id}`);
/** Position of each student: p2 first, p3 second… so Lucía (p13) is 12th. */
const positionOf = (id: string) => ids.indexOf(id) + 1;

const runnerState = (id: string): NetRunnerState => ({
  id,
  distance: 1000 - positionOf(id) * 10,
  speed: 10,
  streak: 0,
  nitroActive: false,
  position: positionOf(id),
  level: 2,
  maxLevel: 2,
  correct: 3,
  wrong: 0,
  finishTimeMs: null,
  presence: 'connected',
});

const result = (id: string): NetRunnerResult => ({
  id,
  name: name(id),
  kind: 'human',
  position: positionOf(id),
  chosenLevel: 2,
  finished: true,
  finishTimeMs: 40_000 + positionOf(id) * 1000,
  distance: 1000,
  correct: 20,
  wrong: 1,
  accuracy: 0.95,
  correctPerMinute: 30,
  maxLevel: 2,
  presence: 'connected',
});

/** Lucía (12th of 28) in a class race, after the server sent her and the 5 leaders. */
function inClassRace() {
  const ctx = classSetup({ link: 'K7QF' });
  act(() => ctx.net.socket.open());
  const players = [teacherPlayer(), ...ids.map((id) => student(id, name(id), 2, { status: 'racing' }))];
  const raceStart: ServerMessage = {
    type: 'raceStart',
    seed: 5,
    distance: 1000,
    runners: ids.map((id) => ({ id, name: name(id), kind: 'human', chosenLevel: 2 })),
  };
  ctx.server(
    { type: 'joined', code: 'K7QF', playerId: ME, token: 't' },
    raceStart,
    classRoomMessage(players, { phase: 'racing' }),
    {
      type: 'state',
      phase: 'racing',
      elapsedMs: 20_000,
      countdownRemainingMs: 0,
      runners: [...ids.slice(0, 5), ME].map(runnerState),
    },
  );
  ctx.tick(16);
  return ctx;
}

const laneNames = () =>
  within(screen.getByRole('list', { name: 'Pista' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('aria-label')!.split(',')[0]);

describe('vista del alumno en una carrera de clase', () => {
  it('en el celular ve su carril y los 3 primeros, su posición entre todos, y los 10 primeros al final (Alumno a mitad de tabla)', async () => {
    media.narrow = true;
    const ctx = inClassRace();
    expect(laneNames()).toEqual(['Alumno p2', 'Alumno p3', 'Alumno p4', 'Lucía']);
    expect(screen.getByText('de 28').parentElement).toHaveTextContent('12.º');

    ctx.server({ type: 'results', results: ids.map(result) });
    ctx.tick(16);
    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(11);
    expect(rows.at(-1)).toHaveTextContent('Lucía');
  });

  it('en una pantalla más ancha ve a los 5 primeros (Tableta o computadora)', () => {
    inClassRace();
    expect(laneNames()).toEqual(['Alumno p2', 'Alumno p3', 'Alumno p4', 'Alumno p5', 'Alumno p6', 'Lucía']);
  });
});
