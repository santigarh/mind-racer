import type { RunnerResult } from '@mind-racer/engine';
import { formatDecimal, formatPercent, formatTime } from '../ui/format';

const HEADERS = ['Puesto', 'Nombre', 'Nivel', 'Tiempo', 'Aciertos', 'Errores', 'Precisión', 'Correctas por minuto'];
/** Excel in Spanish expects `;` between columns and needs the BOM to read accents as UTF-8 (design D7). */
const SEPARATOR = ';';
const BOM = '﻿';

/** Quotes a cell when it contains the separator, quotes or line breaks. */
function cell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The class standings as CSV: one row per student, in finishing order. */
export function toCsv(results: readonly RunnerResult[]): string {
  const rows = [...results]
    .sort((a, b) => a.position - b.position)
    .map((r) => [
      String(r.position),
      r.name,
      String(r.chosenLevel),
      r.finished && r.finishTimeMs !== null ? formatTime(r.finishTimeMs) : 'sin llegar',
      String(r.correct),
      String(r.wrong),
      formatPercent(r.accuracy),
      formatDecimal(r.correctPerMinute),
    ]);
  return BOM + [HEADERS, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join('\r\n') + '\r\n';
}

/** "mind-racer-K7QF-2026-10-17-1.csv" */
export function csvFileName(code: string, date: Date, raceNumber: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mind-racer-${code}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${raceNumber}.csv`;
}

/** Saves the file from the teacher's browser; nothing is sent anywhere. */
export function downloadCsv(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
