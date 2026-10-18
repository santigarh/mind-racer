import { act, render } from '@testing-library/react';
import type { RoomPlayer, ServerMessage } from '@mind-racer/protocol';
import { App } from '../App';
import { NetClient } from '../net/NetClient';
import { MultiplayerSession } from '../net/MultiplayerSession';
import { fakeNetwork } from '../net/fakeSocket';
import { createProfile } from '../progress/profile';
import { saveProfile } from '../progress/storage';

/** App with a profile and a fake server behind the multiplayer session; optionally opened from a room link. */
export function classSetup({ name = 'Lucía', link }: { name?: string; link?: string } = {}) {
  if (link) window.history.replaceState(null, '', `/?sala=${link}`);
  saveProfile({ ...createProfile(name, 'intermediate'), unlockedLevel: 4 });
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
  return { net, server, sent, tick, sessions };
}

export const student = (id: string, name: string, level = 2, extra: Partial<RoomPlayer> = {}): RoomPlayer => ({
  id,
  name,
  level,
  connected: true,
  status: 'lobby',
  role: 'student',
  ...extra,
});

export const teacherPlayer = (extra: Partial<RoomPlayer> = {}): RoomPlayer => ({
  id: 'p1',
  name: 'Profe Ana',
  level: 5,
  connected: true,
  status: 'lobby',
  role: 'teacher',
  ...extra,
});

export const classRoomMessage = (players: RoomPlayer[], extra: Partial<Extract<ServerMessage, { type: 'room' }>> = {}) =>
  ({ type: 'room', code: 'K7QF', phase: 'lobby', mode: 'class', hostId: 'p1', players, ...extra }) as const;
