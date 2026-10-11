import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ServerMessage } from '@mind-racer/protocol';
import { App } from '../App';
import { NetClient, SESSION_KEY } from '../net/NetClient';
import { MultiplayerSession } from '../net/MultiplayerSession';
import { fakeNetwork } from '../net/fakeSocket';
import { createProfile } from '../progress/profile';
import { saveProfile } from '../progress/storage';
import { readRoomLink, roomLink } from './roomLink';

/** App opened at `address`, in StrictMode, with a fake server behind the multiplayer session. */
function openAt(address: string, profile: { name: string; unlockedLevel: number } | null) {
  window.history.replaceState(null, '', address);
  if (profile) saveProfile({ ...createProfile(profile.name, 'beginner'), unlockedLevel: profile.unlockedLevel });
  const net = fakeNetwork();
  render(
    <StrictMode>
      <App
        createMultiplayerSession={() =>
          new MultiplayerSession({
            client: new NetClient({
              url: 'ws://test:8787',
              createSocket: net.createSocket,
              storage: sessionStorage,
              setTimer: net.setTimer,
              clearTimer: net.clearTimer,
            }),
            raceOptions: { now: () => 0, autoLoop: false },
          })
        }
      />
    </StrictMode>,
  );
  const server = (...messages: ServerMessage[]) =>
    act(() => {
      for (const m of messages) net.socket.receive(m);
    });
  const sent = () => net.sockets.flatMap((s) => s.sent);
  return { net, server, sent };
}

const lobby = (code: string, name: string, level: number): ServerMessage[] => [
  { type: 'joined', code, playerId: 'p2', token: 't' },
  {
    type: 'room',
    code,
    phase: 'lobby',
    hostId: 'p1',
    players: [
      { id: 'p1', name: 'Papá', level: 8, connected: true, status: 'lobby' },
      { id: 'p2', name, level, connected: true, status: 'lobby' },
    ],
  },
];

afterEach(() => window.history.replaceState(null, '', '/'));

describe('enlace de la sala', () => {
  it('arma el enlace con la dirección del juego y lee el código normalizado', () => {
    expect(roomLink('K7QF', 'http://192.168.1.12:5173')).toBe('http://192.168.1.12:5173/?sala=K7QF');
    expect(readRoomLink('?sala=k7qf')).toBe('K7QF');
    expect(readRoomLink('?sala= k7 qf ')).toBe('K7QF');
    expect(readRoomLink('?sala=')).toBeNull();
    expect(readRoomLink('?otra=1')).toBeNull();
  });
});

describe('entrar con el enlace', () => {
  it('con perfil entra directo a la sala con un solo join, y la dirección queda limpia (Familiar con perfil)', () => {
    const ctx = openAt('/?sala=k7qf', { name: 'Lucía', unlockedLevel: 3 });
    expect(window.location.search).toBe('');
    act(() => ctx.net.socket.open());
    expect(ctx.sent()).toEqual([{ type: 'join', code: 'K7QF', name: 'Lucía', level: 3 }]);
    ctx.server(...lobby('K7QF', 'Lucía', 3));
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
  });

  it('sin perfil, primero el nombre y el punto de partida, y luego entra a la sala (Primera vez)', async () => {
    const ctx = openAt('/?sala=K7QF', null);
    expect(window.location.search).toBe('');
    expect(ctx.net.sockets).toHaveLength(0);
    await userEvent.type(screen.getByLabelText('Tu nombre de piloto'), 'Abuela Rosa');
    await userEvent.click(screen.getByText('Intermedio'));
    await userEvent.click(screen.getByRole('button', { name: /empezar a correr/i }));
    act(() => ctx.net.socket.open());
    expect(ctx.sent()).toEqual([{ type: 'join', code: 'K7QF', name: 'Abuela Rosa', level: 4 }]);
    ctx.server(...lobby('K7QF', 'Abuela Rosa', 4));
    expect(screen.getByTestId('room-code')).toHaveTextContent('K7QF');
  });

  it('una sala cerrada muestra el error de siempre en "Jugar con amigos" (Sala que ya no existe)', () => {
    const ctx = openAt('/?sala=ZZZZ', { name: 'Lucía', unlockedLevel: 2 });
    act(() => ctx.net.socket.open());
    ctx.server({ type: 'error', code: 'room-not-found', message: 'No encontramos esa sala' });
    expect(screen.getByRole('heading', { name: 'Jugar con amigos' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No encontramos esa sala');
    expect(screen.getByLabelText('Código de la sala')).toHaveValue('ZZZZ');
    expect(window.location.search).toBe('');
  });

  it('un código mal formado en el enlace se avisa como al escribirlo, sin conectar', () => {
    const ctx = openAt('/?sala=K7', { name: 'Lucía', unlockedLevel: 2 });
    expect(screen.getByRole('alert')).toHaveTextContent('4 letras o números');
    expect(ctx.net.sockets).toHaveLength(0);
  });

  it('el enlace a otra sala gana a la sesión guardada', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: 'AB2C', token: 'viejo' }));
    const other = openAt('/?sala=K7QF', { name: 'Lucía', unlockedLevel: 2 });
    act(() => other.net.socket.open());
    expect(other.sent()).toEqual([{ type: 'join', code: 'K7QF', name: 'Lucía', level: 2 }]);
  });

  it('el enlace a la sala en la que ya estaba vuelve a ella sin unirse de nuevo', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: 'K7QF', token: 'secreto' }));
    const same = openAt('/?sala=k7qf', { name: 'Lucía', unlockedLevel: 2 });
    act(() => same.net.socket.open());
    expect(same.sent()).toEqual([{ type: 'rejoin', code: 'K7QF', token: 'secreto' }]);
  });
});
