import { describe, expect, it } from 'vitest';
import { applyRaceResult, createProfile } from './profile';
import { PROFILE_KEY, loadProfile, saveProfile, type KeyValueStorage } from './storage';

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

describe('almacenamiento del perfil', () => {
  it('guarda y recupera el perfil (volver al juego)', () => {
    const storage = memoryStorage();
    const profile = applyRaceResult(createProfile('Santi', 'advanced'), {
      level: 7,
      position: 1,
      finished: true,
      finishTimeMs: 61_234,
      accuracy: 0.9,
      correctPerMinute: 22.5,
    }).profile;
    expect(saveProfile(profile, storage)).toBe(true);
    expect(Object.keys(storage.data)).toEqual([PROFILE_KEY]);
    expect(loadProfile(storage)).toEqual(profile);
  });

  it('sin datos guardados devuelve null', () => {
    expect(loadProfile(memoryStorage())).toBeNull();
  });

  it.each([
    ['JSON roto', '{"version":1,'],
    ['otro tipo', '"hola"'],
    ['versión distinta', JSON.stringify({ version: 2, name: 'A', unlockedLevel: 1, stats: {} })],
    ['nombre vacío', JSON.stringify({ version: 1, name: ' ', unlockedLevel: 1, stats: {} })],
    ['nivel fuera de rango', JSON.stringify({ version: 1, name: 'A', unlockedLevel: 11, stats: {} })],
    [
      'estadísticas inválidas',
      JSON.stringify({ version: 1, name: 'A', unlockedLevel: 2, stats: { '1': { races: -1 } } }),
    ],
  ])('datos dañados (%s) devuelven null', (_, raw) => {
    expect(loadProfile(memoryStorage({ [PROFILE_KEY]: raw }))).toBeNull();
  });

  it('almacenamiento bloqueado no lanza errores', () => {
    expect(loadProfile(throwingStorage)).toBeNull();
    expect(saveProfile(createProfile('A', 'beginner'), throwingStorage)).toBe(false);
    expect(loadProfile(null)).toBeNull();
  });

  it('usa localStorage por defecto', () => {
    const profile = createProfile('Ana', 'beginner');
    saveProfile(profile);
    expect(localStorage.getItem(PROFILE_KEY)).not.toBeNull();
    expect(loadProfile()).toEqual(profile);
  });
});
