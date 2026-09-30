import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, staticSecurityHeaders } from '@/lib/security-headers';

/**
 * Assets served from this origin that must stay reachable before sign-in.
 * Matched as whole file extensions rather than "contains a dot", which
 * would let any path with a dot in it past the gate.
 */
const PUBLIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|json|txt|xml|webmanifest|woff2?)$/i;

const PUBLIC_PATHS = new Set(['/login']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the login page, backend-facing API routes, and static files.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    PUBLIC_ASSET.test(pathname)
  ) {
    return applySecurity();
  }

  const token = request.cookies.get('qhs_session')?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return applySecurity();
}

/**
 * Attaches the security headers to a response.
 *
 * The CSP is applied per request rather than once in next.config so it
 * reflects the environment's real API origins, but the directives are shared
 * from src/lib/security-headers so the two cannot drift.
 */
function applySecurity() {
  const csp = buildCsp();

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  for (const header of staticSecurityHeaders) {
    response.headers.set(header.key, header.value);
  }
  return response;
}

export const config = {
  // Route handlers under /api are excluded: they handle their own auth
  // (see src/app/api/camera/* which check the session cookie directly).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
