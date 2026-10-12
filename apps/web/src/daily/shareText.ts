import { formatTime, ordinal } from '../ui/format';
import type { DailyResult } from './daily';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "2026-10-11" → "11 oct". Fixed names so the text reads the same on every device. */
export function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${day} ${MONTHS[month! - 1]}`;
}

/** "2026-10-11" → "sáb 11 oct". */
export function longDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${WEEKDAYS[new Date(year!, month! - 1, day!).getDay()]} ${shortDate(dateKey)}`;
}

export function streakText(streak: number): string {
  return `Racha de ${streak} ${streak === 1 ? 'día' : 'días'}`;
}

/** Short result to paste in the family chat (design D6); the game's address goes separately as the URL. */
export function dailyShareText(dateKey: string, result: DailyResult, streak: number): string {
  const answered = result.correct + result.wrong;
  const outcome = result.finished && result.finishTimeMs !== null
    ? `${ordinal(result.position)} · ${formatTime(result.finishTimeMs)}`
    : 'Sin llegar';
  return [
    `Mind Racer · Desafío del ${shortDate(dateKey)} · Nivel ${result.level}`,
    `🏁 ${outcome} · ${result.correct}/${answered}`,
    `🔥 ${streakText(streak)}`,
  ].join('\n');
}
