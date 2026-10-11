import { encode, parseServerMessage, type ClientMessage, type ServerMessage } from '@mind-racer/protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** The part of WebSocket we use, so tests can pass a fake. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface StoredSession {
  code: string;
  token: string;
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface NetClientOptions {
  url: string;
  createSocket?: (url: string) => SocketLike;
  /** sessionStorage by default: survives a reload, not shared between tabs. */
  storage?: KeyValue | null;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const SESSION_KEY = 'mind-racer:session';
const OPEN = 1;
/** Waits between reconnection attempts (design.md D8). */
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 5000] as const;
/** A socket that neither opens nor closes in this time is abandoned and retried. */
export const CONNECT_TIMEOUT_MS = 10_000;

/** Server URL: VITE_SERVER_URL, or the same host that served the page on port 8787. */
export function serverUrl(
  configured: string | undefined = import.meta.env.VITE_SERVER_URL,
  location: Pick<Location, 'hostname' | 'protocol'> = window.location,
): string {
  if (configured) return configured;
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.hostname}:8787`;
}

function defaultStorage(): KeyValue | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * WebSocket connection to the game server: validates messages, answers pings, remembers the
 * room session and reconnects with growing waits, rejoining the room on its own.
 */
export class NetClient {
  private readonly url: string;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly storage: KeyValue | null;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private socket: SocketLike | null = null;
  private statusValue: ConnectionStatus = 'idle';
  private attempt = 0;
  private timer: unknown = null;
  private connectTimer: unknown = null;
  private queue: ClientMessage[] = [];
  private readonly messageListeners = new Set<(message: ServerMessage) => void>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(options: NetClientOptions) {
    this.url = options.url;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  get status(): ConnectionStatus {
    return this.statusValue;
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Opens the connection (idempotent). Messages sent before it opens are queued. */
  connect(): void {
    if (this.socket || this.statusValue === 'closed') return;
    this.open('connecting');
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === OPEN) this.socket.send(encode(message));
    else this.queue.push(message);
  }

  /** Room session saved by the last `joined`, if any. */
  storedSession(): StoredSession | null {
    try {
      const raw = this.storage?.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<StoredSession>;
      return typeof data.code === 'string' && typeof data.token === 'string' ? { code: data.code, token: data.token } : null;
    } catch {
      return null;
    }
  }

  clearSession(): void {
    try {
      this.storage?.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  /** Closes for good: no reconnection. */
  close(): void {
    this.setStatus('closed');
    this.clearConnectTimer();
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }

  // ---------- internals ----------

  private open(status: 'connecting' | 'reconnecting'): void {
    this.setStatus(status);
    const socket = this.createSocket(this.url);
    this.socket = socket;
    this.connectTimer = this.setTimer(() => {
      this.connectTimer = null;
      if (this.socket !== socket || socket.readyState === OPEN) return;
      // Stuck (e.g. a sleeping server that never answers): drop it and retry.
      socket.onclose = null;
      socket.close();
      this.lost();
    }, CONNECT_TIMEOUT_MS);
    socket.onopen = () => {
      this.clearConnectTimer();
      const reconnecting = this.statusValue === 'reconnecting';
      this.attempt = 0;
      this.setStatus('open');
      const session = this.storedSession();
      if (reconnecting && session) socket.send(encode({ type: 'rejoin', ...session }));
      for (const message of this.queue.splice(0)) socket.send(encode(message));
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onclose = () => this.lost();
    socket.onerror = () => {
      // onclose follows; reconnection happens there.
    };
  }

  private receive(data: unknown): void {
    const parsed = parseServerMessage(data);
    if (!parsed.ok) return;
    const message = parsed.message;
    if (message.type === 'ping') {
      this.send({ type: 'pong', id: message.id });
      return;
    }
    if (message.type === 'joined') {
      try {
        this.storage?.setItem(SESSION_KEY, JSON.stringify({ code: message.code, token: message.token }));
      } catch {
        // Without storage the game still works; it just cannot survive a reload.
      }
    }
    if (message.type === 'error' && message.code === 'rejoin-failed') this.clearSession();
    for (const listener of this.messageListeners) listener(message);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) this.clearTimer(this.connectTimer);
    this.connectTimer = null;
  }

  private lost(): void {
    this.clearConnectTimer();
    this.socket = null;
    if (this.statusValue === 'closed') return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)]!;
    this.attempt++;
    this.setStatus('reconnecting');
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (this.statusValue !== 'closed') this.open('reconnecting');
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.statusValue === status) return;
    this.statusValue = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
