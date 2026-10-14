import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ServerMessage } from '@mind-racer/protocol';
import { App } from '../App';
import { saveDaily, EMPTY_DAILY } from '../daily/daily';
import { LocalRaceController } from '../game/LocalRaceController';
import { NetClient } from '../net/NetClient';
import { MultiplayerSession } from '../net/MultiplayerSession';
import { fakeNetwork } from '../net/fakeSocket';
import { createProfile, type LevelStats } from '../progress/profile';
import { saveProfile } from '../progress/storage';
import { garageStore } from './choice';

const stats = (races: number, wins: number): LevelStats => ({
  races,
  wins,
  bestTimeMs: 60_000,
  bestCorrectPerMinute: 10,
  bestAccuracy: 0.9,
});

const carIn = (testId: string) => screen.getByTestId(testId).querySelector('svg')!;
const laneColorOf = (testId: string) => screen.getByTestId(testId).closest('li')!.style.getPropertyValue('--lane-color');

describe('tu auto en la pista', () => {
  it('en una carrera local corres con tu vehículo y tu pintura; los bots no cambian (Carrera local)', () => {
    saveProfile({ ...createProfile('Lucía', 'intermediate'), unlockedLevel: 4 });
    saveDaily({ ...EMPTY_DAILY, streak: 1, bestStreak: 1, lastDate: '2026-10-12' });
    garageStore.set({ body: 'truck', paint: 'green' });
    render(
      <App
        createController={(options) => new LocalRaceController({ ...options, now: () => 0, autoLoop: false })}
        makeSeed={() => 7}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Correr en nivel 4/ }));
    expect(carIn('car-player')).toHaveAttribute('data-body', 'truck');
    expect(laneColorOf('car-player')).toBe('var(--paint-green)');
    const bot = screen.getAllByTestId(/^car-bot/)[0]!;
    expect(bot.querySelector('svg')).not.toHaveAttribute('data-body');
    expect(bot.closest('li')!.style.getPropertyValue('--lane-color')).toMatch(/^var\(--lane-/);
  });

  it('lo que no está desbloqueado no corre: un jugador nuevo corre con el clásico ámbar', () => {
    saveProfile(createProfile('Leo', 'beginner'));
    garageStore.set({ body: 'tractor', paint: 'gold' });
    render(<App createController={(o) => new LocalRaceController({ ...o, now: () => 0, autoLoop: false })} />);
    fireEvent.click(screen.getByRole('button', { name: /Correr en nivel 1/ }));
    expect(carIn('car-player')).toHaveAttribute('data-body', 'classic');
    expect(laneColorOf('car-player')).toBe('var(--paint-amber)');
  });
});

describe('autos de la familia en la sala', () => {
  function openRoomLink() {
    window.history.replaceState(null, '', '/?sala=K7QF');
    saveProfile({ ...createProfile('Lucía', 'beginner'), stats: { '1': stats(3, 1) } });
    garageStore.set({ body: 'motorcycle', paint: 'red' });
    const net = fakeNetwork();
    render(
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
      />,
    );
    act(() => net.socket.open());
    const server = (...messages: ServerMessage[]) =>
      act(() => {
        for (const m of messages) net.socket.receive(m);
      });
    return { net, server };
  }

  const papaCar = { body: 'truck', paint: 'blue' } as const;
  const luciaCar = { body: 'motorcycle', paint: 'red' } as const;
  const players = (status: 'lobby' | 'racing') => [
    { id: 'p1', name: 'Papá', level: 8, connected: true, status, car: papaCar },
    { id: 'p2', name: 'Lucía', level: 1, connected: true, status, car: luciaCar },
  ];

  it('al unirse envía tu auto, y el lobby y la pista muestran el de cada persona (La familia ve los autos)', () => {
    const { net, server } = openRoomLink();
    expect(net.sockets.flatMap((s) => s.sent)).toEqual([
      { type: 'join', code: 'K7QF', name: 'Lucía', level: 1, car: luciaCar },
    ]);

    server(
      { type: 'joined', code: 'K7QF', playerId: 'p2', token: 't' },
      { type: 'room', code: 'K7QF', phase: 'lobby', hostId: 'p1', players: players('lobby') },
    );
    const lobbyCar = (name: string) =>
      within(screen.getByRole('listitem', { name: new RegExp(name) })).getByText(name).parentElement!.querySelector('svg');
    expect(lobbyCar('Papá')).toHaveAttribute('data-body', 'truck');
    expect(lobbyCar('Lucía')).toHaveAttribute('data-body', 'motorcycle');

    server(
      {
        type: 'raceStart',
        seed: 99,
        distance: 1000,
        runners: [
          { id: 'p1', name: 'Papá', kind: 'human', chosenLevel: 8, car: papaCar },
          { id: 'p2', name: 'Lucía', kind: 'human', chosenLevel: 1, car: luciaCar },
          { id: 'bot-tortuga-0', name: 'Ada', kind: 'bot', chosenLevel: 1, botProfile: 'tortuga' },
        ],
      },
      { type: 'room', code: 'K7QF', phase: 'racing', hostId: 'p1', players: players('racing') },
    );
    expect(carIn('car-p1')).toHaveAttribute('data-body', 'truck');
    expect(laneColorOf('car-p1')).toBe('var(--paint-blue)');
    expect(carIn('car-p2')).toHaveAttribute('data-body', 'motorcycle');
    expect(laneColorOf('car-p2')).toBe('var(--paint-red)');
    expect(laneColorOf('car-bot-tortuga-0')).toBe('var(--lane-tortuga)');
    window.history.replaceState(null, '', '/');
  });
});
