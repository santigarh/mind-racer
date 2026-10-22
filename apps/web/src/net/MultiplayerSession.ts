import type { TablesSelection } from '@mind-racer/engine';
import type { Car, RoomMode, ServerMessage } from '@mind-racer/protocol';
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
  /** The device says it has no internet at all (not just a sleeping server). */
  deviceOffline: boolean;
}

/** Whether the device has internet, as the browser reports it (design D5). */
export interface DeviceNetwork {
  /** False is reliable ("surely offline"); true only means "maybe online". */
  isOnline(): boolean;
  /** Called when the device goes online or offline. */
  subscribe(listener: () => void): () => void;
}

export function browserNetwork(): DeviceNetwork {
  return {
    isOnline: () => globalThis.navigator?.onLine !== false,
    subscribe(listener) {
      globalThis.addEventListener?.('online', listener);
      globalThis.addEventListener?.('offline', listener);
      return () => {
        globalThis.removeEventListener?.('online', listener);
        globalThis.removeEventListener?.('offline', listener);
      };
    },
  };
}

export interface MultiplayerSessionOptions {
  client?: NetClient;
  /** For tests: controls the race loop and clock. */
  raceOptions?: { now?: () => number; autoLoop?: boolean };
  /** Wall clock for `offlineSince`. */
  now?: () => number;
  /** The browser's online/offline state by default. */
  network?: DeviceNetwork;
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
    const network = options.network ?? browserNetwork();
    this.view = {
      connection: this.client.status,
      playerId: null,
      room: null,
      error: null,
      race: null,
      pending: false,
      offlineSince: null,
      deviceOffline: !network.isOnline(),
    };
    this.unsubscribe = [
      this.client.onMessage((m) => this.receive(m)),
      this.client.onStatus((connection) =>
        this.update({
          connection,
          offlineSince: connection === 'open' ? null : (this.view.offlineSince ?? this.now()),
        }),
      ),
      network.subscribe(() => {
        const deviceOffline = !network.isOnline();
        if (deviceOffline || this.view.offlineSince === null) return this.update({ deviceOffline });
        // Back online: "Conectando…" again, and the server gets the full 5 s before "Despertando…".
        this.update({ deviceOffline, offlineSince: this.now() });
        // Try the server now instead of waiting up to 5 s for the next attempt.
        this.client.retryNow();
      }),
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

  /** Creates a family room, or a class room where this person is the teacher. */
  create(name: string, level: number, car?: Car, mode: RoomMode = 'family'): void {
    this.client.connect();
    this.client.send({ type: 'create', name, level, ...(car ? { car } : {}), ...(mode === 'class' ? { mode } : {}) });
    this.update({ pending: true, error: null });
  }

  /** Joins once: ignored while another request is pending or already in a room (StrictMode effects). */
  join(code: string, name: string, level: number, car?: Car): void {
    if (this.view.pending || this.view.playerId) return;
    this.client.connect();
    this.client.send({ type: 'join', code, name, level, ...(car ? { car } : {}) });
    this.update({ pending: true, error: null });
  }

  setLevel(level: number): void {
    this.client.send({ type: 'setLevel', level });
  }

  /** Class rooms, teacher only: what the next races practice; null means each student's own level. */
  setTables(tables: TablesSelection | null): void {
    this.client.send({ type: 'setTables', tables });
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

  /** Class rooms, teacher only: removes a student. */
  kick(playerId: string): void {
    this.client.send({ type: 'kick', playerId });
  }

  /** Class rooms, teacher only: ends the class for everyone. */
  closeRoom(): void {
    this.client.send({ type: 'closeRoom' });
    this.client.clearSession();
    this.view.race?.dispose();
    this.update({ playerId: null, room: null, race: null, pending: false, error: null });
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
        // Removed by the teacher, or the class was closed: no longer in a room (design D5).
        if (message.code === 'removed' || message.code === 'room-closed') {
          this.client.clearSession();
          this.view.race?.dispose();
          return this.update({
            playerId: null,
            room: null,
            race: null,
            pending: false,
            error: { code: message.code, message: message.message },
          });
        }
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
