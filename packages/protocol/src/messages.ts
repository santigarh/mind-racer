import { z } from 'zod';
import { MAX_LEVEL, MIN_LEVEL } from '@mind-racer/engine';
import { MAX_MESSAGE_BYTES, MAX_SERVER_MESSAGE_BYTES, normalizeRoomCode } from './codes';
import { carSchema, sentCarSchema } from './garage';

export const NAME_MAX_LENGTH = 20;
/** Longest answer a player can type (sign + digits). */
const ANSWER_MAX_LENGTH = 12;

// ---------- shared pieces ----------

export const levelSchema = z.number().int().min(MIN_LEVEL).max(MAX_LEVEL);

/** 1–20 characters after trimming and collapsing spaces. */
export const nameSchema = z
  .string()
  .max(80)
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .refine((s) => {
    const length = [...s].length;
    return length >= 1 && length <= NAME_MAX_LENGTH;
  }, `El nombre debe tener entre 1 y ${NAME_MAX_LENGTH} caracteres`);

export const roomCodeSchema = z.string().max(16).transform(normalizeRoomCode);

const runnerKindSchema = z.enum(['human', 'bot']);
const botProfileSchema = z.enum(['tortuga', 'crucero', 'turbo']);
const racePhaseSchema = z.enum(['waiting', 'countdown', 'racing', 'finished']);
/** connected; disconnected (may come back within the grace period); left (abandoned or exited). */
export const presenceSchema = z.enum(['connected', 'disconnected', 'left']);
export type Presence = z.infer<typeof presenceSchema>;

/** A challenge as the client may see it: never the answer, only its length. */
export const publicChallengeSchema = z.strictObject({
  seq: z.number().int(),
  level: levelSchema,
  prompt: z.string(),
  answerLength: z.number().int().min(1),
  issuedAtMs: z.number(),
});

/** A family room (up to 4, bots, everyone races) or a class room (a teacher who does not race, up to 40 students). */
export const roomModeSchema = z.enum(['family', 'class']);
export type RoomMode = z.infer<typeof roomModeSchema>;
export const roleSchema = z.enum(['teacher', 'student']);
export type Role = z.infer<typeof roleSchema>;

// ---------- client → server ----------

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create'),
    name: nameSchema,
    level: levelSchema,
    car: sentCarSchema,
    /** Omitted means a family room. */
    mode: roomModeSchema.optional(),
  }),
  z.object({ type: z.literal('join'), code: roomCodeSchema, name: nameSchema, level: levelSchema, car: sentCarSchema }),
  z.object({ type: z.literal('rejoin'), code: roomCodeSchema, token: z.string().min(1).max(64) }),
  z.object({ type: z.literal('setLevel'), level: levelSchema }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('answer'), seq: z.number().int(), input: z.string().max(ANSWER_MAX_LENGTH) }),
  z.object({ type: z.literal('abandon') }),
  z.object({ type: z.literal('backToRoom') }),
  z.object({ type: z.literal('pong'), id: z.number().int() }),
  z.object({ type: z.literal('leave') }),
  /** Class rooms: the teacher removes a student. */
  z.object({ type: z.literal('kick'), playerId: z.string().min(1).max(32) }),
  /** Class rooms: the teacher ends the class for everyone. */
  z.object({ type: z.literal('closeRoom') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------- server → client ----------

export const playerStatusSchema = z.enum(['lobby', 'racing', 'results', 'waiting']);

export const roomPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: levelSchema,
  connected: z.boolean(),
  status: playerStatusSchema,
  /** Optional so older servers still parse; absent means student. */
  role: roleSchema.optional(),
  /** Optional so older servers still parse; the current server always sends it. */
  car: carSchema.optional(),
});
export type RoomPlayer = z.infer<typeof roomPlayerSchema>;

export const raceRunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: runnerKindSchema,
  chosenLevel: levelSchema,
  botProfile: botProfileSchema.optional(),
  /** People only; bots keep their profile colors. */
  car: carSchema.optional(),
});
export type RaceRunner = z.infer<typeof raceRunnerSchema>;

export const runnerStateSchema = z.object({
  id: z.string(),
  distance: z.number(),
  speed: z.number(),
  streak: z.number().int(),
  nitroActive: z.boolean(),
  position: z.number().int(),
  level: levelSchema,
  maxLevel: levelSchema,
  correct: z.number().int(),
  wrong: z.number().int(),
  finishTimeMs: z.number().nullable(),
  presence: presenceSchema,
});
export type NetRunnerState = z.infer<typeof runnerStateSchema>;

export const runnerResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: runnerKindSchema,
  position: z.number().int(),
  chosenLevel: levelSchema,
  finished: z.boolean(),
  finishTimeMs: z.number().nullable(),
  distance: z.number(),
  correct: z.number().int(),
  wrong: z.number().int(),
  accuracy: z.number(),
  correctPerMinute: z.number(),
  maxLevel: levelSchema,
  presence: presenceSchema,
});
export type NetRunnerResult = z.infer<typeof runnerResultSchema>;

export const answerOutcomeSchema = z.object({
  seq: z.number().int(),
  correct: z.boolean(),
  expected: z.string(),
  given: z.string(),
  nitro: z.boolean(),
  atMs: z.number(),
});

export const errorCodeSchema = z.enum([
  'room-not-found',
  'room-full',
  'too-many-rooms',
  'invalid-message',
  'not-host',
  'not-in-room',
  'rate-limited',
  'rejoin-failed',
  /** The teacher removed this person from the class room. */
  'removed',
  /** The teacher closed the class room. */
  'room-closed',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('joined'), code: z.string(), playerId: z.string(), token: z.string() }),
  z.object({
    type: z.literal('room'),
    code: z.string(),
    /** Optional so older servers still parse; absent means a family room. */
    mode: roomModeSchema.optional(),
    phase: z.enum(['lobby', 'racing']),
    hostId: z.string().nullable(),
    players: z.array(roomPlayerSchema),
  }),
  z.object({
    type: z.literal('raceStart'),
    seed: z.number().int(),
    distance: z.number(),
    runners: z.array(raceRunnerSchema),
    /** 1, 2, 3… since the room opened. Optional so older servers still parse. */
    raceNumber: z.number().int().positive().optional(),
    /** Unix ms when the countdown began. Optional so older servers still parse. */
    startedAt: z.number().optional(),
  }),
  z.object({
    type: z.literal('state'),
    phase: racePhaseSchema,
    elapsedMs: z.number(),
    countdownRemainingMs: z.number(),
    runners: z.array(runnerStateSchema),
  }),
  z.object({ type: z.literal('challenge'), challenge: publicChallengeSchema.nullable() }),
  z.object({ type: z.literal('answer'), outcome: answerOutcomeSchema, challenge: publicChallengeSchema.nullable() }),
  z.object({ type: z.literal('results'), results: z.array(runnerResultSchema) }),
  z.object({ type: z.literal('ping'), id: z.number().int() }),
  z.object({ type: z.literal('error'), code: errorCodeSchema, message: z.string() }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

// ---------- parsing ----------

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

function parseWith<T>(schema: z.ZodType<T>, raw: unknown, maxBytes: number): ParseResult<T> {
  if (typeof raw !== 'string') return { ok: false, error: 'El mensaje debe ser texto' };
  if (byteLength(raw) > maxBytes) return { ok: false, error: 'Mensaje demasiado grande' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }
  const result = schema.safeParse(data);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, error: result.error.issues[0]?.message ?? 'Mensaje inválido' };
}

/** Messages from clients keep a small limit: they reach the server from anyone. */
export const parseClientMessage = (raw: unknown) => parseWith(clientMessageSchema, raw, MAX_MESSAGE_BYTES);
export const parseServerMessage = (raw: unknown) => parseWith(serverMessageSchema, raw, MAX_SERVER_MESSAGE_BYTES);

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/** UTF-8 size without depending on DOM or Node globals. */
function byteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
