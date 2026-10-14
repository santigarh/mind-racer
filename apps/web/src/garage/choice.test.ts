import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAR } from '@mind-racer/protocol';
import type { KeyValueStorage } from '../progress/storage';
import { GARAGE_KEY, createGarageStore, effectiveCar } from './choice';
import type { Progress } from './unlocks';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const lots: Progress = { races: 50, wins: 20, unlockedLevel: 10, bestStreak: 10 };
const none: Progress = { races: 0, wins: 0, unlockedLevel: 1, bestStreak: 0 };

describe('elección del garaje', () => {
  it('sin elección guardada usa el clásico ámbar', () => {
    expect(createGarageStore(memoryStorage()).get()).toEqual(DEFAULT_CAR);
  });

  it('recuerda la elección al volver a abrir el juego (Volver a abrir el juego)', () => {
    const storage = memoryStorage();
    createGarageStore(storage).set({ body: 'motorcycle', paint: 'blue' });
    expect(JSON.parse(storage.data[GARAGE_KEY]!)).toEqual({ version: 1, body: 'motorcycle', paint: 'blue' });
    expect(createGarageStore(storage).get()).toEqual({ body: 'motorcycle', paint: 'blue' });
  });

  it('un vehículo que no existe vuelve al clásico, pieza por pieza (Elección inválida)', () => {
    const storage = memoryStorage({ [GARAGE_KEY]: JSON.stringify({ version: 1, body: 'nave', paint: 'red' }) });
    expect(createGarageStore(storage).get()).toEqual({ body: 'classic', paint: 'red' });
  });

  it('con datos dañados usa el clásico ámbar', () => {
    for (const raw of ['{', 'null', '[]', '{"version":2,"body":"truck","paint":"red"}', '"truck"']) {
      expect(createGarageStore(memoryStorage({ [GARAGE_KEY]: raw })).get()).toEqual(DEFAULT_CAR);
    }
  });

  it('con el almacenamiento bloqueado funciona solo durante la visita', () => {
    const store = createGarageStore(throwingStorage);
    expect(store.get()).toEqual(DEFAULT_CAR);
    store.set({ body: 'truck', paint: 'gold' });
    expect(store.get()).toEqual({ body: 'truck', paint: 'gold' });
  });

  it('avisa a los suscriptores solo cuando cambia', () => {
    const store = createGarageStore(null);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(DEFAULT_CAR);
    expect(listener).not.toHaveBeenCalled();
    store.set({ body: 'van', paint: 'amber' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('lo que no está desbloqueado no corre: vuelve al clásico ámbar pieza por pieza', () => {
    expect(effectiveCar({ body: 'tractor', paint: 'gold' }, lots)).toEqual({ body: 'tractor', paint: 'gold' });
    expect(effectiveCar({ body: 'tractor', paint: 'gold' }, none)).toEqual(DEFAULT_CAR);
    expect(effectiveCar({ body: 'tractor', paint: 'red' }, { ...none, races: 1 })).toEqual({ body: 'classic', paint: 'red' });
  });
});
