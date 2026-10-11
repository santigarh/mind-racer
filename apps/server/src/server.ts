import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { encode } from '@mind-racer/protocol';
import { DEFAULT_PORT } from './config';
import type { Connection } from './connection';
import { clientIp, isOriginAllowed } from './net';
import { RoomManager, type RoomManagerOptions } from './RoomManager';

/** Room tick; also the rate of `state` messages (20 Hz). */
export const TICK_MS = 50;
/** Hard cap from `ws`; the protocol rejects anything over 4 KB with an error before this. */
const SOCKET_MAX_PAYLOAD = 64 * 1024;

export interface ServerOptions extends RoomManagerOptions {
  port?: number;
  host?: string;
  /** null or undefined = accept any Origin. */
  allowedOrigins?: readonly string[] | null;
  trustProxyHops?: number;
}

export interface RunningServer {
  port: number;
  manager: RoomManager;
  close(): Promise<void>;
}

/**
 * HTTP server with `GET /health` and the game WebSocket on the same port, as cloud platforms
 * expect. The Origin and client IP are checked during the upgrade, before a socket exists.
 */
export function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const manager = new RoomManager(options);
  const allowedOrigins = options.allowedOrigins ?? null;
  const trustProxyHops = options.trustProxyHops ?? 0;

  const http = createServer((req, res) => handleHttp(req, res, manager));
  const wss = new WebSocketServer({ noServer: true, maxPayload: SOCKET_MAX_PAYLOAD });

  http.on('upgrade', (req, socket, head) => {
    // A client resetting the connection mid-handshake must not crash the process.
    socket.on('error', () => socket.destroy());
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    const ip = clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress, trustProxyHops);
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws, ip));
  });

  const accept = (socket: WebSocket, ip: string) => {
    const conn: Connection = {
      send(message) {
        if (socket.readyState === WebSocket.OPEN) socket.send(encode(message));
      },
    };
    manager.connect(conn, { ip });
    socket.on('message', (data, isBinary) => manager.message(conn, isBinary ? null : data.toString()));
    socket.on('close', () => manager.disconnect(conn));
    socket.on('error', () => socket.terminate());
  };

  const timer = setInterval(() => manager.tick(), TICK_MS);

  return new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? DEFAULT_PORT, options.host ?? '0.0.0.0', () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : (options.port ?? DEFAULT_PORT),
        manager,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(timer);
            for (const client of wss.clients) client.terminate();
            wss.close();
            http.closeAllConnections();
            http.close(() => done());
          }),
      });
    });
  });
}

function handleHttp(req: IncomingMessage, res: ServerResponse, manager: RoomManager): void {
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'GET' && path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', rooms: manager.roomCount }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}
