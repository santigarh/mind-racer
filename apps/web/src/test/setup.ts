import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { DEFAULT_CAR } from '@mind-racer/protocol';
import { garageStore } from '../garage/choice';
import { settingsStore } from '../settings/settings';

/** jsdom has no matchMedia; tests can flip `coarsePointer` (touch screens) and `narrow` (phone width). */
export const media = { coarsePointer: false, narrow: false };

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes('pointer: coarse') ? media.coarsePointer : query.includes('max-width: 640px') ? media.narrow : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })),
});

afterEach(() => {
  cleanup();
  settingsStore.set({ sound: true });
  garageStore.set(DEFAULT_CAR);
  localStorage.clear();
  sessionStorage.clear();
  media.coarsePointer = false;
  media.narrow = false;
});
