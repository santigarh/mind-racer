import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NetRunnerResult, RoomPlayer, ServerMessage } from '@mind-racer/protocol';
import { App } from '../App';
import { NetClient } from '../net/NetClient';
import { MultiplayerSession } from '../net/MultiplayerSession';
import { fakeNetwork } from '../net/fakeSocket';
import { createProfile } from '../progress/profile';
import { PROFILE_KEY, saveProfile } from '../progress/storage';

/** App with a saved profile and a fake server behind the multiplayer session. */
function setup(unlockedLevel = 2, name = 'Lucía') {
  saveProfile({ ...createProfile(name, 'beginner'), unlockedLevel });
  const net = fakeNetwork();
  let now = 0;
  const sessions: MultiplayerSession[] = [];
  render(
    <App
      createMultiplayerSession={() => {
        const session = new MultiplayerSession({
          client: new NetClient({
            url: 'ws://test:8787',
            createSocket: net.createSocket,
            storage: sessionStorage,
            setTimer: net.setTimer,
            clearTimer: net.clearTimer,
          }),
          raceOptions: { now: () => now, autoLoop: false },
        });
        sessions.push(session);
        return session;
      }}
    />,
  );
  /** Messages the server pushes to this client. */
  const server = (...messages: ServerMessage[]) =>
    act(() => {
      for (const m of messages) net.socket.receive(m);
    });
  const sent = () => net.sockets.flatMap((s) => s.sent);
  const tick = (ms: number) =>
    act(() => {
      now += ms;
      sessions.at(-1)!.getState().race?.tick();
    });
  return { net, server, sent, tick };
}

/** The garage car sent when nothing else is unlocked. */
const CLASSIC = { body: 'classic', paint: 'amber' };

const player = (id: string, name: string, level: number, extra: Partial<RoomPlayer> = {}): RoomPlayer => ({
  id,
  name,
  level,
  connected: true,
  status: 'lobby',
  ...extra,
});

const room = (players: RoomPlayer[], extra: Partial<Extract<ServerMessage, { type: 'room' }>> = {}) =>
  ({ type: 'room', code: 'K7QF', phase: 'lobby', hostId: 'p1', players, ...extra }) as const;

async function openMultiplayer() {
  await userEvent.click(screen.getByRole('button', { name: /jugar con amigos/i }));
}

/** Joins room K7QF as p2 (Lucía, level 2) with Papá (level 8) as host. */
async function inLobby(ctx: ReturnType<typeof setup>, status: RoomPlayer['status'] = 'lobby') {
  await openMultiplayer();
  await userEvent.type(screen.getByLabelText('Código de la sala'), 'k7qf');
  await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
  act(() => ctx.net.socket.open());
  ctx.server(
    { type: 'joined', code: 'K7QF', playerId: 'p2', token: 't' },
    room([player('p1', 'Papá', 8), player('p2', 'Lucía', 2, { status })]),
  );
}

const raceStart: ServerMessage = {
  type: 'raceStart',
  seed: 99,
  distance: 1000,
  runners: [
    { id: 'p1', name: 'Papá', kind: 'human', chosenLevel: 8 },
    { id: 'p2', name: 'Lucía', kind: 'human', chosenLevel: 2 },
    { id: 'bot-tortuga-0', name: 'Ada', kind: 'bot', chosenLevel: 2, botProfile: 'tortuga' },
    { id: 'bot-crucero-1', name: 'Gauss', kind: 'bot', chosenLevel: 2, botProfile: 'crucero' },
  ],
};

async function inRace(ctx: ReturnType<typeof setup>) {
  await inLobby(ctx);
  ctx.server(raceStart, room([player('p1', 'Papá', 8, { status: 'racing' }), player('p2', 'Lucía', 2, { status: 'racing' })], { phase: 'racing' }));
}

describe('Jugar con amigos: crear y unirse', () => {
  it('el menú abre "Jugar con amigos" y "Crear sala" usa el nombre y el nivel máximo del perfil', async () => {
    const ctx = setup(3);
    await openMultiplayer();
    expect(screen.getByRole('heading', { name: 'Jugar con amigos' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /crear sala/i })[0]!);
    act(() => ctx.net.socket.open());
    expect(ctx.sent()).toEqual([{ type: 'create', name: 'Lucía', level: 3, car: CLASSIC }]);
  });

  it('unirse normaliza el código a mayúsculas', async () => {
    const ctx = setup();
    await inLobby(ctx);
    expect(ctx.sent()[0]).toEqual({ type: 'join', code: 'K7QF', name: 'Lucía', level: 2, car: CLASSIC });
  });

  it('un código mal escrito se avisa sin enviar nada', async () => {
    const ctx = setup();
    await openMultiplayer();
    await userEvent.type(screen.getByLabelText('Código de la sala'), 'K7');
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    expect(screen.getByRole('alert')).toHaveTextContent('K7QF');
    expect(ctx.net.sockets).toHaveLength(0);
  });

  it.each([
    ['room-not-found', 'No encontramos esa sala'],
    ['room-full', 'La sala está llena'],
  ] as const)('error del servidor %s: "%s" y sigue en la pantalla para unirse', async (code, message) => {
    const ctx = setup();
    await openMultiplayer();
    await userEvent.type(screen.getByLabelText('Código de la sala'), 'ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    act(() => ctx.net.socket.open());
    ctx.server({ type: 'error', code, message });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Código de la sala')).toBeInTheDocument();
  });
});

describe('Lobby', () => {
  it('muestra el código, los jugadores con su nivel y quién es anfitrión', async () => {
    const ctx = setup();
    await inLobby(ctx);
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
    expect(screen.getByRole('listitem', { name: 'Papá, nivel 8, anfitrión' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Lucía, nivel 2' })).toHaveTextContent('Tú');
  });

  it('nivel propio: solo los desbloqueados, y elegir uno se envía al servidor', async () => {
    const ctx = setup(3);
    await inLobby(ctx);
    const levels = within(screen.getByRole('group', { name: 'Tu nivel' }));
    expect(levels.getByRole('button', { name: /^Nivel 3:/ })).toBeEnabled();
    expect(levels.getByRole('button', { name: /^Nivel 5:.*bloqueado/ })).toBeDisabled();
    await userEvent.click(levels.getByRole('button', { name: /^Nivel 3:/ }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'setLevel', level: 3 });
    // Otro jugador cambia de nivel: se ve al llegar el mensaje del servidor.
    ctx.server(room([player('p1', 'Papá', 6), player('p2', 'Lucía', 3)]));
    expect(screen.getByRole('listitem', { name: 'Papá, nivel 6, anfitrión' })).toBeInTheDocument();
  });

  it('un invitado espera al anfitrión; el anfitrión ve "Iniciar carrera"', async () => {
    const ctx = setup();
    await inLobby(ctx);
    expect(screen.getByText('Esperando a que el anfitrión inicie.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar carrera' })).not.toBeInTheDocument();
    ctx.server(room([player('p2', 'Lucía', 2)], { hostId: 'p2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar carrera' }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'start' });
  });

  it('llegada tardía: avisa que entrará en la siguiente carrera', async () => {
    const ctx = setup();
    await inLobby(ctx, 'waiting');
    ctx.server(room([player('p1', 'Papá', 8, { status: 'racing' }), player('p2', 'Lucía', 2, { status: 'waiting' })], { phase: 'racing' }));
    expect(screen.getByText('Hay una carrera en curso; entrarás en la siguiente.')).toBeInTheDocument();
  });

  it('salir de la sala vuelve al menú y avisa al servidor', async () => {
    const ctx = setup();
    await inLobby(ctx);
    await userEvent.click(screen.getByRole('button', { name: /salir de la sala/i }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'leave' });
    expect(screen.getByRole('heading', { name: /elige tu pista/i })).toBeInTheDocument();
  });
});

describe('Carrera multijugador', () => {
  it('familia en la pista: cada carril muestra el nivel elegido', async () => {
    const ctx = setup();
    await inRace(ctx);
    expect(screen.getByRole('listitem', { name: /^Papá, nivel 8,/ })).toHaveTextContent('N8');
    expect(screen.getByRole('listitem', { name: /^Lucía, nivel 2,/ })).toHaveTextContent('N2');
  });

  it('responde desafíos a través del servidor', async () => {
    const ctx = setup();
    await inRace(ctx);
    ctx.server({ type: 'state', phase: 'racing', elapsedMs: 900, countdownRemainingMs: 0, runners: [] });
    ctx.server({ type: 'challenge', challenge: { seq: 1, level: 2, prompt: '3 + 4', answerLength: 1, issuedAtMs: 0 } });
    await userEvent.type(screen.getByLabelText('Tu respuesta'), '7');
    expect(ctx.sent().at(-1)).toEqual({ type: 'answer', seq: 1, input: '7' });
  });

  it('indicador de conexión: "Reconectando…" cuando se cae el wifi', async () => {
    const ctx = setup();
    await inRace(ctx);
    act(() => ctx.net.socket.drop());
    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
    act(() => {
      ctx.net.runTimer();
      ctx.net.socket.open();
    });
    expect(ctx.net.socket.sent[0]).toEqual({ type: 'rejoin', code: 'K7QF', token: 't' });
    expect(screen.queryByText('Reconectando…')).not.toBeInTheDocument();
  });

  it('corredor desconectado se marca en la pista', async () => {
    const ctx = setup();
    await inRace(ctx);
    ctx.server({
      type: 'state',
      phase: 'racing',
      elapsedMs: 5000,
      countdownRemainingMs: 0,
      runners: [
        { id: 'p1', distance: 100, speed: 10, streak: 0, nitroActive: false, position: 1, level: 8, maxLevel: 8, correct: 3, wrong: 0, finishTimeMs: null, presence: 'disconnected' },
      ],
    });
    expect(screen.getByRole('listitem', { name: /^Papá, .*desconectado$/ })).toHaveTextContent('Desconectado');
  });

  it('abandonar vuelve a la sala con el servidor', async () => {
    const ctx = setup();
    await inRace(ctx);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Tu auto quedará detenido');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a la sala' }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'abandon' });
    ctx.server(room([player('p1', 'Papá', 8, { status: 'racing' }), player('p2', 'Lucía', 2, { status: 'waiting' })], { phase: 'racing' }));
    expect(screen.getByText('Hay una carrera en curso; entrarás en la siguiente.')).toBeInTheDocument();
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY)!);
    expect(profile.stats).toEqual({});
  });

  it('desbloqueo en familia: 2.ª en nivel 2 con 90 % desbloquea el 3 y se puede volver a la sala', async () => {
    const ctx = setup(2);
    await inRace(ctx);
    const result = (r: Partial<NetRunnerResult> & Pick<NetRunnerResult, 'id' | 'name' | 'position' | 'chosenLevel'>): NetRunnerResult => ({
      kind: 'human', finished: true, finishTimeMs: 60_000, distance: 1000, correct: 18, wrong: 2, accuracy: 0.9,
      correctPerMinute: 18, maxLevel: r.chosenLevel, presence: 'connected', ...r,
    });
    ctx.server(
      {
        type: 'results',
        results: [
          result({ id: 'p1', name: 'Papá', position: 1, chosenLevel: 8 }),
          result({ id: 'p2', name: 'Lucía', position: 2, chosenLevel: 2, finishTimeMs: 64_200 }),
          result({ id: 'bot-tortuga-0', name: 'Ada', kind: 'bot', position: 3, chosenLevel: 2, finishTimeMs: 90_000 }),
          result({ id: 'bot-crucero-1', name: 'Gauss', kind: 'bot', position: 4, chosenLevel: 2, finished: false, finishTimeMs: null, presence: 'connected' }),
        ],
      },
      room([player('p1', 'Papá', 8, { status: 'results' }), player('p2', 'Lucía', 2, { status: 'results' })]),
    );
    ctx.tick(16);
    expect(await screen.findByRole('heading', { name: 'Terminaste 2.º' })).toBeInTheDocument();
    expect(screen.getByText('Desbloqueaste el nivel 3')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('N8')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!).unlockedLevel).toBe(3);

    await userEvent.click(screen.getByRole('button', { name: 'Volver a la sala' }));
    expect(ctx.sent().at(-1)).toEqual({ type: 'backToRoom' });
    ctx.server(room([player('p1', 'Papá', 8, { status: 'results' }), player('p2', 'Lucía', 2, { status: 'lobby' })]));
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
  });

  it('al recargar la pestaña dentro de una sala, vuelve a ella', () => {
    sessionStorage.setItem('mind-racer:session', JSON.stringify({ code: 'K7QF', token: 't' }));
    const ctx = setup();
    act(() => ctx.net.socket.open());
    expect(ctx.sent()).toEqual([{ type: 'rejoin', code: 'K7QF', token: 't' }]);
  });
});

describe('servidor despertando', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function pressCreate() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const ctx = setup(2);
    fireEvent.click(screen.getByRole('button', { name: /jugar con amigos/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /crear sala/i })[0]!);
    return ctx;
  }

  it('servidor dormido: "Conectando…", a los 5 s "Despertando…", y entra al lobby sin volver a pulsar', async () => {
    const ctx = await pressCreate();
    expect(screen.getByText('Conectando con el servidor…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.queryByText(/Despertando el servidor/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('Despertando el servidor, puede tardar hasta un minuto')).toBeInTheDocument();

    // El servidor despierta a los 40 s: la creación en cola se envía sola.
    act(() => {
      vi.advanceTimersByTime(35_000);
      ctx.net.socket.open();
    });
    expect(ctx.sent()).toEqual([{ type: 'create', name: 'Lucía', level: 2, car: CLASSIC }]);
    ctx.server({ type: 'joined', code: 'K7QF', playerId: 'p1', token: 't' }, room([player('p1', 'Lucía', 2)], { hostId: 'p1' }));
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
    expect(screen.queryByText(/Despertando el servidor/)).not.toBeInTheDocument();
  });

  it('servidor despierto: responde antes de 5 s y no aparece el aviso', async () => {
    const ctx = await pressCreate();
    act(() => {
      vi.advanceTimersByTime(800);
      ctx.net.socket.open();
    });
    ctx.server({ type: 'joined', code: 'K7QF', playerId: 'p1', token: 't' }, room([player('p1', 'Lucía', 2)], { hostId: 'p1' }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText(/Despertando el servidor/)).not.toBeInTheDocument();
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
  });

  it('el aviso aparece también si la conexión se cae y reintenta antes de unirse', async () => {
    const ctx = await pressCreate();
    act(() => {
      ctx.net.socket.drop();
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('Despertando el servidor, puede tardar hasta un minuto')).toBeInTheDocument();
  });
});

describe('Carrera de tablas en clase', () => {
  it('el alumno gana sin que cuente para su progreso y ve el aviso (Carrera de tablas en clase)', async () => {
    const ctx = setup(2);
    await inLobby(ctx);
    const tables = { tables: [7], divisions: false };
    const students = (status: RoomPlayer['status']) =>
      room([player('p1', 'Profe', 5, { role: 'teacher' }), player('p2', 'Lucía', 2, { status }), player('p3', 'Leo', 3, { status })], {
        mode: 'class',
        tables,
      });
    ctx.server(
      {
        type: 'raceStart',
        seed: 77,
        distance: 1000,
        tables,
        runners: [
          { id: 'p2', name: 'Lucía', kind: 'human', chosenLevel: 4 },
          { id: 'p3', name: 'Leo', kind: 'human', chosenLevel: 4 },
        ],
      },
      { ...students('racing'), phase: 'racing' },
    );
    expect(screen.getByRole('heading', { name: 'Tabla del 7' })).toBeInTheDocument();
    expect(screen.queryByText('N4')).not.toBeInTheDocument();

    const result = (id: string, name: string, position: number): NetRunnerResult => ({
      id, name, kind: 'human', position, chosenLevel: 4, finished: true, finishTimeMs: 50_000 + position, distance: 1000,
      correct: 20, wrong: 1, accuracy: 0.95, correctPerMinute: 24, maxLevel: 4, presence: 'connected',
    });
    ctx.server({ type: 'results', results: [result('p2', 'Lucía', 1), result('p3', 'Leo', 2)] }, students('results'));
    ctx.tick(16);
    expect(await screen.findByRole('heading', { name: 'Ganaste la carrera' })).toBeInTheDocument();
    expect(screen.getByText('Práctica de tablas: no cuenta para el progreso')).toBeInTheDocument();
    expect(screen.queryByText(/Desbloqueaste/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('N4')).not.toBeInTheDocument();
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY)!);
    expect(profile.unlockedLevel).toBe(2);
    expect(profile.stats).toEqual({});
  });
});
