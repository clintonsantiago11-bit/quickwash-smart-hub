import type { NextConfig } from 'next';

/**
 * Deliberately self-contained.
 *
 * This file is loaded by Next's config transpiler, not by the app build, and
 * importing application code from src/ here is not supported reliably — it
 * took the whole deployment down with a 500 on every route. The full
 * per-request policy lives in src/lib/security-headers.ts and is applied by
 * middleware.ts, which runs in the app and imports it normally.
 *
 * These headers are the request-independent subset, repeated here so that
 * responses not passing through middleware (static assets, most notably) are
 * still covered.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
