import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, within } from '@testing-library/react';
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

/** Captures what "Descargar CSV" saves: the file name and its text. */
function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  let blob: Blob | null = null;
  Object.assign(URL, {
    createObjectURL: (b: Blob) => {
      blob = b;
      return 'blob:csv';
    },
    revokeObjectURL: () => {},
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: blob! });
  });
  return { files, restore: () => click.mockRestore() };
}

describe('tablero de la profesora: clasificación', () => {
  const lucia: NetRunnerResult = {
    id: 'p2', name: 'Lucía', kind: 'human', position: 1, chosenLevel: 3, finished: true, finishTimeMs: 42_300,
    distance: 1000, correct: 18, wrong: 2, accuracy: 0.9, correctPerMinute: 25.5, maxLevel: 5, presence: 'connected',
  };
  const leo: NetRunnerResult = {
    id: 'p3', name: '=1+1', kind: 'human', position: 2, chosenLevel: 2, finished: false, finishTimeMs: null,
    distance: 500, correct: 0, wrong: 0, accuracy: 0, correctPerMinute: 0, maxLevel: 2, presence: 'left',
  };
  const startedAt = new Date(2026, 9, 17, 10, 30).getTime();

  it('muestra nivel máximo, avance, estado y "sin respuestas", y descarga con el número y la fecha de la carrera', async () => {
    const ctx = await teacherOpensClass();
    ctx.server({
      type: 'raceStart',
      seed: 9,
      distance: 1000,
      raceNumber: 2,
      startedAt,
      runners: [lucia, leo].map((r) => ({ id: r.id, name: r.name, kind: 'human' as const, chosenLevel: r.chosenLevel })),
    });
    ctx.server({ type: 'results', results: [lucia, leo] });
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Puesto', 'Nombre', 'Nivel', 'Nivel máximo', 'Tiempo', 'Avance', 'Estado', 'Aciertos', 'Errores', 'Precisión', 'Correctas por minuto',
    ]);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first!).getAllByRole('cell').map((c) => c.textContent)).toEqual(
      ['1', 'Lucía', '3', '5', '0:42,3', '100 %', 'Llegó', '18', '2', '90 %', '25,5'],
    );
    expect(within(second!).getAllByRole('cell').map((c) => c.textContent)).toEqual(
      ['2', '=1+1', '2', '2', '—', '50 %', 'Se fue', '0', '0', 'sin respuestas', '0,0'],
    );

    const downloads = captureDownloads();
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    downloads.restore();
    expect(downloads.files.map((f) => f.name)).toEqual(['mind-racer-K7QF-2026-10-17-2.csv']);
    const csv = await downloads.files[0]!.blob.text();
    expect(csv).toContain("2;'=1+1;2;2;—;50 %;Se fue;0;0;sin respuestas;0,0");
  });

  it('al recargar tras la segunda carrera, vuelve la clasificación y el CSV sigue siendo el n.º 2 (Recargar no reinicia la numeración, Recarga en la pantalla de resultados)', async () => {
    const raceStartOf = (raceNumber: number): ServerMessage => ({
      type: 'raceStart',
      seed: 10 + raceNumber,
      distance: 1000,
      raceNumber,
      startedAt,
      runners: [{ id: 'p2', name: 'Lucía', kind: 'human', chosenLevel: 3 }],
    });
    const downloadName = async () => {
      const downloads = captureDownloads();
      await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
      downloads.restore();
      return downloads.files[0]!.name;
    };

    const ctx = await teacherOpensClass();
    ctx.server(raceStartOf(1), { type: 'results', results: [lucia] });
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva carrera' }));
    ctx.server(raceStartOf(2), { type: 'results', results: [lucia] });
    expect(await downloadName()).toBe('mind-racer-K7QF-2026-10-17-2.csv');

    // The tab reloads: a fresh app rejoins and the server sends back the last race and its standings.
    cleanup();
    const reloaded = classSetup({ name: 'Profe Ana' });
    act(() => reloaded.net.socket.open());
    expect(reloaded.sent()).toEqual([{ type: 'rejoin', code: 'K7QF', token: 't' }]);
    reloaded.server(
      { type: 'joined', code: 'K7QF', playerId: 'p1', token: 't' },
      classRoomMessage([teacherPlayer(), student('p2', 'Lucía', 3, { status: 'results' })]),
      raceStartOf(2),
      { type: 'results', results: [lucia] },
    );
    expect(within(await screen.findByRole('table')).getByText('Lucía')).toBeInTheDocument();
    expect(await downloadName()).toBe('mind-racer-K7QF-2026-10-17-2.csv');
  });
});

describe('columnas del tablero', () => {
  it('reparte a la clase en columnas para que quepa en un proyector de 720 px', () => {
    expect([1, 12, 13, 26, 27, 40].map(boardColumns)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
