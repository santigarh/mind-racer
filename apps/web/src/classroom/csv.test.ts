import { describe, expect, it, vi } from 'vitest';
import type { RunnerResult } from '@mind-racer/engine';
import { csvFileName, downloadCsv, toCsv } from './csv';

const result = (position: number, extra: Partial<RunnerResult> = {}): RunnerResult => ({
  id: `p${position}`,
  name: `Alumno ${position}`,
  kind: 'human',
  position,
  chosenLevel: 3,
  finished: true,
  finishTimeMs: 42_300,
  distance: 1000,
  correct: 18,
  wrong: 2,
  accuracy: 0.9,
  correctPerMinute: 25.5,
  maxLevel: 4,
  ...extra,
});

/** Data rows of a CSV, without the BOM and the header. */
const dataRows = (csv: string) => csv.slice(1).trimEnd().split('\r\n').slice(1);

describe('CSV de la clasificación', () => {
  it('lleva BOM, separador ; y encabezados en español', () => {
    const csv = toCsv([result(1)]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).trimEnd().split('\r\n');
    expect(header).toBe(
      'Puesto;Nombre;Nivel;Nivel máximo;Tablas;Tiempo;Avance;Estado;Aciertos;Errores;Precisión;Correctas por minuto',
    );
    expect(row).toBe('1;Alumno 1;3;4;—;0:42,3;100 %;Llegó;18;2;90 %;25,5');
  });

  it('marca "Sin llegar", ordena por puesto y protege nombres con ; o comillas', () => {
    const csv = toCsv(
      [result(2, { finished: false, finishTimeMs: null, distance: 400, name: 'Ana; la "rápida"' }), result(1, { name: 'Leo' })],
      {},
      1000,
    );
    const rows = dataRows(csv);
    expect(rows[0]).toMatch(/^1;Leo;/);
    expect(rows[1]).toBe('2;"Ana; la ""rápida""";3;4;—;—;40 %;Sin llegar;18;2;90 %;25,5');
  });

  it('el estado viene de la presencia de cada alumno', () => {
    const csv = toCsv([result(1, { finished: false, finishTimeMs: null })], { p1: 'left' }, 1000);
    expect(dataRows(csv)[0]).toContain(';Se fue;');
  });

  it('un nombre con forma de fórmula se guarda como texto (Nombre con forma de fórmula, Nombre común)', () => {
    const names = ['=1+1', '@SUMA(A1)', '-Ana', '+5', '\tTab', '=A1;B1', 'Ana'];
    const csv = toCsv(names.map((name, i) => result(i + 1, { name })));
    const nameCells = dataRows(csv).map((row) => row.slice(row.indexOf(';') + 1, row.lastIndexOf(';3;4;')));
    expect(nameCells).toEqual(["'=1+1", "'@SUMA(A1)", "'-Ana", "'+5", "'\tTab", `"'=A1;B1"`, 'Ana']);
  });

  it('una carrera de 28 alumnos da 28 filas más el encabezado (Llevarse los resultados)', () => {
    const csv = toCsv(Array.from({ length: 28 }, (_, i) => result(i + 1)));
    expect(csv.slice(1).trimEnd().split('\r\n')).toHaveLength(29);
  });

  it('nombra el archivo con el código, la fecha y el número de carrera', () => {
    expect(csvFileName('K7QF', new Date(2026, 9, 17), 2)).toBe('mind-racer-K7QF-2026-10-17-2.csv');
  });

  it('la fecha es la del inicio de la carrera aunque se descargue al día siguiente (Carrera que cruza la medianoche)', () => {
    const startedAt = new Date(2026, 9, 17, 23, 59, 30).getTime();
    vi.useFakeTimers({ now: new Date(2026, 9, 18, 0, 5) });
    expect(csvFileName('K7QF', new Date(startedAt), 3)).toBe('mind-racer-K7QF-2026-10-17-3.csv');
    vi.useRealTimers();
  });

  it('descarga el archivo desde el navegador, sin enviarlo a ningún lado', () => {
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadCsv('a;b\r\n', 'clase.csv');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull();
    click.mockRestore();
  });
});

describe('CSV de una carrera de tablas', () => {
  it('mismos encabezados que una carrera por niveles (Mismas columnas en todas las carreras)', () => {
    const header = (csv: string) => csv.slice(1).split('\r\n')[0];
    const tablesCsv = toCsv([result(1)], {}, 1000, { tables: [7, 8], divisions: true });
    expect(header(tablesCsv)).toBe(header(toCsv([result(1)])));
    expect(dataRows(tablesCsv)[0]).toBe('1;Alumno 1;—;—;7, 8 + divisiones;0:42,3;100 %;Llegó;18;2;90 %;25,5');
  });
});
