/** Server settings taken from environment variables (spec server-operations). */
export interface ServerConfig {
  port: number;
  host: string;
  /** null = accept any Origin (development and home network). */
  allowedOrigins: string[] | null;
  /** How many proxies in front of us append to X-Forwarded-For. 0 = use the socket address. */
  trustProxyHops: number;
}

export const DEFAULT_PORT = 8787;

export function readServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    port: toInt(env.PORT, DEFAULT_PORT),
    host: env.HOST?.trim() || '0.0.0.0',
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    trustProxyHops: Math.max(0, toInt(env.TRUST_PROXY_HOPS, 0)),
  };
}

/** "https://a.dev, https://b.dev/" → ["https://a.dev", "https://b.dev"]; empty → null. */
export function parseAllowedOrigins(raw: string | undefined): string[] | null {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : null;
}

function toInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw !== undefined && raw.trim() !== '' && Number.isInteger(value) ? value : fallback;
}
