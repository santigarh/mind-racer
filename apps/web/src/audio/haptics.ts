/** Short vibration patterns in ms (design D5). Safari on iPhone has no vibration: then it does nothing. */
export type HapticName = 'wrong' | 'nitro' | 'finish';

export const PATTERNS: Record<HapticName, readonly number[]> = {
  wrong: [60],
  nitro: [30, 40, 30],
  finish: [80, 60, 160],
};

export interface Haptics {
  vibrate(name: HapticName): void;
}

export function createHaptics(nav: Partial<Pick<Navigator, 'vibrate'>> | undefined = globalThis.navigator): Haptics {
  return {
    vibrate(name) {
      if (typeof nav?.vibrate !== 'function') return;
      try {
        nav.vibrate([...PATTERNS[name]]);
      } catch {
        // ignore
      }
    },
  };
}

export const haptics = createHaptics();
