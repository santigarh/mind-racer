import { mulberry32, type RaceConfig } from '@mind-racer/engine';
import { encode, type ClientMessage, type ServerMessage } from '@mind-racer/protocol';
import type { Connection } from './connection';
import { RoomManager } from './RoomManager';

/** Connection that records every message the server sends. */
export class FakeConn implements Connection {
  readonly inbox: ServerMessage[] = [];
  send(message: ServerMessage): void {
    this.inbox.push(message);
  }
  /** Messages of one type, in order. */
  all<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return this.all(type).at(-1);
  }
  clear(): void {
    this.inbox.length = 0;
  }
}

/** A RoomManager on a fake clock, with helpers to act as several clients. */
export function harness(raceConfig?: Partial<RaceConfig>) {
  let now = 1_000_000;
  const rng = mulberry32(7);
  let tokens = 0;
  const manager = new RoomManager({
    now: () => now,
    random: () => rng.next(),
    makeToken: () => `token-${++tokens}`,
    ...(raceConfig ? { raceConfig } : {}),
  });

  const client = () => {
    const conn = new FakeConn();
    manager.connect(conn);
    const send = (message: ClientMessage | Record<string, unknown>) => manager.message(conn, encode(message as ClientMessage));
    return {
      conn,
      send,
      get id() {
        return conn.last('joined')?.playerId;
      },
      get code() {
        return conn.last('joined')?.code;
      },
      disconnect: () => manager.disconnect(conn),
    };
  };

  /** Advances the clock in 50 ms ticks, like the real server. */
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      now += Math.min(50, ms - t);
      manager.tick();
    }
  };

  return {
    manager,
    client,
    advance,
    get now() {
      return now;
    },
  };
}

/** Solves a math prompt the way a person reads it (test-only evaluator). */
export function solve(prompt: string): string {
  const js = prompt
    .replace(/(\d+) % de (\d+)/g, '($1*$2/100)')
    .replace(/√(\d+)/g, 'Math.sqrt($1)')
    .replace(/(\d+)²/g, '($1**2)')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
  return String(Function(`return (${js});`)());
}

type Client = ReturnType<ReturnType<typeof harness>['client']>;

/** Latest challenge a client received (from `challenge` or `answer` messages). */
export function currentChallenge(c: Client) {
  for (let i = c.conn.inbox.length - 1; i >= 0; i--) {
    const m = c.conn.inbox[i]!;
    if (m.type === 'challenge' || m.type === 'answer') return m.challenge;
  }
  return null;
}

/** Answers the current challenge correctly (or with `input`). */
export function answer(c: Client, input?: string) {
  const challenge = currentChallenge(c);
  if (!challenge) throw new Error('No challenge to answer');
  c.send({ type: 'answer', seq: challenge.seq, input: input ?? solve(challenge.prompt) });
}

/** Private race snapshot of a room, for assertions the protocol does not expose. */
export function roomRace(h: ReturnType<typeof harness>, code: string) {
  const room = h.manager.getRoom(code) as unknown as { race: { session: { snapshot(): import('@mind-racer/engine').RaceSnapshot } } | null };
  return room.race?.session.snapshot() ?? null;
}

/** Creates a room with a host and returns both. */
export function roomWithHost(h: ReturnType<typeof harness>, name = 'Papá', level = 8) {
  const host = h.client();
  host.send({ type: 'create', name, level });
  return { host, code: host.code! };
}
