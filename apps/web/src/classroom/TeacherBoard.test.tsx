import { afterEach, describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NetRunnerResult, NetRunnerState, ServerMessage } from '@mind-racer/protocol';
import { boardColumns } from './TeacherBoard';
import { classRoomMessage, classSetup, student, teacherPlayer } from './testHarness';

afterEach(() => window.history.replaceState(null, '', '/'));

async function teacherOpensClass() {
  const ctx = classSetup({ name: 'Profe Ana' });
  await userEvent.click(screen.getByRole('button', { name: /jugar con amigos/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear sala de clase' }));
  act(() => ctx.net.socket.open());
  expect(ctx.sent()[0]).toMatchObject({ type: 'create', name: 'Profe Ana', mode: 'class' });
  ctx.server({ type: 'joined', code: 'K7QF', playerId: 'p1', token: 't' }, classRoomMessage([teacherPlayer()]));
  return ctx;
}

const N = 25;
const ids = Array.from({ length: N }, (_, i) => `p${i + 2}`);
/** Positions scrambled so the board has to sort them: p2 is 25th, p3 24th, … */
const positionOf = (id: string) => N - ids.indexOf(id);
const name = (id: string) => `Alumno ${id}`;

describe('tablero de la profesora: lobby', () => {
  it('muestra el código y el QR, y no deja iniciar sin alumnos (La profesora abre la sala, Sala sin alumnos)', async () => {
    await teacherOpensClass();
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
    expect(screen.getByRole('img', { name: 'Código QR del enlace de la sala' })).toBeInTheDocument();
    expect(screen.getByText(/Todavía no entra nadie/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar carrera' })).toBeDisabled();
  });

  it('lista a los alumnos, deja quitar a uno con confirmación e iniciar la carrera (Nombre inadecuado)', async () => {
    const ctx = await teacherOpensClass();
    ctx.server(classRoomMessage([teacherPlayer(), student('p2', 'Lucía', 2), student('p3', 'Nombre feo', 3)]));
    const list = within(screen.getByRole('region', { name: /Alumnos/ }));
    expect(list.getByText('2 de 40')).toBeInTheDocument();
    expect(list.getByText('Lucía')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Nombre feo' }));
    expect(ctx.sent().some((m) => m.type === 'kick')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'kick', playerId: 'p3' });

    const start = screen.getByRole('button', { name: 'Iniciar carrera' });
    expect(start).toBeEnabled();
    await userEvent.click(start);
    expect(ctx.sent().at(-1)).toEqual({ type: 'start' });
  });

  it('"Cerrar sala" pide confirmación, avisa al servidor y vuelve al menú', async () => {
    const ctx = await teacherOpensClass();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sala' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cerrar la sala' }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'closeRoom' });
    expect(screen.getByRole('heading', { name: /elige tu pista/i })).toBeInTheDocument();
  });
});

describe('tablero de la profesora: carrera y resultados', () => {
  const runnerState = (id: string): NetRunnerState => ({
    id,
    distance: 1000 - positionOf(id) * 30,
    speed: 0,
    streak: 0,
    nitroActive: false,
    position: positionOf(id),
    level: 2,
    maxLevel: 2,
    correct: 4,
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

  it('sigue a los 25 alumnos ordenados por posición y al final muestra la clasificación (Seguir la carrera)', async () => {
    const ctx = await teacherOpensClass();
    const raceStart: ServerMessage = {
      type: 'raceStart',
      seed: 7,
      distance: 1000,
      runners: ids.map((id) => ({ id, name: name(id), kind: 'human', chosenLevel: 2 })),
    };
    ctx.server(
      raceStart,
      classRoomMessage([teacherPlayer(), ...ids.map((id) => student(id, name(id), 2, { status: 'racing' }))], { phase: 'racing' }),
      { type: 'state', phase: 'racing', elapsedMs: 15_000, countdownRemainingMs: 0, runners: ids.map(runnerState) },
    );
    ctx.tick(16);
    const rows = within(screen.getByRole('list', { name: 'Avance de la clase' })).getAllByRole('listitem');
    expect(rows).toHaveLength(25);
    expect(rows[0]).toHaveAccessibleName(/^1\.º Alumno p26/);
    expect(rows[24]).toHaveAccessibleName(/^25\.º Alumno p2/);

    ctx.server({ type: 'results', results: ids.map(result) });
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(26);
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Nueva carrera' }));
    expect(screen.getByRole('button', { name: 'Iniciar carrera' })).toBeInTheDocument();
  });
});

describe('columnas del tablero', () => {
  it('reparte a la clase en columnas para que quepa en un proyector de 720 px', () => {
    expect([1, 12, 13, 26, 27, 40].map(boardColumns)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
