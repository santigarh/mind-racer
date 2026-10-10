import { WebSocket, WebSocketServer } from 'ws';
import { encode } from '@mind-racer/protocol';
import type { Connection } from './connection';
import { RoomManager, type RoomManagerOptions } from './RoomManager';

/** Room tick; also the rate of `state` messages (20 Hz). */
export const TICK_MS = 50;
/** Hard cap from `ws`; the protocol rejects anything over 4 KB with an error before this. */
const SOCKET_MAX_PAYLOAD = 64 * 1024;

export interface ServerOptions extends RoomManagerOptions {
  port?: number;
  host?: string;
}

export interface RunningServer {
  port: number;
  manager: RoomManager;
  close(): Promise<void>;
}

/** Thin WebSocket layer over the RoomManager. */
export function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const manager = new RoomManager(options);
  const wss = new WebSocketServer({ port: options.port ?? 8787, host: options.host ?? '0.0.0.0', maxPayload: SOCKET_MAX_PAYLOAD });

  wss.on('connection', (socket) => {
    const conn: Connection = {
      send(message) {
        if (socket.readyState === WebSocket.OPEN) socket.send(encode(message));
      },
    };
    manager.connect(conn);
    socket.on('message', (data, isBinary) => manager.message(conn, isBinary ? null : data.toString()));
    socket.on('close', () => manager.disconnect(conn));
    socket.on('error', () => socket.terminate());
  });

  const timer = setInterval(() => manager.tick(), TICK_MS);

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : (options.port ?? 8787),
        manager,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(timer);
            for (const client of wss.clients) client.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
