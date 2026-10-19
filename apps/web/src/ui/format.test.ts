import { describe, expect, it } from 'vitest';
import { formatTables, tablesTitle } from './format';

describe('textos de una práctica de tablas', () => {
  it('columna y lobby de la profesora', () => {
    expect(formatTables({ tables: [7], divisions: false })).toBe('7');
    expect(formatTables({ tables: [7, 8], divisions: true })).toBe('7, 8 + divisiones');
  });

  it('títulos y lobby del alumno', () => {
    expect(tablesTitle({ tables: [9], divisions: false })).toBe('Tabla del 9');
    expect(tablesTitle({ tables: [7, 8], divisions: false })).toBe('Tablas del 7 y del 8');
    expect(tablesTitle({ tables: [6, 7, 8], divisions: false })).toBe('Tablas del 6, del 7 y del 8');
    expect(tablesTitle({ tables: [7], divisions: true })).toBe('Tabla del 7 con divisiones');
  });
});
