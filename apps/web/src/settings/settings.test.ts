import { describe, expect, it, vi } from 'vitest';
import type { KeyValueStorage } from '../progress/storage';
import { SETTINGS_KEY, createSettingsStore } from './settings';

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

describe('preferencias del dispositivo', () => {
  it('tiene el sonido activado por defecto', () => {
    expect(createSettingsStore(memoryStorage()).get()).toEqual({ sound: true });
    expect(createSettingsStore(null).get()).toEqual({ sound: true });
  });

  it('recuerda el silencio al volver a abrir el juego (Preferencia recordada)', () => {
    const storage = memoryStorage();
    createSettingsStore(storage).set({ sound: false });
    expect(JSON.parse(storage.data[SETTINGS_KEY]!)).toEqual({ sound: false });
    expect(createSettingsStore(storage).get()).toEqual({ sound: false });
  });

  it('ignora datos dañados y usa el valor por defecto', () => {
    for (const raw of ['{', 'null', '[]', '{"sound":"no"}', '42']) {
      expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: raw })).get()).toEqual({ sound: true });
    }
  });

  it('funciona con el almacenamiento bloqueado, solo durante la visita', () => {
    const store = createSettingsStore(throwingStorage);
    expect(store.get()).toEqual({ sound: true });
    store.set({ sound: false });
    expect(store.get()).toEqual({ sound: false });
  });

  it('avisa a los suscriptores solo cuando el valor cambia', () => {
    const store = createSettingsStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.get();
    store.set({ sound: true });
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(before);
    store.set({ sound: false });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set({ sound: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
