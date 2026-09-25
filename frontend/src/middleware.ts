import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side auth guard for the QuickWash Smart Hub.
 *
 * Redirects unauthenticated requests to /login BEFORE any page renders,
 * preventing a flash of the dashboard on a fresh session. This gate is a UX
 * courtesy — the REAL auth is the Sanctum Bearer token (stored in
 * localStorage by src/lib/api.ts and sent on every API call). Auth state for
 * the gate is carried in the `qhs_session` cookie, set by the frontend on its
 * own origin at login (see src/lib/api.ts), so it works regardless of where
 * the API is hosted.
 *
 * Public paths (no auth required): /login, all /api/* routes, and static
 * assets.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the login page, backend-facing API routes, and static files.
  if (
    pathname === '/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('qhs_session')?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Route handlers under /api are excluded: they handle their own auth
  // (see src/app/api/camera/* which check the session cookie directly).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
