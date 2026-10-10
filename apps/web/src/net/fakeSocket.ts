import { encode, type ClientMessage, type ServerMessage } from '@mind-racer/protocol';
import type { SocketLike } from './NetClient';

/** In-memory WebSocket for tests: records what the client sends, lets tests drive the server side. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: ClientMessage[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }

  close(): void {
    this.readyState = 3;
  }

  // ---------- server side ----------

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(message: ServerMessage): void {
    this.onmessage?.({ data: encode(message) });
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.({});
  }
}

/** Socket factory + manual timers for NetClient tests. */
export function fakeNetwork() {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  return {
    sockets,
    timers,
    createSocket: (url: string) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    setTimer: (fn: () => void, ms: number) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: () => {},
    /** Runs the oldest pending timer. */
    runTimer: () => timers.shift()?.fn(),
    get socket() {
      return sockets.at(-1)!;
    },
  };
}
