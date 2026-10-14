import { describe, expect, it } from 'vitest';
import { CAR_BODIES, CAR_PAINTS } from '@mind-racer/protocol';
import { createProfile, type LevelStats } from '../progress/profile';
import { BODIES, PAINTS, bodyInfo, paintInfo } from './catalog';
import { isUnlocked, newlyUnlocked, progressOf, requirementText, type Progress } from './unlocks';

const progress = (extra: Partial<Progress> = {}): Progress => ({
  races: 0,
  wins: 0,
  unlockedLevel: 1,
  bestStreak: 0,
  ...extra,
});
const available = (p: Progress) => [...BODIES, ...PAINTS].filter((i) => isUnlocked(i, p)).map((i) => i.id);
const stats = (races: number, wins: number): LevelStats => ({
  races,
  wins,
  bestTimeMs: null,
  bestCorrectPerMinute: 0,
  bestAccuracy: 0,
});

describe('catálogo del garaje', () => {
  it('tiene un nombre para cada vehículo y pintura del protocolo', () => {
    expect(BODIES.map((b) => b.id)).toEqual([...CAR_BODIES]);
    expect(PAINTS.map((p) => p.id)).toEqual([...CAR_PAINTS]);
  });
});

describe('desbloqueos', () => {
  it('un jugador nuevo solo tiene el clásico y el ámbar (Primer día)', () => {
    expect(available(progress())).toEqual(['classic', 'amber']);
  });

  it('cada condición de las tablas', () => {
    const cases: [Partial<Progress>, string, string][] = [
      [{ races: 3 }, 'motorcycle', 'moto con 3 carreras'],
      [{ wins: 1 }, 'scooter', 'scooter con 1 victoria'],
      [{ unlockedLevel: 4 }, 'truck', 'camión con el nivel 4'],
      [{ bestStreak: 3 }, 'van', 'furgoneta con racha de 3'],
      [{ wins: 10 }, 'tractor', 'tractor con 10 victorias'],
      [{ races: 1 }, 'red', 'rojo con 1 carrera'],
      [{ unlockedLevel: 3 }, 'purple', 'morado con el nivel 3'],
      [{ bestStreak: 1 }, 'green', 'verde con un desafío'],
      [{ races: 5 }, 'blue', 'azul con 5 carreras'],
      [{ wins: 5 }, 'cyan', 'cian con 5 victorias'],
      [{ races: 25 }, 'white', 'blanco con 25 carreras'],
      [{ bestStreak: 7 }, 'gold', 'dorado con racha de 7'],
    ];
    for (const [extra, id, label] of cases) {
      const item = [...BODIES, ...PAINTS].find((i) => i.id === id)!;
      const [key, value] = Object.entries(extra)[0] as [keyof Progress, number];
      expect(isUnlocked(item, progress(extra)), label).toBe(true);
      expect(isUnlocked(item, progress({ [key]: value - 1 })), `${label} (uno menos)`).toBe(false);
    }
  });

  it('la primera victoria desbloquea el scooter (Desbloqueo por victorias)', () => {
    expect(newlyUnlocked(progress({ races: 1 }), progress({ races: 2, wins: 1 }))).toEqual(['Scooter']);
  });

  it('la primera carrera desbloquea la pintura roja (Primera carrera)', () => {
    expect(newlyUnlocked(progress(), progress({ races: 1 }))).toEqual(['Rojo']);
  });

  it('la mejor racha no se pierde aunque la racha actual se corte (Racha perdida)', () => {
    const profile = createProfile('Lucía', 'beginner');
    const p = progressOf(profile, { bestStreak: 3 });
    expect(isUnlocked(bodyInfo('van'), p)).toBe(true);
  });

  it('suma carreras y victorias de todos los niveles (Victorias en distintos niveles)', () => {
    const profile = { ...createProfile('Lucía', 'beginner'), unlockedLevel: 5, stats: { '2': stats(6, 3), '5': stats(4, 2) } };
    const p = progressOf(profile, { bestStreak: 0 });
    expect(p).toEqual({ races: 10, wins: 5, unlockedLevel: 5, bestStreak: 0 });
    expect(isUnlocked(paintInfo('cyan'), p)).toBe(true);
  });

  it('explica cuánto falta para cada uno', () => {
    const p = progress({ races: 1, wins: 1, bestStreak: 2 });
    expect(requirementText(bodyInfo('motorcycle'), p)).toBe('Termina 3 carreras · 1/3');
    expect(requirementText(bodyInfo('tractor'), p)).toBe('Gana 10 carreras · 1/10');
    expect(requirementText(bodyInfo('truck'), p)).toBe('Desbloquea el nivel 4');
    expect(requirementText(bodyInfo('van'), p)).toBe('Racha de 3 días en el desafío · 2/3');
    expect(requirementText(paintInfo('green'), progress())).toBe('Haz el desafío de hoy');
    expect(requirementText(paintInfo('red'), progress({ races: 7 }))).toBe('Termina 1 carrera · 1/1');
    expect(requirementText(bodyInfo('classic'), p)).toBe('Disponible desde el inicio');
  });
});
