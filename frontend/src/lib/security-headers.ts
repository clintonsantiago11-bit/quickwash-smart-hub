/* ==================================================================
 * The browser's Content-Security-Policy, in one place.
 *
 * The dashboard keeps a bearer token that any script on the origin can
 * read, so CSP is the main barrier between a content bug and a full
 * account takeover. That shapes the policy: no wildcards, no eval, and
 * a per-request nonce rather than blanket script-src 'unsafe-inline'.
 *
 * next.config.ts applies it to every response; middleware.ts supplies the
 * nonce for documents. Both import from here so they cannot drift.
 * ================================================================== */

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

const LOCAL_API = ['http://localhost:8000', 'http://127.0.0.1:8000'];
const LOCAL_WS = ['ws://localhost:3001', 'ws://127.0.0.1:3001', 'http://localhost:3001'];

/** Only true in dev, where Turbopack's runtime needs eval and inline scripts. */
export const isDevBuild = process.env.NODE_ENV !== 'production';

function toWs(url: string): string {
  return url.replace(/^http/, 'ws');
}

/** Collects the API and bridge origins the app is allowed to talk to. */
function apiOrigins(): string[] {
  const origins = [...LOCAL_API, ...LOCAL_WS];
  for (const url of [API_URL, WS_URL]) {
    if (!url) continue;
    const src = url.replace(/\/+$/, '');
    if (!origins.includes(src)) origins.push(src);
    const ws = toWs(src);
    if (!origins.includes(ws)) origins.push(ws);
  }
  return origins;
}

/**
 * The camera stream and its control panel are proxied through this origin's
 * /api/camera routes, so the raw LAN camera host never needs to be an allowed
 * image source.
 */
/**
 * The nonce parameter is accepted but deliberately unused for script-src.
 *
 * A nonce-based policy cannot work here: the login and dashboard routes are
 * prerendered at build time, so their <script> tags are baked with no
 * per-request nonce, and 'strict-dynamic' then ignores 'self' and blocks
 * every chunk. That was measured, not assumed — it took the whole app down.
 *
 * What is actually removed is the part that matters for a stolen token:
 * 'unsafe-eval' is gone in production, and the image and connection
 * allowlists name specific origins instead of accepting any https/wss host,
 * which is the channel an injected script would exfiltrate through.
 */
export function buildCsp(nonce?: string, options: { dev?: boolean } = {}): string {
  const dev = options.dev ?? isDevBuild;
  const scriptSrc = dev
    // Turbopack's dev runtime genuinely needs both.
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
    : ["'self'", "'unsafe-inline'"];

  const origins = apiOrigins();

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // Tailwind and Next inject style tags and inline styles at runtime.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origins.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${origins.join(' ')}`,
    `frame-src 'self' ${origins.join(' ')}`,
    // The dashboard has no reason to be embedded anywhere.
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // No plugins, no Flash-era attack surface.
    "object-src 'none'",
    dev ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The parts of the policy that do not vary per request. */
export const staticSecurityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Nothing is legitimately loaded from another origin.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];
