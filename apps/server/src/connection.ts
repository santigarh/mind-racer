import type { ServerMessage } from '@mind-racer/protocol';

/** Whatever carries messages to one client. The WebSocket adapter and tests implement it. */
export interface Connection {
  send(message: ServerMessage): void;
}

/** Room timings and limits (design.md D4–D8). */
export const ROOM_LIMITS = Object.freeze({
  capacity: 4,
  /** Students in a class room; the teacher does not count (spec classroom-mode). */
  classCapacity: 40,
  /** Class rooms send race state every this many ticks (50 ms each, so 5 per second). */
  classStateEveryTicks: 4,
  /** Leaders each student receives besides themselves in a class race. */
  classLeaders: 5,
  reconnectGraceMs: 30_000,
  emptyRoomTtlMs: 60_000,
  pingIntervalMs: 2_000,
  maxLatencyDiscountMs: 150,
  rttSmoothing: 0.3,
  answersPerSecond: 20,
  maxRooms: 200,
  /** New rooms one IP may create per window (spec server-operations). */
  roomsPerIp: 5,
  roomsPerIpWindowMs: 10 * 60_000,
});
