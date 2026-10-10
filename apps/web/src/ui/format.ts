/** "1:02,4" (minutes:seconds,tenths). */
export function formatTime(ms: number): string {
  const safe = Math.max(0, ms);
  const tenths = Math.floor(safe / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')},${tenths % 10}`;
}

/** "2.º" */
export function ordinal(n: number): string {
  return `${n}.º`;
}

/** 0.853 → "85 %" */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** 23.456 → "23,5" */
export function formatDecimal(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

/** m/s → km/h, rounded. */
export function toKmh(metersPerSecond: number): number {
  return Math.round(metersPerSecond * 3.6);
}
