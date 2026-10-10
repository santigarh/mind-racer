/** Helpers to build challenge prompts in usual math notation. */
export const PLUS = '+';
export const MINUS = '−'; // U+2212
export const TIMES = '×';
export const DIVIDE = '÷';
export const SQRT = '√';
export const SQUARED = '²';

export function bin(a: number | string, op: string, b: number | string): string {
  return `${a} ${op} ${b}`;
}

export function paren(expr: string): string {
  return `(${expr})`;
}
