import { describe, expect, it } from 'vitest';
import { MultiplayerSession, type DeviceNetwork } from './MultiplayerSession';
import { NetClient } from './NetClient';
import { fakeNetwork } from './fakeSocket';

function fakeDevice(online: boolean) {
  const listeners = new Set<() => void>();
  const device: DeviceNetwork & { set(online: boolean): void; listeners: Set<() => void> } = {
    listeners,
    isOnline: () => online,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      online = next;
      listeners.forEach((listener) => listener());
    },
  };
  return device;
}

function setup(online: boolean) {
  const net = fakeNetwork();
  const device = fakeDevice(online);
  const clock = { now: 0 };
  const session = new MultiplayerSession({
    now: () => clock.now,
    client: new NetClient({ url: 'ws://x', createSocket: net.createSocket, storage: null, setTimer: net.setTimer, clearTimer: net.clearTimer }),
    network: device,
  });
  return { net, device, session, clock };
}

describe('MultiplayerSession sin internet', () => {
  it('sabe si el dispositivo arranca sin conexión', () => {
    expect(setup(false).session.getState().deviceOffline).toBe(true);
    expect(setup(true).session.getState().deviceOffline).toBe(false);
  });

  it('sigue los cambios de conexión del dispositivo', () => {
    const { device, session } = setup(true);
    device.set(false);
    expect(session.getState().deviceOffline).toBe(true);
    device.set(true);
    expect(session.getState().deviceOffline).toBe(false);
  });

  it('al volver internet reintenta enseguida y completa la acción pendiente (Vuelve la conexión)', () => {
    const { net, device, session } = setup(false);
    session.join('K7QF', 'Ana', 2);
    // Sin internet cada intento falla y espera el siguiente.
    for (let i = 0; i < 5; i++) {
      net.socket.drop();
      net.runTimer();
    }
    net.socket.drop();
    const attempts = net.sockets.length;

    device.set(true);
    expect(net.sockets).toHaveLength(attempts + 1);
    net.socket.open();
    expect(net.socket.sent).toContainEqual(expect.objectContaining({ type: 'join', code: 'K7QF', name: 'Ana', level: 2 }));
  });

  it('al volver internet, el servidor tiene otros 5 s antes del aviso de servidor despertando', () => {
    const { net, device, session, clock } = setup(false);
    session.create('Ana', 2);
    expect(session.getState().offlineSince).toBe(0);
    net.socket.drop();
    clock.now = 30_000;
    device.set(true);
    expect(session.getState().offlineSince).toBe(30_000);
  });

  it('deja de escuchar al dispositivo al cerrarse', () => {
    const { device, session } = setup(true);
    expect(device.listeners.size).toBe(1);
    session.dispose();
    expect(device.listeners.size).toBe(0);
  });
});
