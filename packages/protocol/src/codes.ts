/** Room code alphabet: no 0/O, 1/I/L, so codes read well aloud and on small screens. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Max size of one WebSocket message, in bytes. */
export const MAX_MESSAGE_BYTES = 4096;

/** Trims, removes spaces and upper-cases what the player typed: " k7qf " → "K7QF". */
export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** Random code from `random()` in [0, 1). */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
