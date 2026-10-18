import { useSyncExternalStore } from 'react';

/** Same breakpoint as the phone layout of the track (Track.module.css). */
const QUERY = '(max-width: 640px)';

function getMedia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

function subscribe(onChange: () => void) {
  const media = getMedia();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

/** True on phone-width screens. */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMedia()?.matches ?? false,
    () => false,
  );
}
