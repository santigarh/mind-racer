import { afterEach, describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES } from '@mind-racer/protocol';
import { startServer, type RunningServer } from './server';
import { TestClient } from './ws-client';

let server: RunningServer | null = null;
const clients: TestClient[] = [];

async function setup() {
  server = await startServer({ port: 0, host: '127.0.0.1' });
  const connect = async () => {
    const c = await TestClient.connect(server!.port);
    clients.push(c);
    return c;
  };
  return { connect };
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await server?.close();
  server = null;
});

describe('servidor WebSocket', () => {
  it('dos clientes reales crean y se unen a una sala', async () => {
    const { connect } = await setup();
    const host = await connect();
    host.send({ type: 'create', name: 'Papá', level: 8 });
    const { code } = await host.waitFor('joined');

    const guest = await connect();
    guest.send({ type: 'join', code: code.toLowerCase(), name: 'Lucía', level: 2 });
    await guest.waitFor('joined');
    const seenByHost = await host.waitFor('room', (m) => m.players.length === 2);
    expect(seenByHost.players.map((p) => p.name)).toEqual(['Papá', 'Lucía']);
    expect(seenByHost.hostId).toBe(host.last('joined')!.playerId);
  });

  it('un mensaje de más de 4 KB recibe error y la conexión sigue viva', async () => {
    const { connect } = await setup();
    const c = await connect();
    c.sendRaw(JSON.stringify({ type: 'leave', pad: 'x'.repeat(MAX_MESSAGE_BYTES) }));
    expect((await c.waitFor('error')).code).toBe('invalid-message');
    c.send({ type: 'create', name: 'Ana', level: 1 });
    await c.waitFor('joined');
  });

  it('los mensajes binarios se rechazan como inválidos', async () => {
    const { connect } = await setup();
    const c = await connect();
    (c as unknown as { socket: { send(d: Buffer): void } }).socket.send(Buffer.from([1, 2, 3]));
    expect((await c.waitFor('error')).code).toBe('invalid-message');
  });

  it('al cerrar el socket la persona aparece desconectada para los demás', async () => {
    const { connect } = await setup();
    const host = await connect();
    host.send({ type: 'create', name: 'Papá', level: 8 });
    const { code } = await host.waitFor('joined');
    const guest = await connect();
    guest.send({ type: 'join', code, name: 'Lucía', level: 2 });
    await host.waitFor('room', (m) => m.players.length === 2);
    guest.close();
    const room = await host.waitFor('room', (m) => m.players.some((p) => p.name === 'Lucía' && !p.connected));
    expect(room.players).toHaveLength(2);
  });
});
