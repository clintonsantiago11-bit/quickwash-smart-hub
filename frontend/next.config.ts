import type { NextConfig } from "next";

// The dashboard talks to the Laravel API and the Socket.IO bridge. Which
// origins those live on depends on the environment — bake the configured
// URLs into the CSP at build time (dev keeps localhost defaults).
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

const connectSources = [
  "'self'",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "ws://localhost:3001",
  "ws://127.0.0.1:3001",
  "http://localhost:3001",
];

function normalizeSocketSource(url: string): string {
  // http(s)://host -> ws(s)://host so both the HTTP and WS forms are allowed
  return url.replace(/^http/, "ws");
}

for (const url of [API_URL, WS_URL]) {
  if (!url) continue;
  const src = url.replace(/\/+$/, "");
  if (!connectSources.includes(src)) connectSources.push(src);
  const wsSrc = normalizeSocketSource(src);
  if (!connectSources.includes(wsSrc)) connectSources.push(wsSrc);
}

const securityHeaders = [
  // Content-Security-Policy: allow the app's own resources plus the Laravel
  // API and the Socket.IO bridge. 'unsafe-inline'/'unsafe-eval' are required
  // by the Next.js dev runtime; the production build still uses them for
  // Next.js inline scripts.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSources.join(" ")}`,
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
