/** True when `origin` may open a WebSocket. With no allow-list, every origin is accepted. */
export function isOriginAllowed(origin: string | undefined, allowed: readonly string[] | null): boolean {
  if (allowed === null) return true;
  if (!origin) return false;
  return allowed.includes(origin.replace(/\/+$/, ''));
}

/**
 * Client IP for rate limits. Behind `hops` trusted proxies, each one appends to
 * X-Forwarded-For, so the client is the hops-th entry counted from the right;
 * entries further left were written by the client and cannot be trusted.
 */
export function clientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  hops: number,
): string {
  const fallback = normalizeIp(remoteAddress ?? 'unknown');
  if (hops <= 0 || !forwardedFor) return fallback;
  const entries = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const entry = entries[entries.length - hops];
  return entry ? normalizeIp(entry) : fallback;
}

/** "::ffff:10.0.0.1" → "10.0.0.1". */
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}
