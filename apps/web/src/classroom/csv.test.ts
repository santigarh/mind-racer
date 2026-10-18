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

describe('CSV de la clasificación', () => {
  it('lleva BOM, separador ; y encabezados en español', () => {
    const csv = toCsv([result(1)]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).trimEnd().split('\r\n');
    expect(header).toBe('Puesto;Nombre;Nivel;Tiempo;Aciertos;Errores;Precisión;Correctas por minuto');
    expect(row).toBe('1;Alumno 1;3;0:42,3;18;2;90 %;25,5');
  });

  it('marca "sin llegar", ordena por puesto y protege nombres con ; o comillas', () => {
    const csv = toCsv([
      result(2, { finished: false, finishTimeMs: null, name: 'Ana; la "rápida"' }),
      result(1, { name: 'Leo' }),
    ]);
    const rows = csv.slice(1).trimEnd().split('\r\n').slice(1);
    expect(rows[0]).toMatch(/^1;Leo;/);
    expect(rows[1]).toBe('2;"Ana; la ""rápida""";3;sin llegar;18;2;90 %;25,5');
  });

  it('una carrera de 28 alumnos da 28 filas más el encabezado (Llevarse los resultados)', () => {
    const csv = toCsv(Array.from({ length: 28 }, (_, i) => result(i + 1)));
    expect(csv.slice(1).trimEnd().split('\r\n')).toHaveLength(29);
  });

  it('nombra el archivo con el código, la fecha y el número de carrera', () => {
    expect(csvFileName('K7QF', new Date(2026, 9, 17), 2)).toBe('mind-racer-K7QF-2026-10-17-2.csv');
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
