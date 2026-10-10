import { describe, expect, it } from 'vitest';
import { applyRaceResult, createProfile, isLevelUnlocked, normalizeName, type RaceOutcome } from './profile';

const outcome = (overrides: Partial<RaceOutcome> = {}): RaceOutcome => ({
  level: 3,
  position: 1,
  finished: true,
  finishTimeMs: 60_000,
  accuracy: 0.85,
  correctPerMinute: 20,
  ...overrides,
});

describe('primer ingreso', () => {
  it('valida nombres de 1 a 20 caracteres', () => {
    expect(normalizeName('  Santi  ')).toBe('Santi');
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('a'.repeat(20))).toHaveLength(20);
    expect(normalizeName('a'.repeat(21))).toBeNull();
    expect(() => createProfile('', 'beginner')).toThrow();
  });

  it.each([
    ['beginner', 1],
    ['intermediate', 4],
    ['advanced', 7],
  ] as const)('punto de partida %s desbloquea hasta el nivel %i', (start, level) => {
    const profile = createProfile('Ana', start);
    expect(profile.unlockedLevel).toBe(level);
    expect(isLevelUnlocked(profile, level)).toBe(true);
    expect(isLevelUnlocked(profile, level + 1)).toBe(false);
    expect(isLevelUnlocked(profile, 1)).toBe(true);
  });
});

describe('desbloqueo de niveles', () => {
  const base = { ...createProfile('Ana', 'beginner'), unlockedLevel: 3 };

  it('1.º en su nivel máximo con ≥ 80 % desbloquea el siguiente', () => {
    const update = applyRaceResult(base, outcome());
    expect(update.unlockedLevel).toBe(4);
    expect(update.profile.unlockedLevel).toBe(4);
  });

  it('2.º lugar también desbloquea', () => {
    expect(applyRaceResult(base, outcome({ position: 2 })).unlockedLevel).toBe(4);
  });

  it('3.º lugar no desbloquea', () => {
    expect(applyRaceResult(base, outcome({ position: 3 })).unlockedLevel).toBeNull();
  });

  it('precisión de 70 % no desbloquea', () => {
    const update = applyRaceResult(base, outcome({ accuracy: 0.7 }));
    expect(update.unlockedLevel).toBeNull();
    expect(update.profile.unlockedLevel).toBe(3);
  });

  it('exactamente 80 % sí desbloquea', () => {
    expect(applyRaceResult(base, outcome({ accuracy: 0.8 })).unlockedLevel).toBe(4);
  });

  it('ganar en un nivel inferior al máximo no desbloquea', () => {
    expect(applyRaceResult(base, outcome({ level: 2 })).unlockedLevel).toBeNull();
  });

  it('no pasa del nivel 10', () => {
    const top = { ...base, unlockedLevel: 10 };
    const update = applyRaceResult(top, outcome({ level: 10 }));
    expect(update.unlockedLevel).toBeNull();
    expect(update.profile.unlockedLevel).toBe(10);
  });
});

describe('mejores marcas por nivel', () => {
  const profile = createProfile('Ana', 'intermediate');

  it('cuenta carreras y victorias', () => {
    let p = applyRaceResult(profile, outcome({ level: 2, position: 1 })).profile;
    p = applyRaceResult(p, outcome({ level: 2, position: 3 })).profile;
    expect(p.stats['2']).toMatchObject({ races: 2, wins: 1 });
  });

  it('un tiempo menor es nuevo récord; uno mayor no', () => {
    const first = applyRaceResult(profile, outcome({ finishTimeMs: 70_000 }));
    expect(first.records.time).toBe(true);
    const better = applyRaceResult(first.profile, outcome({ finishTimeMs: 65_000 }));
    expect(better.records.time).toBe(true);
    expect(better.profile.stats['3']!.bestTimeMs).toBe(65_000);
    const worse = applyRaceResult(better.profile, outcome({ finishTimeMs: 66_000 }));
    expect(worse.records.time).toBe(false);
    expect(worse.profile.stats['3']!.bestTimeMs).toBe(65_000);
  });

  it('sin llegar a la meta no hay mejor tiempo', () => {
    const update = applyRaceResult(profile, outcome({ finished: false, finishTimeMs: null }));
    expect(update.records.time).toBe(false);
    expect(update.profile.stats['3']!.bestTimeMs).toBeNull();
  });

  it('guarda mejores correctas por minuto y precisión', () => {
    let p = applyRaceResult(profile, outcome({ correctPerMinute: 18, accuracy: 0.9 })).profile;
    const update = applyRaceResult(p, outcome({ correctPerMinute: 25, accuracy: 0.8 }));
    p = update.profile;
    expect(update.records).toMatchObject({ correctPerMinute: true, accuracy: false });
    expect(p.stats['3']).toMatchObject({ bestCorrectPerMinute: 25, bestAccuracy: 0.9 });
  });

  it('no muta el perfil original', () => {
    const snapshot = structuredClone(profile);
    applyRaceResult(profile, outcome());
    expect(profile).toEqual(snapshot);
  });
});
