import { randomUUID } from 'node:crypto';
import type { RaceConfig } from '@mind-racer/engine';
import { generateRoomCode, parseClientMessage, type ErrorCode, type RoomMode } from '@mind-racer/protocol';
import { ROOM_LIMITS, type Connection } from './connection';
import { Room } from './Room';

export interface RoomManagerOptions {
  now?: () => number;
  random?: () => number;
  makeToken?: () => string;
  maxRooms?: number;
  raceConfig?: Partial<RaceConfig>;
}

const TOO_MANY_ROOMS_TEXT = 'Creaste muchas salas seguidas; espera unos minutos';

const ERROR_TEXT: Record<ErrorCode, string> = {
  'room-not-found': 'No encontramos esa sala',
  'room-full': 'La sala está llena',
  'too-many-rooms': 'Hay demasiadas salas abiertas; prueba en un momento',
  'invalid-message': 'Mensaje inválido',
  'not-host': 'Solo el anfitrión puede hacer eso',
  'not-in-room': 'Primero crea una sala o únete a una',
  'rate-limited': 'Demasiados mensajes',
  'rejoin-failed': 'No pudimos volver a la sala',
  removed: 'La profesora te quitó de la sala',
  'room-closed': 'La profesora cerró la sala',
};

/** All open rooms, plus which connection belongs to which room and player. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly bindings = new Map<Connection, { room: Room; playerId: string } | null>();
  private readonly ips = new Map<Connection, string>();
  /** Creation times of recent rooms, per client IP. */
  private readonly createdByIp = new Map<string, number[]>();
  private readonly emptySince = new Map<string, number>();
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly makeToken: () => string;
  private readonly maxRooms: number;
  private readonly raceConfig: Partial<RaceConfig> | undefined;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
    this.makeToken = options.makeToken ?? (() => randomUUID());
    this.maxRooms = options.maxRooms ?? ROOM_LIMITS.maxRooms;
    this.raceConfig = options.raceConfig;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  connect(conn: Connection, info: { ip?: string } = {}): void {
    this.bindings.set(conn, null);
    if (info.ip) this.ips.set(conn, info.ip);
  }

  disconnect(conn: Connection): void {
    const binding = this.bindings.get(conn);
    binding?.room.disconnect(binding.playerId);
    this.bindings.delete(conn);
    this.ips.delete(conn);
  }

  message(conn: Connection, raw: unknown): void {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(conn, 'invalid-message', parsed.error);
    const message = parsed.message;
    const binding = this.bindings.get(conn) ?? null;

    switch (message.type) {
      case 'create': {
        this.leaveCurrent(conn);
        if (this.rooms.size >= this.maxRooms) return this.error(conn, 'too-many-rooms');
        if (!this.allowRoomFrom(this.ips.get(conn))) return this.error(conn, 'rate-limited', TOO_MANY_ROOMS_TEXT);
        const room = this.createRoom(message.mode ?? 'family');
        return this.bind(conn, room, room.join(conn, message.name, message.level, message.car));
      }
      case 'join': {
        this.leaveCurrent(conn);
        const room = this.rooms.get(message.code);
        if (!room) return this.error(conn, 'room-not-found');
        return this.bind(conn, room, room.join(conn, message.name, message.level, message.car));
      }
      case 'rejoin': {
        const room = this.rooms.get(message.code);
        // A repeated rejoin to the same room only re-syncs; leaving first would drop the player.
        if (binding && binding.room !== room) this.leaveCurrent(conn);
        if (!room) return this.error(conn, 'rejoin-failed');
        return this.bind(conn, room, room.rejoin(conn, message.token));
      }
      case 'leave':
        return this.leaveCurrent(conn);
      default:
        if (!binding) return this.error(conn, 'not-in-room');
        binding.room.handle(binding.playerId, message);
        this.dropIfClosed(binding.room);
    }
  }

  /** A closed class room disappears at once: its code stops working and its connections are unbound. */
  private dropIfClosed(room: Room): void {
    if (!room.closed) return;
    this.rooms.delete(room.code);
    this.emptySince.delete(room.code);
    for (const [conn, binding] of this.bindings) if (binding?.room === room) this.bindings.set(conn, null);
  }

  /** Drives every room and closes rooms nobody has been connected to for a while. */
  tick(): void {
    const now = this.now();
    for (const [ip, times] of this.createdByIp) {
      const recent = times.filter((t) => now - t < ROOM_LIMITS.roomsPerIpWindowMs);
      if (recent.length === 0) this.createdByIp.delete(ip);
      else this.createdByIp.set(ip, recent);
    }
    for (const [code, room] of this.rooms) {
      room.tick();
      if (room.closed) {
        this.dropIfClosed(room);
        continue;
      }
      if (room.connectedCount > 0) {
        this.emptySince.delete(code);
        continue;
      }
      const since = this.emptySince.get(code);
      if (since === undefined) this.emptySince.set(code, now);
      else if (now - since >= ROOM_LIMITS.emptyRoomTtlMs) {
        this.rooms.delete(code);
        this.emptySince.delete(code);
      }
    }
  }

  /** Sliding window of room creations per IP; records this one when allowed. */
  private allowRoomFrom(ip: string | undefined): boolean {
    if (!ip) return true;
    const now = this.now();
    const recent = (this.createdByIp.get(ip) ?? []).filter((t) => now - t < ROOM_LIMITS.roomsPerIpWindowMs);
    if (recent.length >= ROOM_LIMITS.roomsPerIp) {
      this.createdByIp.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.createdByIp.set(ip, recent);
    return true;
  }

  private createRoom(mode: RoomMode): Room {
    let code = generateRoomCode(this.random);
    while (this.rooms.has(code)) code = generateRoomCode(this.random);
    const room = new Room(code, {
      now: this.now,
      random: this.random,
      makeToken: this.makeToken,
      mode,
      ...(this.raceConfig ? { raceConfig: this.raceConfig } : {}),
    });
    this.rooms.set(code, room);
    return room;
  }

  private bind(conn: Connection, room: Room, result: string | ErrorCode): void {
    if (result in ERROR_TEXT) return this.error(conn, result as ErrorCode);
    this.bindings.set(conn, { room, playerId: result });
  }

  private leaveCurrent(conn: Connection): void {
    const binding = this.bindings.get(conn);
    if (!binding) return;
    binding.room.leave(binding.playerId);
    this.bindings.set(conn, null);
    this.dropIfClosed(binding.room);
  }

  private error(conn: Connection, code: ErrorCode, message = ERROR_TEXT[code]): void {
    conn.send({ type: 'error', code, message });
  }
}
