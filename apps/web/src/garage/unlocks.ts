import type { DailyData } from '../daily/daily';
import type { Profile } from '../progress/profile';
import { BODIES, PAINTS, type Requirement } from './catalog';

/** Everything unlocks are measured with; all of it only ever grows, so unlocks are permanent (design D2). */
export interface Progress {
  races: number;
  wins: number;
  unlockedLevel: number;
  bestStreak: number;
}

export function progressOf(profile: Profile, daily: Pick<DailyData, 'bestStreak'>): Progress {
  let races = 0;
  let wins = 0;
  for (const stats of Object.values(profile.stats)) {
    races += stats.races;
    wins += stats.wins;
  }
  return { races, wins, unlockedLevel: profile.unlockedLevel, bestStreak: daily.bestStreak };
}

function current(requirement: Requirement, progress: Progress): number {
  switch (requirement.kind) {
    case 'free':
      return 0;
    case 'races':
      return progress.races;
    case 'wins':
      return progress.wins;
    case 'level':
      return progress.unlockedLevel;
    case 'streak':
      return progress.bestStreak;
  }
}

export function isUnlocked(item: { requirement: Requirement }, progress: Progress): boolean {
  const { requirement } = item;
  return requirement.kind === 'free' || current(requirement, progress) >= requirement.target;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Gana 3 carreras · 1/3"; for levels, just the goal. */
export function requirementText(item: { requirement: Requirement }, progress: Progress): string {
  const { requirement } = item;
  if (requirement.kind === 'free') return 'Disponible desde el inicio';
  const { target } = requirement;
  const done = Math.min(current(requirement, progress), target);
  switch (requirement.kind) {
    case 'races':
      return `Termina ${target} ${plural(target, 'carrera', 'carreras')} · ${done}/${target}`;
    case 'wins':
      return `Gana ${target} ${plural(target, 'carrera', 'carreras')} · ${done}/${target}`;
    case 'level':
      return `Desbloquea el nivel ${target}`;
    case 'streak':
      return target === 1
        ? 'Haz el desafío de hoy'
        : `Racha de ${target} días en el desafío · ${done}/${target}`;
  }
}

/** Names of vehicles and paints unlocked between two moments, vehicles first. */
export function newlyUnlocked(before: Progress, after: Progress): string[] {
  return [...BODIES, ...PAINTS].filter((item) => !isUnlocked(item, before) && isUnlocked(item, after)).map((i) => i.name);
}
