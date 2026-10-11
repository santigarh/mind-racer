import type { ServerMessage } from '@mind-racer/protocol';
import { NetworkRaceController } from '../game/NetworkRaceController';
import { NetClient, serverUrl, type ConnectionStatus } from './NetClient';

export type RoomMessage = Extract<ServerMessage, { type: 'room' }>;

export interface MultiplayerView {
  connection: ConnectionStatus;
  playerId: string | null;
  room: RoomMessage | null;
  /** Last error from the server, e.g. "No encontramos esa sala". */
  error: { code: string; message: string } | null;
  /** Current or last online race; replaced on every raceStart. */
  race: NetworkRaceController | null;
  /** A create/join/rejoin was sent and no answer arrived yet. */
  pending: boolean;
  /** When the connection stopped being open (or the first attempt began); null while open. */
  offlineSince: number | null;
}

export interface MultiplayerSessionOptions {
  client?: NetClient;
  /** For tests: controls the race loop and clock. */
  raceOptions?: { now?: () => number; autoLoop?: boolean };
  /** Wall clock for `offlineSince`. */
  now?: () => number;
}

/**
 * Everything about playing in a room, as one store for React: the connection, the room as the
 * server sees it, and the current race. The server's status for this player decides the screen.
 */
export class MultiplayerSession {
  readonly client: NetClient;
  private readonly raceOptions: MultiplayerSessionOptions['raceOptions'];
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: Array<() => void>;
  private view: MultiplayerView;

  constructor(options: MultiplayerSessionOptions = {}) {
    this.client = options.client ?? new NetClient({ url: serverUrl() });
    this.raceOptions = options.raceOptions;
    this.now = options.now ?? (() => Date.now());
    this.view = {
      connection: this.client.status,
      playerId: null,
      room: null,
      error: null,
      race: null,
      pending: false,
      offlineSince: null,
    };
    this.unsubscribe = [
      this.client.onMessage((m) => this.receive(m)),
      this.client.onStatus((connection) =>
        this.update({
          connection,
          offlineSince: connection === 'open' ? null : (this.view.offlineSince ?? this.now()),
        }),
      ),
    ];
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): MultiplayerView => this.view;

  /** True when this tab was in a room before a reload. */
  canResume(): boolean {
    return this.client.storedSession() !== null;
  }

  /** Code of the room this tab was in before a reload, if any. */
  resumeCode(): string | null {
    return this.client.storedSession()?.code ?? null;
  }

  /** Rejoins the stored room once (repeated calls, e.g. from StrictMode effects, do nothing). */
  resume(): void {
    const session = this.client.storedSession();
    if (!session || this.view.pending || this.view.playerId) return;
    this.client.connect();
    this.client.send({ type: 'rejoin', ...session });
    this.update({ pending: true, error: null });
  }

  create(name: string, level: number): void {
    this.client.connect();
    this.client.send({ type: 'create', name, level });
    this.update({ pending: true, error: null });
  }

  /** Joins once: ignored while another request is pending or already in a room (StrictMode effects). */
  join(code: string, name: string, level: number): void {
    if (this.view.pending || this.view.playerId) return;
    this.client.connect();
    this.client.send({ type: 'join', code, name, level });
    this.update({ pending: true, error: null });
  }

  setLevel(level: number): void {
    this.client.send({ type: 'setLevel', level });
  }

  start(): void {
    this.client.send({ type: 'start' });
  }

  abandon(): void {
    this.view.race?.abandon();
  }

  backToRoom(): void {
    this.client.send({ type: 'backToRoom' });
  }

  /** Leaves the room for good and closes the connection. */
  leave(): void {
    this.client.send({ type: 'leave' });
    this.client.clearSession();
    this.dispose();
  }

  dispose(): void {
    this.view.race?.dispose();
    for (const off of this.unsubscribe.splice(0)) off();
    this.client.close();
    this.listeners.clear();
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'joined':
        return this.update({ playerId: message.playerId, pending: false, error: null });
      case 'room':
        return this.update({ room: message });
      case 'error':
        return this.update({ error: { code: message.code, message: message.message }, pending: false });
      case 'raceStart': {
        this.view.race?.dispose();
        const race = new NetworkRaceController({
          channel: this.client,
          raceStart: message,
          playerId: this.view.playerId ?? '',
          ...(this.raceOptions?.now ? { now: this.raceOptions.now } : {}),
          ...(this.raceOptions?.autoLoop !== undefined ? { autoLoop: this.raceOptions.autoLoop } : {}),
        });
        return this.update({ race });
      }
      default:
        return;
    }
  }

  private update(patch: Partial<MultiplayerView>): void {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}
