import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../progress/storage';
import {
  DAILY_KEY,
  EMPTY_DAILY,
  currentStreak,
  dailySeed,
  daysBetween,
  loadDaily,
  msUntilNextDay,
  recordDaily,
  saveDaily,
  todayKey,
  type DailyData,
  type DailyResult,
} from './daily';

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

const result = (extra: Partial<DailyResult> = {}): DailyResult => ({
  level: 3,
  position: 1,
  finished: true,
  finishTimeMs: 42_300,
  correct: 18,
  wrong: 2,
  ...extra,
});

describe('fecha y semilla del desafío', () => {
  it('usa el día local del dispositivo, no UTC', () => {
    expect(todayKey(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-11');
    expect(todayKey(new Date(2026, 9, 12, 0, 1))).toBe('2026-10-12');
    expect(todayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('la semilla es la misma para el mismo día y nivel, y cambia con cualquiera de los dos', () => {
    expect(dailySeed('2026-10-11', 3)).toBe(dailySeed('2026-10-11', 3));
    expect(dailySeed('2026-10-11', 3)).not.toBe(dailySeed('2026-10-11', 4));
    expect(dailySeed('2026-10-11', 3)).not.toBe(dailySeed('2026-10-12', 3));
  });

  it('cuenta días de calendario, también al cambiar el horario de verano o el año', () => {
    expect(daysBetween('2026-10-10', '2026-10-11')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-10-11', '2026-10-11')).toBe(0);
  });

  it('calcula cuánto falta para la medianoche local', () => {
    expect(msUntilNextDay(new Date(2026, 9, 11, 18, 48))).toBe((5 * 60 + 12) * 60_000);
  });
});

describe('racha de días', () => {
  const withStreak = (lastDate: string, streak: number, bestStreak = streak): DailyData => ({
    ...EMPTY_DAILY,
    streak,
    bestStreak,
    lastDate,
  });

  it('el primer desafío empieza la racha en 1', () => {
    const data = recordDaily(EMPTY_DAILY, '2026-10-11', result());
    expect(data).toMatchObject({ streak: 1, bestStreak: 1, lastDate: '2026-10-11' });
    expect(data.results['2026-10-11']).toEqual(result());
  });

  it('hecho ayer con racha 4, hoy pasa a 5 (Día siguiente)', () => {
    expect(recordDaily(withStreak('2026-10-10', 4), '2026-10-11', result())).toMatchObject({ streak: 5, bestStreak: 5 });
  });

  it('hecho anteayer: la racha vuelve a 1 y se conserva la mejor (Día saltado)', () => {
    const data = recordDaily(withStreak('2026-10-09', 4, 7), '2026-10-11', result());
    expect(data).toMatchObject({ streak: 1, bestStreak: 7 });
  });

  it('la racha sigue viva hoy si se hizo ayer, y se pierde si no (Racha pendiente hoy)', () => {
    expect(currentStreak(withStreak('2026-10-10', 4), '2026-10-11')).toBe(4);
    expect(currentStreak(withStreak('2026-10-11', 5), '2026-10-11')).toBe(5);
    expect(currentStreak(withStreak('2026-10-09', 4), '2026-10-11')).toBe(0);
    expect(currentStreak(EMPTY_DAILY, '2026-10-11')).toBe(0);
  });

  it('cuenta aunque no llegue a la meta, y solo una vez por día', () => {
    const once = recordDaily(withStreak('2026-10-10', 2), '2026-10-11', result({ finished: false, finishTimeMs: null, position: 4 }));
    expect(once.streak).toBe(3);
    expect(recordDaily(once, '2026-10-11', result())).toBe(once);
  });

  it('guarda solo los últimos 30 días', () => {
    let data = EMPTY_DAILY;
    for (let day = 1; day <= 40; day++) {
      data = recordDaily(data, todayKey(new Date(2026, 8, day)), result());
    }
    expect(Object.keys(data.results)).toHaveLength(30);
    expect(data.streak).toBe(40);
  });
});

describe('datos del desafío en el dispositivo', () => {
  it('guarda y recupera la racha y los resultados', () => {
    const storage = memoryStorage();
    const data = recordDaily(EMPTY_DAILY, '2026-10-11', result());
    expect(saveDaily(data, storage)).toBe(true);
    expect(loadDaily(storage)).toEqual(data);
  });

  it('con datos dañados empieza de cero sin tocar el perfil (Datos dañados)', () => {
    const profile = '{"version":1,"name":"Lucía"}';
    for (const raw of ['{', 'null', '[]', '{"version":2}', '{"version":1,"streak":-1,"bestStreak":0,"lastDate":null,"results":{}}',
      '{"version":1,"streak":1,"bestStreak":1,"lastDate":"ayer","results":{}}',
      '{"version":1,"streak":1,"bestStreak":1,"lastDate":"2026-10-11","results":{"2026-10-11":{"level":99}}}']) {
      const storage = memoryStorage({ [DAILY_KEY]: raw, 'mind-racer:profile:v1': profile });
      expect(loadDaily(storage)).toEqual(EMPTY_DAILY);
      expect(storage.data['mind-racer:profile:v1']).toBe(profile);
    }
  });

  it('con el almacenamiento bloqueado no falla', () => {
    expect(loadDaily(throwingStorage)).toEqual(EMPTY_DAILY);
    expect(loadDaily(null)).toEqual(EMPTY_DAILY);
    expect(saveDaily(EMPTY_DAILY, throwingStorage)).toBe(false);
  });
});
