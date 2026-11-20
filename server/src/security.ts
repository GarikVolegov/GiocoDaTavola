// Pure security helpers for origin checking, proxy-safe IP extraction,
// prompt/SSML sanitization, and HTTP Content-Security-Policy construction.

function stripControlChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += input[i];
    } else if (code === 9 || code === 10 || code === 13) {
      out += ' ';
    }
  }
  return out;
}

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Resolve allowed browser origins for Socket.IO CORS / WebSocket handshake.
 * Prefers explicit CLIENT_ORIGIN (comma-separated), then Railway production
 * public domain env vars, falling back to '*' only in local dev / test.
 */
export function resolveAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] | '*' {
  if (typeof env.CLIENT_ORIGIN === 'string' && env.CLIENT_ORIGIN.trim().length > 0) {
    const origins = env.CLIENT_ORIGIN.split(',')
      .map((entry) => entry.trim().replace(/\/+$/, ''))
      .filter((entry) => entry.length > 0);
    return origins.length > 0 ? [...new Set(origins)] : '*';
  }

  const railwayCandidates = [env.RAILWAY_PUBLIC_DOMAIN, env.RAILWAY_STATIC_URL]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeOrigin)
    .filter((v) => v.length > 0);

  if (railwayCandidates.length > 0) {
    return [...new Set(railwayCandidates)];
  }

  return '*';
}

/** Check whether an incoming request `Origin` header is permitted. */
export function isOriginAllowed(
  origin: string | undefined,
  allowed: string[] | '*',
): boolean {
  if (allowed === '*' || !origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();
  if (!normalized) return true;
  return allowed.some((entry) => entry.toLowerCase() === normalized);
}

/**
 * Extract client IP safely behind a single trusted reverse proxy (e.g. Railway Hikari).
 * Uses the right-most X-Forwarded-For entry so clients cannot spoof left-most entries.
 */
export function extractClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  trustProxy = true,
): string {
  if (trustProxy && forwardedFor) {
    const flat = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const parts = flat
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return remoteAddress && remoteAddress.trim().length > 0 ? remoteAddress : 'unknown';
}

/** Sanitize user-supplied text before sending it to the neural TTS engine. */
export function sanitizeTtsText(raw: string): string {
  return stripControlChars(raw)
    .replace(/[<>]/g, '')
    .replace(/&/g, ' e ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sanitize user-supplied evening themes before inserting into AI prompts. */
export function sanitizeAiTheme(raw: string, maxLen = 80): string {
  return stripControlChars(raw)
    .replace(/["'`\\<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
}

/** Build the strict Content-Security-Policy header for the Vite SPA + Clerk + Three.js. */
export function buildCspHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://*.clerk.com",
    "media-src 'self' blob: data:",
    "connect-src 'self' wss: ws: https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
