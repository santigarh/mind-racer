import { WebSocket } from 'ws';
import { encode, parseServerMessage, type ClientMessage, type ServerMessage } from '@mind-racer/protocol';

type Of<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

/** Minimal Node client for integration tests: real socket, validated messages, waits. */
export class TestClient {
  readonly inbox: ServerMessage[] = [];
  private waiters: Array<() => void> = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const parsed = parseServerMessage(data.toString());
      if (!parsed.ok) throw new Error(`Invalid server message: ${parsed.error}`);
      // Answer pings like the browser client does.
      if (parsed.message.type === 'ping') this.send({ type: 'pong', id: parsed.message.id });
      this.inbox.push(parsed.message);
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  static connect(port: number, options: { origin?: string; headers?: Record<string, string> } = {}): Promise<TestClient> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    });
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(new TestClient(socket)));
      socket.once('error', reject);
      socket.once('unexpected-response', (req, res) => {
        req.destroy();
        reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
  }

  send(message: ClientMessage): void {
    this.socket.send(encode(message));
  }

  sendRaw(raw: string): void {
    this.socket.send(raw);
  }

  last<T extends ServerMessage['type']>(type: T): Of<T> | undefined {
    return this.inbox.filter((m): m is Of<T> => m.type === type).at(-1);
  }

  /** Resolves with the first message (after `from`) matching `predicate`. */
  async waitFor<T extends ServerMessage['type']>(
    type: T,
    predicate: (m: Of<T>) => boolean = () => true,
    timeoutMs = 5000,
  ): Promise<Of<T>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.inbox.find((m): m is Of<T> => m.type === type && predicate(m as Of<T>));
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${type}`);
      await new Promise<void>((wake) => {
        this.waiters.push(wake);
        setTimeout(wake, 50);
      });
    }
  }

  close(): void {
    this.socket.close();
  }
}
