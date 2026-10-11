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

/** Socket factory + manual timers for NetClient tests. Cleared timers disappear from `timers`. */
export function fakeNetwork() {
  const sockets: FakeSocket[] = [];
  let all: { id: number; fn: () => void; ms: number; done: boolean }[] = [];
  let nextId = 1;
  return {
    sockets,
    /** Pending timers, oldest first. */
    get timers() {
      return all.filter((t) => !t.done);
    },
    createSocket: (url: string) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    setTimer: (fn: () => void, ms: number) => {
      const timer = { id: nextId++, fn, ms, done: false };
      all.push(timer);
      return timer.id;
    },
    clearTimer: (handle: unknown) => {
      const timer = all.find((t) => t.id === handle);
      if (timer) timer.done = true;
    },
    /** Runs the oldest pending timer. */
    runTimer: () => {
      const timer = all.find((t) => !t.done);
      if (!timer) return;
      timer.done = true;
      all = all.filter((t) => !t.done || t === timer);
      timer.fn();
    },
    get socket() {
      return sockets.at(-1)!;
    },
  };
}
