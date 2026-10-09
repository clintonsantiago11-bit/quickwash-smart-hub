import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side auth guard for the QuickWash Smart Hub.
 *
 * Named proxy, not middleware: Next 16 renamed the convention (the "middleware"
 * file convention is deprecated) and the exported function must match the file.
 *
 * Redirects unauthenticated requests to /login BEFORE any page renders,
 * preventing a flash of the dashboard on a fresh session. This gate is a UX
 * courtesy — the REAL auth is the Sanctum Bearer token (stored in
 * localStorage by src/lib/api.ts and sent on every API call). Auth state for
 * the gate is carried in the `qhs_session` cookie, which is minted server-side
 * by POST /api/session once Laravel has vouched for the bearer token.
 *
 * What is checked here is the cookie's SHAPE only: version tag, three
 * dot-separated parts, and a payload that parses. A forged `qhs_session=1`
 * no longer gets past this line, which is what this gate is for.
 *
 * What is NOT checked here is the signature. This file runs on the Edge
 * runtime, which has no `node:crypto`, so HMAC-SHA256 verification would have
 * to be reimplemented against Web Crypto — duplicated logic in a second
 * runtime, for a gate that is not the boundary. The routes that do protect
 * something (the camera proxy) verify the signature properly, in
 * src/lib/camera-session.ts, on the Node runtime. Read a "pass" here as
 * "render the shell", never as "this visitor is authenticated".
 *
 * Public paths (no auth required): /login, all /api/* routes, and static
 * assets.
 */
/**
 * Assets served from this origin that must stay reachable before sign-in.
 * Matched as whole file extensions rather than "contains a dot", which
 * would let any path with a dot in it past the gate.
 */
const PUBLIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|json|txt|xml|webmanifest|woff2?)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the login page, backend-facing API routes, and static files.
  if (
    pathname === '/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    PUBLIC_ASSET.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (!hasSessionShape(request.cookies.get('qhs_session')?.value)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Structural check on the signed session cookie. See the note above for why
 * this deliberately stops short of verifying the signature.
 */
function hasSessionShape(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  if (!parts[1] || !parts[2]) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.uid === 'number' && typeof payload?.exp === 'number';
  } catch {
    return false;
  }
}

export const config = {
  // Route handlers under /api are excluded: they handle their own auth.
  // src/app/api/camera/* verifies the signed cookie; src/app/api/session mints
  // and revokes it.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
