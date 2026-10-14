import { useSyncExternalStore } from 'react';
import { DEFAULT_CAR, carSchema, type Car } from '@mind-racer/protocol';
import type { KeyValueStorage } from '../progress/storage';
import { bodyInfo, paintInfo } from './catalog';
import { isUnlocked, type Progress } from './unlocks';

/** The garage choice, kept apart from the profile so the profile needs no migration (design D3). */
export const GARAGE_KEY = 'mind-racer:garage:v1';

export interface GarageStore {
  get(): Car;
  set(car: Car): void;
  subscribe(listener: () => void): () => void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw with blocked site data.
  }
}

/** Saved choice, piece by piece: a valid paint survives a broken vehicle and vice versa. */
function load(storage: KeyValueStorage | null): Car {
  try {
    const raw = storage?.getItem(GARAGE_KEY);
    if (!raw) return DEFAULT_CAR;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || (data as { version?: unknown }).version !== 1) return DEFAULT_CAR;
    const { body, paint } = data as Record<string, unknown>;
    return {
      body: carSchema.shape.body.safeParse(body).data ?? DEFAULT_CAR.body,
      paint: carSchema.shape.paint.safeParse(paint).data ?? DEFAULT_CAR.paint,
    };
  } catch {
    return DEFAULT_CAR;
  }
}

export function createGarageStore(storage: KeyValueStorage | null = defaultStorage()): GarageStore {
  let current = load(storage);
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(car) {
      if (car.body === current.body && car.paint === current.paint) return;
      current = { body: car.body, paint: car.paint };
      try {
        storage?.setItem(GARAGE_KEY, JSON.stringify({ version: 1, ...current }));
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

export const garageStore = createGarageStore();

export function useGarageChoice(store: GarageStore = garageStore): Car {
  return useSyncExternalStore(store.subscribe, store.get);
}

/** The car that actually races: anything not unlocked falls back to the classic amber, piece by piece. */
export function effectiveCar(saved: Car, progress: Progress): Car {
  return {
    body: isUnlocked(bodyInfo(saved.body), progress) ? saved.body : DEFAULT_CAR.body,
    paint: isUnlocked(paintInfo(saved.paint), progress) ? saved.paint : DEFAULT_CAR.paint,
  };
}
