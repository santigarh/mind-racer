import type { RunnerResult, TablesSelection } from '@mind-racer/engine';
import type { Presence } from '@mind-racer/protocol';
import { formatDecimal, formatPercent, formatTables, formatTime } from '../ui/format';

/** Columns of the class standings, on the board and in the CSV (spec classroom-mode, design D4). */
export const STANDINGS_HEADERS = [
  'Puesto',
  'Nombre',
  'Nivel',
  'Nivel máximo',
  'Tablas',
  'Tiempo',
  'Avance',
  'Estado',
  'Aciertos',
  'Errores',
  'Precisión',
  'Correctas por minuto',
] as const;

export interface StandingsRow {
  id: string;
  cells: string[];
}

function status(r: RunnerResult, presence: Presence | undefined): string {
  if (r.finished) return 'Llegó';
  if (presence === 'left') return 'Se fue';
  if (presence === 'disconnected') return 'Desconectado';
  return 'Sin llegar';
}

/**
 * One row per student, in finishing order, with every cell already in Spanish. In a tables race the
 * levels are "—" (they are a fixed pace, not a choice) and "Tablas" says what was practiced.
 */
export function standingsRows(
  results: readonly RunnerResult[],
  presence: Readonly<Record<string, Presence>>,
  distance: number,
  tables: TablesSelection | null = null,
): StandingsRow[] {
  return [...results]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      cells: [
        String(r.position),
        r.name,
        tables ? '—' : String(r.chosenLevel),
        tables ? '—' : String(r.maxLevel),
        tables ? formatTables(tables) : '—',
        r.finished && r.finishTimeMs !== null ? formatTime(r.finishTimeMs) : '—',
        formatPercent(r.finished || distance <= 0 ? 1 : Math.min(1, r.distance / distance)),
        status(r, presence[r.id]),
        String(r.correct),
        String(r.wrong),
        r.correct + r.wrong === 0 ? 'sin respuestas' : formatPercent(r.accuracy),
        formatDecimal(r.correctPerMinute),
      ],
    }));
}
