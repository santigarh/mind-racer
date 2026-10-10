import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/** jsdom has no matchMedia; tests can flip `coarsePointer` to emulate touch screens. */
export const media = { coarsePointer: false };

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes('pointer: coarse') ? media.coarsePointer : false,
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
  localStorage.clear();
  media.coarsePointer = false;
});
