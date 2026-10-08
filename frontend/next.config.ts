import type { NextConfig } from "next";

// The dashboard talks to the Laravel API and the Socket.IO bridge. Which
// origins those live on depends on the environment, so the configured URLs are
// baked into the CSP at build time. Dev keeps its localhost defaults.
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

const isDev = process.env.NODE_ENV !== "production";

/**
 * A configured origin has to be exactly what the browser will compare
 * against, or the allowlist quietly does nothing.
 *
 * A trailing newline in a dashboard env var is the common case, and the old
 * code only stripped trailing slashes. The newline survived, the CSP header
 * carried a literal %0A, and that source never matched a single request.
 * Nothing looked broken because the header also ended in "https: wss:",
 * which allowed everything anyway — so the strict list was dead weight and a
 * wildcard was doing all the work.
 */
function toOrigin(url: string | undefined): string | null {
  if (!url) return null;

  // Trim whitespace first, then trailing slashes. Order matters: a value of
  // "https://host/api\n" has to lose the newline before the slash strip,
  // or the newline is still there afterwards.
  const cleaned = url.trim().replace(/\/+$/, "");
  if (!cleaned) return null;

  try {
    // Validate rather than trust: a malformed value must be dropped, not
    // emitted as a source expression that silently never matches.
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

const LOCAL_SOURCES = [
  "'self'",
  ...(isDev ? ["http://localhost:8000", "http://127.0.0.1:8000", "ws://localhost:3001", "ws://127.0.0.1:3001", "http://localhost:3001"] : []),
];

const configured = [toOrigin(API_URL), toOrigin(WS_URL)].filter((v): v is string => Boolean(v));

/**
 * A WebSocket is matched against connect-src by its ws:// scheme, while
 * Socket.IO polling uses the http:// one. Both forms of each configured
 * origin are needed, or a live feed breaks while the HTTP calls keep working.
 */
function withSocketForm(origins: string[]): string[] {
  const extra = origins
    .filter((o) => o.startsWith("http://") || o.startsWith("https://"))
    .map((o) => o.replace(/^http/, "ws"));
  return [...new Set([...origins, ...extra])];
}

const connectSources = withSocketForm([...LOCAL_SOURCES, ...configured]);

// The camera is proxied through this origin's /api/camera routes, so the raw
// LAN address never needs to be an allowed image source.
const imgSources = [...new Set([...LOCAL_SOURCES, ...configured])];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is still required by Next.js for its own bootstrap
      // scripts. 'unsafe-eval' is not: it is here purely for Turbopack's dev
      // runtime, and leaving it in production turns any injected string into
      // code execution.
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // No bare "https:" wildcard. It is the channel a stolen bearer token
      // would leave through: <img src="https://elsewhere/?t=...">.
      `img-src ${imgSources.join(" ")} data: blob:`,
      "font-src 'self' data:",
      // No bare "https:"/"wss:" either. Every origin the app talks to is
      // named above.
      `connect-src ${connectSources.join(" ")}`,
      // The dashboard has no reason to be embedded anywhere.
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
