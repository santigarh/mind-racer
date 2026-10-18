import {
  DEFAULT_BOT_PROFILES,
  RaceSession,
  type PublicChallenge,
  type RaceConfig,
  type RaceSnapshot,
} from '@mind-racer/engine';
import { DEFAULT_CAR } from '@mind-racer/protocol';
import type {
  Car,
  ClientMessage,
  ErrorCode,
  NetRunnerResult,
  NetRunnerState,
  Presence,
  RaceRunner,
  Role,
  RoomMode,
  ServerMessage,
} from '@mind-racer/protocol';
import { ROOM_LIMITS, type Connection } from './connection';

export interface RoomOptions {
  now: () => number;
  /** Uniform [0, 1), used for race seeds. */
  random: () => number;
  makeToken: () => string;
  raceConfig?: Partial<RaceConfig>;
  /** Family by default. */
  mode?: RoomMode;
}

type PlayerStatus = 'lobby' | 'racing' | 'results' | 'waiting';

interface Player {
  id: string;
  /** In a class room the creator is the teacher, who never races; everyone else is a student. */
  role: Role;
  name: string;
  level: number;
  /** Chosen in the garage; the classic amber car when none (or an invalid one) arrived. */
  car: Car;
  token: string;
  conn: Connection | null;
  disconnectedAt: number | null;
  status: PlayerStatus;
  /** Smoothed round-trip time, ms; null until the first pong. */
  rtt: number | null;
  ping: { id: number; sentAt: number } | null;
  lastPingAt: number;
  answerTimes: number[];
  /** Seq of the last challenge sent to this player. */
  sentChallengeSeq: number | null;
}

interface ActiveRace {
  session: RaceSession;
  /** Room clock time of race time 0. */
  epoch: number;
  runners: RaceRunner[];
  humanIds: readonly string[];
  /** People who abandoned or exited this race. */
  left: Set<string>;
}

/**
 * One private room: lobby, players and the current race. Knows nothing about sockets;
 * it talks through `Connection`s and is driven by `handle()` and `tick()`.
 */
export class Room {
  readonly code: string;
  readonly mode: RoomMode;
  /** Set when a class room is closed; the manager then drops the room. */
  closed = false;
  private readonly options: RoomOptions;
  /** Insertion order is join order (used to pick the next host). */
  private readonly players = new Map<string, Player>();
  private hostId: string | null = null;
  private race: ActiveRace | null = null;
  private nextPlayer = 1;
  private nextPing = 1;
  private ticks = 0;

  constructor(code: string, options: RoomOptions) {
    this.code = code;
    this.options = options;
    this.mode = options.mode ?? 'family';
  }

  private get isClass(): boolean {
    return this.mode === 'class';
  }

  private students(): Player[] {
    return [...this.players.values()].filter((p) => p.role === 'student');
  }

  get phase(): 'lobby' | 'racing' {
    return this.race ? 'racing' : 'lobby';
  }

  get size(): number {
    return this.players.size;
  }

  get connectedCount(): number {
    let count = 0;
    for (const p of this.players.values()) if (p.conn) count++;
    return count;
  }

  // ---------- membership ----------

  /** Adds a person; returns their id, or an error code. */
  join(conn: Connection, name: string, level: number, car: Car = DEFAULT_CAR): string | ErrorCode {
    if (this.closed) return 'room-not-found';
    // The first person in a class room is the teacher; she does not take a student's place.
    const role: Role = this.isClass && this.players.size === 0 ? 'teacher' : 'student';
    const full = this.isClass
      ? role === 'student' && this.students().length >= ROOM_LIMITS.classCapacity
      : this.players.size >= ROOM_LIMITS.capacity;
    if (full) return 'room-full';
    const now = this.options.now();
    const player: Player = {
      id: `p${this.nextPlayer++}`,
      role,
      name,
      level,
      car: { ...car },
      token: this.options.makeToken(),
      conn,
      disconnectedAt: null,
      status: this.race && role === 'student' ? 'waiting' : 'lobby',
      rtt: null,
      ping: null,
      lastPingAt: now,
      answerTimes: [],
      sentChallengeSeq: null,
    };
    this.players.set(player.id, player);
    this.hostId ??= player.id;
    conn.send({ type: 'joined', code: this.code, playerId: player.id, token: player.token });
    this.broadcastRoom();
    return player.id;
  }

  /** Re-attaches a person who lost the connection; returns their id, or an error code. */
  rejoin(conn: Connection, token: string): string | ErrorCode {
    const player = [...this.players.values()].find((p) => p.token === token);
    if (!player) return 'rejoin-failed';
    const now = this.options.now();
    if (player.disconnectedAt !== null && now - player.disconnectedAt > ROOM_LIMITS.reconnectGraceMs) {
      return 'rejoin-failed';
    }
    player.conn = conn;
    player.disconnectedAt = null;
    player.ping = null;
    player.lastPingAt = now;
    conn.send({ type: 'joined', code: this.code, playerId: player.id, token: player.token });
    this.broadcastRoom();
    if (this.race && player.status === 'racing') {
      this.sendRaceStart(player);
      player.sentChallengeSeq = null;
      this.syncChallenge(player);
      this.send(player, this.stateFor(player, this.race.session.snapshot()));
    } else if (this.race && player.role === 'teacher') {
      this.sendRaceStart(player);
      this.send(player, this.stateFor(player, this.race.session.snapshot()));
    }
    return player.id;
  }

  disconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.conn = null;
    player.disconnectedAt = this.options.now();
    player.ping = null;
    this.broadcastRoom();
  }

  /** The person exits the room for good. */
  leave(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    // A class cannot go on without its teacher.
    if (player.role === 'teacher') return this.close();
    if (this.race?.humanIds.includes(playerId)) this.race.left.add(playerId);
    this.players.delete(playerId);
    if (this.hostId === playerId) this.hostId = this.players.keys().next().value ?? null;
    this.broadcastRoom();
  }

  // ---------- messages ----------

  handle(playerId: string, message: ClientMessage): void {
    const player = this.players.get(playerId);
    if (!player) return;
    switch (message.type) {
      case 'setLevel':
        if (player.status !== 'racing') {
          player.level = message.level;
          this.broadcastRoom();
        }
        return;
      case 'start':
        return this.start(player);
      case 'answer':
        return this.answer(player, message.seq, message.input);
      case 'abandon':
        return this.abandon(player);
      case 'backToRoom':
        if (player.status === 'results') {
          player.status = this.race ? 'waiting' : 'lobby';
          this.broadcastRoom();
        }
        return;
      case 'pong':
        return this.pong(player, message.id);
      case 'kick':
        return this.kick(player, message.playerId);
      case 'closeRoom':
        if (player.role === 'teacher') this.close();
        else this.error(player, 'not-host', 'Solo la profesora puede cerrar la sala');
        return;
      default:
        // create / join / rejoin / leave are handled by the RoomManager.
        return;
    }
  }

  // ---------- race ----------

  private start(player: Player): void {
    if (player.id !== this.hostId) return this.error(player, 'not-host', 'Solo el anfitrión puede iniciar la carrera');
    if (this.race || player.status !== 'lobby') return;
    // The teacher never races; class races have no bots.
    // In a class, students still looking at the last results join the next race too: the teacher leads the pace.
    const racers = this.students().filter((p) => p.conn && (p.status === 'lobby' || (this.isClass && p.status === 'results')));
    if (racers.length === 0) return;

    const botLevel = Math.min(...racers.map((p) => p.level));
    const botCount = this.isClass ? 0 : Math.max(0, ROOM_LIMITS.capacity - racers.length);
    const session = new RaceSession({
      seed: Math.floor(this.options.random() * 2 ** 32),
      level: botLevel,
      humans: racers.map((p) => ({ id: p.id, name: p.name, level: p.level })),
      bots: DEFAULT_BOT_PROFILES.slice(0, botCount).map((profile) => ({ profile, level: botLevel })),
      ...(this.options.raceConfig ? { config: this.options.raceConfig } : {}),
    });
    const profiles = session.botProfiles();
    this.race = {
      session,
      epoch: this.options.now(),
      humanIds: session.humanIds,
      left: new Set(),
      runners: session.snapshot().runners.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        chosenLevel: r.chosenLevel,
        ...(profiles[r.id] ? { botProfile: profiles[r.id] } : {}),
        ...(this.players.has(r.id) ? { car: { ...this.players.get(r.id)!.car } } : {}),
      })),
    };
    session.start(0);
    for (const p of racers) {
      p.status = 'racing';
      p.sentChallengeSeq = null;
      this.sendRaceStart(p);
    }
    const teacher = this.teacher();
    if (teacher) this.sendRaceStart(teacher);
    this.broadcastRoom();
    this.broadcastState();
  }

  private teacher(): Player | undefined {
    return [...this.players.values()].find((p) => p.role === 'teacher');
  }

  /** Class rooms: the teacher removes a student, who cannot rejoin with that session. */
  private kick(by: Player, targetId: string): void {
    if (by.role !== 'teacher') return this.error(by, 'not-host', 'Solo la profesora puede quitar alumnos');
    const target = this.players.get(targetId);
    if (!target || target.role !== 'student') return;
    if (this.race?.humanIds.includes(target.id)) this.race.left.add(target.id);
    this.error(target, 'removed', 'La profesora te quitó de la sala');
    this.players.delete(target.id);
    this.broadcastRoom();
  }

  /** Ends a class room for everyone; the manager drops it and the code stops working. */
  private close(): void {
    for (const p of this.players.values()) {
      if (p.role === 'student') this.error(p, 'room-closed', 'La profesora cerró la sala');
    }
    this.players.clear();
    this.race = null;
    this.hostId = null;
    this.closed = true;
  }

  private answer(player: Player, seq: number, input: string): void {
    const race = this.race;
    if (!race || player.status !== 'racing' || race.left.has(player.id)) return;
    const now = this.options.now();
    player.answerTimes = player.answerTimes.filter((t) => now - t < 1000);
    if (player.answerTimes.length >= ROOM_LIMITS.answersPerSecond) {
      return this.error(player, 'rate-limited', 'Demasiadas respuestas por segundo');
    }
    player.answerTimes.push(now);

    const at = now - race.epoch;
    race.session.advanceTo(at);
    const challenge = race.session.race.peekChallenge(player.id);
    // Stale or duplicated answers (for a challenge already replaced) are ignored.
    if (!challenge || challenge.seq !== seq) return;
    const discount = Math.min(player.rtt ?? 0, ROOM_LIMITS.maxLatencyDiscountMs);
    const responseMs = Math.max(1, at - challenge.issuedAtMs - discount);
    const outcome = race.session.submit(player.id, input, at, responseMs);
    if (!outcome) return;
    const next = this.publicChallenge(player.id);
    player.sentChallengeSeq = next?.seq ?? null;
    this.send(player, { type: 'answer', outcome, challenge: next });
  }

  private abandon(player: Player): void {
    const race = this.race;
    if (!race || player.status !== 'racing') return;
    race.left.add(player.id);
    player.status = 'waiting';
    this.send(player, { type: 'challenge', challenge: null });
    this.broadcastRoom();
  }

  private pong(player: Player, id: number): void {
    if (!player.ping || player.ping.id !== id) return;
    const sample = this.options.now() - player.ping.sentAt;
    player.rtt = player.rtt === null ? sample : player.rtt + ROOM_LIMITS.rttSmoothing * (sample - player.rtt);
    player.ping = null;
  }

  // ---------- clock ----------

  tick(): void {
    const now = this.options.now();
    for (const player of this.players.values()) {
      if (player.conn && now - player.lastPingAt >= ROOM_LIMITS.pingIntervalMs) {
        player.lastPingAt = now;
        player.ping = { id: this.nextPing++, sentAt: now };
        this.send(player, { type: 'ping', id: player.ping.id });
      }
    }

    const race = this.race;
    if (race) {
      race.session.advanceTo(now - race.epoch);
      if (race.session.race.phase !== 'finished' && this.everyoneDone(race, now)) race.session.finishNow();
      for (const player of this.racingPlayers()) this.syncChallenge(player);
      const finished = race.session.race.phase === 'finished';
      // Class rooms send state 5 times a second instead of every tick (design D3); always the last one.
      if (!this.isClass || this.ticks++ % ROOM_LIMITS.classStateEveryTicks === 0 || finished) this.broadcastState();
      if (finished) this.finishRace(race);
    }

    // People gone longer than the grace period leave the room (not mid-race: their car stays).
    if (!this.race) {
      for (const player of [...this.players.values()]) {
        if (player.disconnectedAt !== null && now - player.disconnectedAt > ROOM_LIMITS.reconnectGraceMs) {
          this.leave(player.id);
        }
      }
    }
  }

  /** Every person finished, left, or has been disconnected past the grace period. */
  private everyoneDone(race: ActiveRace, now: number): boolean {
    const snapshot = race.session.snapshot();
    return race.humanIds.every((id) => {
      if (race.left.has(id)) return true;
      if (snapshot.runners.find((r) => r.id === id)?.finishTimeMs !== null) return true;
      const player = this.players.get(id);
      if (!player) return true;
      return player.disconnectedAt !== null && now - player.disconnectedAt > ROOM_LIMITS.reconnectGraceMs;
    });
  }

  private finishRace(race: ActiveRace): void {
    const snapshot = race.session.snapshot();
    const results: NetRunnerResult[] = (snapshot.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      position: r.position,
      chosenLevel: r.chosenLevel,
      finished: r.finished,
      finishTimeMs: r.finishTimeMs,
      distance: r.distance,
      correct: r.correct,
      wrong: r.wrong,
      accuracy: r.accuracy,
      correctPerMinute: r.correctPerMinute,
      maxLevel: r.maxLevel,
      presence: this.presence(r.id),
    }));
    for (const player of this.players.values()) {
      if (player.status === 'racing') {
        player.status = 'results';
        this.send(player, { type: 'results', results });
      } else if (player.role === 'teacher') {
        this.send(player, { type: 'results', results });
      } else if (player.status === 'waiting') {
        player.status = 'lobby';
      }
    }
    this.race = null;
    this.broadcastRoom();
  }

  // ---------- messages out ----------

  private racingPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.status === 'racing');
  }

  private presence(runnerId: string): Presence {
    if (!this.race?.humanIds.includes(runnerId)) return 'connected';
    if (this.race.left.has(runnerId)) return 'left';
    const player = this.players.get(runnerId);
    if (!player) return 'left';
    return player.conn ? 'connected' : 'disconnected';
  }

  private publicChallenge(runnerId: string): PublicChallenge | null {
    return this.race?.session.snapshot().runners.find((r) => r.id === runnerId)?.challenge ?? null;
  }

  /** Sends the player's current challenge if they have not received it yet. */
  private syncChallenge(player: Player): void {
    const challenge = this.publicChallenge(player.id);
    const seq = challenge?.seq ?? null;
    if (seq === player.sentChallengeSeq) return;
    player.sentChallengeSeq = seq;
    this.send(player, { type: 'challenge', challenge });
  }

  private sendRaceStart(player: Player): void {
    const race = this.race!;
    this.send(player, {
      type: 'raceStart',
      seed: race.session.race.seed,
      distance: race.session.race.config.distance,
      runners: race.runners,
    });
  }

  private stateMessage(snapshot: RaceSnapshot): ServerMessage {
    const runners: NetRunnerState[] = snapshot.runners.map((r) => ({
      id: r.id,
      distance: r.distance,
      speed: r.speed,
      streak: r.streak,
      nitroActive: r.nitroActive,
      position: r.position,
      level: r.level,
      maxLevel: r.maxLevel,
      correct: r.correct,
      wrong: r.wrong,
      finishTimeMs: r.finishTimeMs,
      presence: this.presence(r.id),
    }));
    return {
      type: 'state',
      phase: snapshot.phase,
      elapsedMs: snapshot.elapsedMs,
      countdownRemainingMs: snapshot.countdownRemainingMs,
      runners,
    };
  }

  private broadcastState(): void {
    if (!this.race) return;
    const snapshot = this.race.session.snapshot();
    const full = this.stateMessage(snapshot);
    if (!this.isClass) {
      for (const player of this.racingPlayers()) this.send(player, full);
      return;
    }
    const teacher = this.teacher();
    if (teacher) this.send(teacher, full);
    for (const player of this.racingPlayers()) this.send(player, this.stateFor(player, snapshot, full));
  }

  /**
   * What one person receives: everyone in a family room or for the teacher; in a class race,
   * a student gets only themselves and the leaders (design D3).
   */
  private stateFor(player: Player, snapshot: RaceSnapshot, full = this.stateMessage(snapshot)): ServerMessage {
    if (!this.isClass || player.role === 'teacher' || full.type !== 'state') return full;
    const runners = full.runners.filter((r) => r.position <= ROOM_LIMITS.classLeaders || r.id === player.id);
    return { ...full, runners };
  }

  private broadcastRoom(): void {
    const message: ServerMessage = {
      type: 'room',
      code: this.code,
      mode: this.mode,
      phase: this.phase,
      hostId: this.hostId,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        connected: p.conn !== null,
        status: p.status,
        role: p.role,
        car: { ...p.car },
      })),
    };
    for (const player of this.players.values()) this.send(player, message);
  }

  private send(player: Player, message: ServerMessage): void {
    player.conn?.send(message);
  }

  private error(player: Player, code: ErrorCode, message: string): void {
    this.send(player, { type: 'error', code, message });
  }
}
