import type { RunnerResult } from '@mind-racer/engine';
import type { Presence } from '@mind-racer/protocol';
import { STANDINGS_HEADERS, standingsRows } from './standings';

/** Excel in Spanish expects `;` between columns and needs the BOM to read accents as UTF-8 (design D7). */
const SEPARATOR = ';';
const BOM = '﻿';
/** A spreadsheet reads these first characters as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Prefixes `'` to anything a spreadsheet would run as a formula (names are typed by students),
 * then quotes a cell when it contains the separator, quotes or line breaks.
 */
function cell(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The class standings as CSV: one row per student, in finishing order. */
export function toCsv(
  results: readonly RunnerResult[],
  presence: Readonly<Record<string, Presence>> = {},
  distance = 0,
): string {
  const rows = standingsRows(results, presence, distance).map((r) => r.cells);
  return BOM + [[...STANDINGS_HEADERS], ...rows].map((row) => row.map(cell).join(SEPARATOR)).join('\r\n') + '\r\n';
}

/** "mind-racer-K7QF-2026-10-17-1.csv"; `date` is when the race started, in the teacher's time zone. */
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
