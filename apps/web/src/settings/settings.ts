import { useSyncExternalStore } from 'react';
import type { KeyValueStorage } from '../progress/storage';

/** Device preferences, kept apart from the profile so the profile needs no migration (design D7). */
export interface Settings {
  sound: boolean;
}

export const SETTINGS_KEY = 'mind-racer:settings:v1';
export const DEFAULT_SETTINGS: Settings = Object.freeze({ sound: true });

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): void;
  subscribe(listener: () => void): () => void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw with blocked site data.
  }
}

function load(storage: KeyValueStorage | null): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data: unknown = JSON.parse(raw);
    const sound = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).sound : undefined;
    return typeof sound === 'boolean' ? { sound } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** A tiny external store: the same snapshot object until something changes. */
export function createSettingsStore(storage: KeyValueStorage | null = defaultStorage()): SettingsStore {
  let current = load(storage);
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(patch) {
      const next = { ...current, ...patch };
      if (next.sound === current.sound) return;
      current = next;
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(current));
      } catch {
        // Still applies for this visit.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const settingsStore = createSettingsStore();

export function useSettings(store: SettingsStore = settingsStore): Settings {
  return useSyncExternalStore(store.subscribe, store.get);
}
