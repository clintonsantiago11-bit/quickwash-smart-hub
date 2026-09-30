import type { NextConfig } from 'next';
import { buildCsp, staticSecurityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        // middleware.ts sets the per-request nonce for documents; this covers
        // everything else with the same directives.
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp() },
          ...staticSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
