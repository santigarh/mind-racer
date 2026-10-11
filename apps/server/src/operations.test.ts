import { afterEach, describe, expect, it } from 'vitest';
import { RoomManager } from './RoomManager';
import { startServer, type RunningServer } from './server';
import { FakeConn } from './test-helpers';
import { TestClient } from './ws-client';

let server: RunningServer | null = null;
const clients: TestClient[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await server?.close();
  server = null;
});

async function start(options: Parameters<typeof startServer>[0] = {}) {
  server = await startServer({ port: 0, host: '127.0.0.1', ...options });
  return `http://127.0.0.1:${server.port}`;
}

describe('chequeo de salud', () => {
  it('plataforma comprueba el servicio: 200 con estado y salas abiertas', async () => {
    const base = await start();
    const empty = await fetch(`${base}/health`);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ status: 'ok', rooms: 0 });

    const c = await TestClient.connect(server!.port);
    clients.push(c);
    c.send({ type: 'create', name: 'Ana', level: 2 });
    await c.waitFor('joined');
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: 'ok', rooms: 1 });
  });

  it('ruta desconocida: 404 y el servidor sigue funcionando', async () => {
    const base = await start();
    expect((await fetch(`${base}/otra`)).status).toBe(404);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it('HTTP y WebSocket comparten el puerto asignado', async () => {
    const base = await start();
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const c = await TestClient.connect(server!.port);
    clients.push(c);
    c.send({ type: 'create', name: 'Ana', level: 2 });
    expect((await c.waitFor('joined')).code).toMatch(/^[A-Z2-9]{4}$/);
  });
});

describe('orígenes permitidos', () => {
  const site = 'https://mind-racer.pages.dev';

  it('conexión desde el sitio publicado: se acepta', async () => {
    await start({ allowedOrigins: [site] });
    const c = await TestClient.connect(server!.port, { origin: site });
    clients.push(c);
    c.send({ type: 'create', name: 'Ana', level: 2 });
    await c.waitFor('joined');
  });

  it('conexión desde otro sitio: 403 y ninguna sala', async () => {
    await start({ allowedOrigins: [site] });
    await expect(TestClient.connect(server!.port, { origin: 'https://otro-sitio.example' })).rejects.toThrow('HTTP 403');
    await expect(TestClient.connect(server!.port)).rejects.toThrow('HTTP 403');
    expect(server!.manager.roomCount).toBe(0);
  });

  it('red local sin configuración: se acepta cualquier origen', async () => {
    await start();
    const c = await TestClient.connect(server!.port, { origin: 'http://192.168.1.12:5173' });
    clients.push(c);
    c.send({ type: 'create', name: 'Ana', level: 2 });
    await c.waitFor('joined');
  });
});

describe('límite de salas por IP', () => {
  function manager() {
    let now = 0;
    const m = new RoomManager({ now: () => now });
    const createFrom = (ip: string) => {
      const conn = new FakeConn();
      m.connect(conn, { ip });
      m.message(conn, JSON.stringify({ type: 'create', name: 'Ana', level: 1 }));
      return conn;
    };
    return { m, createFrom, advance: (ms: number) => (now += ms) };
  }

  it('demasiadas salas: la sexta en 10 minutos se rechaza con un mensaje claro', () => {
    const { m, createFrom, advance } = manager();
    for (let i = 0; i < 5; i++) {
      expect(createFrom('200.1.1.1').last('joined')).toBeDefined();
      advance(60_000);
    }
    const sixth = createFrom('200.1.1.1');
    expect(sixth.last('joined')).toBeUndefined();
    expect(sixth.last('error')).toMatchObject({
      code: 'rate-limited',
      message: 'Creaste muchas salas seguidas; espera unos minutos',
    });
    expect(m.roomCount).toBe(5);
    // Otra IP no se ve afectada.
    expect(createFrom('200.9.9.9').last('joined')).toBeDefined();
  });

  it('pasada la ventana, esa IP puede volver a crear', () => {
    const { createFrom, advance, m } = manager();
    for (let i = 0; i < 5; i++) createFrom('200.1.1.1');
    expect(createFrom('200.1.1.1').last('error')?.code).toBe('rate-limited');
    advance(10 * 60_000);
    m.tick();
    expect(createFrom('200.1.1.1').last('joined')).toBeDefined();
  });

  it('unirse a una sala no cuenta para el límite', () => {
    const { createFrom, m } = manager();
    const host = createFrom('200.1.1.1');
    const code = host.last('joined')!.code;
    for (let i = 0; i < 3; i++) {
      const guest = new FakeConn();
      m.connect(guest, { ip: '200.1.1.1' });
      m.message(guest, JSON.stringify({ type: 'join', code, name: `G${i}`, level: 1 }));
      expect(guest.last('joined')).toBeDefined();
    }
    for (let i = 0; i < 4; i++) expect(createFrom('200.1.1.1').last('joined')).toBeDefined();
  });

  it('a través del servidor real, la IP sale de X-Forwarded-For según los proxies de confianza', async () => {
    await start({ trustProxyHops: 1 });
    for (let i = 0; i < 6; i++) {
      // El cliente intenta falsificar su IP con un valor distinto en cada conexión.
      const c = await TestClient.connect(server!.port, { headers: { 'X-Forwarded-For': `1.2.3.${i}, 200.1.1.1` } });
      clients.push(c);
      c.send({ type: 'create', name: 'Ana', level: 1 });
      const reply = await c.waitFor(i < 5 ? 'joined' : 'error');
      if (i === 5) expect(reply).toMatchObject({ code: 'rate-limited' });
    }
    expect(server!.manager.roomCount).toBe(5);
  });
});
