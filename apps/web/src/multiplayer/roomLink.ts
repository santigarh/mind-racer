import { normalizeRoomCode } from '@mind-racer/protocol';

/** Query parameter of the room link: `/?sala=K7QF`. */
export const ROOM_PARAM = 'sala';

/** Link that opens the game straight into this room, on whatever address served the page (design D1). */
export function roomLink(code: string, origin: string = window.location.origin): string {
  return `${origin}/?${ROOM_PARAM}=${code}`;
}

/** Room code from the address, normalized but not validated (Entry shows the usual error); null without one. */
export function readRoomLink(search: string = window.location.search): string | null {
  const raw = new URLSearchParams(search).get(ROOM_PARAM);
  const code = raw === null ? '' : normalizeRoomCode(raw);
  return code === '' ? null : code;
}

/** Removes the room from the address so a reload does not join again. */
export function clearRoomLink(location: Location = window.location, history: History = window.history): void {
  const url = new URL(location.href);
  if (!url.searchParams.has(ROOM_PARAM)) return;
  url.searchParams.delete(ROOM_PARAM);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
