import { describe, expect, it } from 'vitest';
import { CONNECT_TIMEOUT_MS, NetClient, RECONNECT_DELAYS_MS, SESSION_KEY, serverUrl } from './NetClient';
import { fakeNetwork } from './fakeSocket';
import type { ServerMessage } from '@mind-racer/protocol';

function setup() {
  const net = fakeNetwork();
  const client = new NetClient({
    url: 'ws://casa:8787',
    createSocket: net.createSocket,
    storage: sessionStorage,
    setTimer: net.setTimer,
    clearTimer: net.clearTimer,
  });
  const received: ServerMessage[] = [];
  const statuses: string[] = [];
  client.onMessage((m) => received.push(m));
  client.onStatus((s) => statuses.push(s));
  return { net, client, received, statuses };
}

const joined: ServerMessage = { type: 'joined', code: 'K7QF', playerId: 'p2', token: 'secreto' };

describe('URL del servidor', () => {
  it('usa VITE_SERVER_URL si está definida', () => {
    expect(serverUrl('ws://otro:9000', { hostname: 'casa', protocol: 'http:' })).toBe('ws://otro:9000');
  });

  it('convierte http(s) en ws(s) y deja ws(s) como está', () => {
    const at = { hostname: 'casa', protocol: 'https:' };
    expect(serverUrl('https://mind-racer.onrender.com', at)).toBe('wss://mind-racer.onrender.com');
    expect(serverUrl('http://192.168.1.20:8787', at)).toBe('ws://192.168.1.20:8787');
    expect(serverUrl('wss://mind-racer.onrender.com', at)).toBe('wss://mind-racer.onrender.com');
    expect(serverUrl('ws://192.168.1.20:8787', at)).toBe('ws://192.168.1.20:8787');
    expect(serverUrl('HTTPS://Servidor.example ', at)).toBe('wss://Servidor.example');
  });

  it('por defecto, el mismo host que sirvió la página en el puerto 8787', () => {
    expect(serverUrl(undefined, { hostname: '192.168.1.20', protocol: 'http:' })).toBe('ws://192.168.1.20:8787');
    expect(serverUrl(undefined, { hostname: 'juego.example', protocol: 'https:' })).toBe('wss://juego.example:8787');
  });
});

describe('NetClient', () => {
  it('encola mensajes hasta que abre la conexión', () => {
    const { net, client, statuses } = setup();
    client.connect();
    client.send({ type: 'create', name: 'Ana', level: 3 });
    expect(net.socket.sent).toEqual([]);
    net.socket.open();
    expect(net.socket.sent).toEqual([{ type: 'create', name: 'Ana', level: 3 }]);
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('valida los mensajes del servidor y descarta los inválidos', () => {
    const { net, client, received } = setup();
    client.connect();
    net.socket.open();
    net.socket.onmessage?.({ data: '{"type":"room"}' });
    net.socket.onmessage?.({ data: 'basura' });
    net.socket.receive(joined);
    expect(received).toEqual([joined]);
  });

  it('responde los ping sin molestar a la app', () => {
    const { net, client, received } = setup();
    client.connect();
    net.socket.open();
    net.socket.receive({ type: 'ping', id: 9 });
    expect(net.socket.sent).toEqual([{ type: 'pong', id: 9 }]);
    expect(received).toEqual([]);
  });

  it('guarda la sesión en sessionStorage al unirse', () => {
    const { net, client } = setup();
    client.connect();
    net.socket.open();
    net.socket.receive(joined);
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!)).toEqual({ code: 'K7QF', token: 'secreto' });
    expect(client.storedSession()).toEqual({ code: 'K7QF', token: 'secreto' });
  });

  it('reconecta con espera creciente y vuelve a la sala con rejoin', () => {
    const { net, client, statuses } = setup();
    client.connect();
    net.socket.open();
    net.socket.receive(joined);

    net.socket.drop();
    expect(client.status).toBe('reconnecting');
    for (const delay of RECONNECT_DELAYS_MS.slice(0, 3)) {
      expect(net.timers[0]!.ms).toBe(delay);
      net.runTimer();
      net.socket.drop(); // falla de nuevo
    }
    expect(net.timers[0]!.ms).toBe(RECONNECT_DELAYS_MS[3]);
    net.runTimer();
    net.socket.open();
    expect(net.socket.sent[0]).toEqual({ type: 'rejoin', code: 'K7QF', token: 'secreto' });
    expect(client.status).toBe('open');
    expect(statuses.at(-1)).toBe('open');
    // Tras reconectar, el contador de esperas vuelve a empezar.
    net.socket.drop();
    expect(net.timers.at(-1)!.ms).toBe(RECONNECT_DELAYS_MS[0]);
  });

  it('la espera nunca pasa de 5 s', () => {
    const { net, client } = setup();
    client.connect();
    for (let i = 0; i < 8; i++) {
      net.socket.drop();
      net.runTimer();
    }
    net.socket.drop();
    expect(net.timers[0]!.ms).toBe(5000);
  });

  it('si el servidor rechaza el rejoin, olvida la sesión', () => {
    const { net, client } = setup();
    client.connect();
    net.socket.open();
    net.socket.receive(joined);
    net.socket.receive({ type: 'error', code: 'rejoin-failed', message: 'No pudimos volver a la sala' });
    expect(client.storedSession()).toBeNull();
  });

  it('conexión que no responde: a los 10 s se abandona y se reintenta', () => {
    const { net, client } = setup();
    client.connect();
    client.send({ type: 'create', name: 'Ana', level: 2 });
    const stuck = net.socket;
    expect(net.timers.map((t) => t.ms)).toEqual([CONNECT_TIMEOUT_MS]);
    net.runTimer(); // pasan 10 s sin open ni close
    expect(stuck.readyState).toBe(3);
    expect(client.status).toBe('reconnecting');
    expect(net.timers.map((t) => t.ms)).toEqual([RECONNECT_DELAYS_MS[0]]);
    net.runTimer();
    expect(net.sockets).toHaveLength(2);
    // Si el socket viejo se cierra tarde, no dispara otro reintento.
    stuck.onclose?.({});
    net.socket.open();
    expect(net.socket.sent).toEqual([{ type: 'create', name: 'Ana', level: 2 }]);
    expect(net.timers).toHaveLength(0);
  });

  it('un socket que abre a tiempo cancela el tiempo máximo', () => {
    const { net, client } = setup();
    client.connect();
    net.socket.open();
    expect(net.timers).toHaveLength(0);
  });

  it('close() no reconecta', () => {
    const { net, client } = setup();
    client.connect();
    net.socket.open();
    client.close();
    expect(client.status).toBe('closed');
    expect(net.timers).toHaveLength(0);
    client.connect();
    expect(net.sockets).toHaveLength(1);
  });

  it('retryNow() salta la espera y envía lo que estaba en cola (Vuelve la conexión)', () => {
    const { net, client } = setup();
    client.connect();
    client.send({ type: 'join', code: 'K7QF', name: 'Ana', level: 2 });
    for (let i = 0; i < 6; i++) {
      net.socket.drop();
      net.runTimer();
    }
    net.socket.drop();
    expect(net.timers.map((t) => t.ms)).toEqual([5000]);

    client.retryNow();
    expect(net.sockets).toHaveLength(8);
    expect(net.timers.map((t) => t.ms)).toEqual([CONNECT_TIMEOUT_MS]);
    net.socket.open();
    expect(net.socket.sent).toEqual([{ type: 'join', code: 'K7QF', name: 'Ana', level: 2 }]);
  });

  it('retryNow() no hace nada conectado, con un intento en curso o cerrado', () => {
    const { net, client } = setup();
    client.connect();
    client.retryNow(); // intento en curso
    expect(net.sockets).toHaveLength(1);
    net.socket.open();
    client.retryNow();
    expect(net.sockets).toHaveLength(1);
    net.socket.drop();
    client.close();
    client.retryNow();
    expect(net.sockets).toHaveLength(1);
  });
});

describe('MultiplayerSession.resume', () => {
  it('envía un solo rejoin aunque se llame dos veces', async () => {
    const { MultiplayerSession } = await import('./MultiplayerSession');
    const net = fakeNetwork();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: 'K7QF', token: 't' }));
    const session = new MultiplayerSession({
      client: new NetClient({ url: 'ws://x', createSocket: net.createSocket, storage: sessionStorage, setTimer: net.setTimer, clearTimer: net.clearTimer }),
    });
    session.resume();
    session.resume();
    net.socket.open();
    expect(net.socket.sent).toEqual([{ type: 'rejoin', code: 'K7QF', token: 't' }]);
  });
});
