import { NextResponse } from 'next/server';
import { mint, ttlMinutes } from '@/lib/camera-session';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Exchanges a valid Sanctum bearer token for the signed camera session cookie.
 *
 * The token proves identity to Laravel; this route is what turns that proof
 * into the one credential the camera proxy can verify for a request that
 * carries no custom headers (an <iframe> navigation, for instance). It never
 * invents a session: if Laravel will not vouch for the token, no cookie is
 * issued.
 *
 * Called by src/lib/api.ts immediately after a successful login and again on
 * a 401, so an operator whose cookie has expired gets a fresh one without
 * retyping anything.
 */

export async function POST(request: Request) {
  if (!process.env.CAMERA_SESSION_SECRET) {
    // Fail closed and say so. Falling back to an unsigned cookie here would
    // reintroduce exactly the bypass this replaces.
    console.error('POST /api/session: CAMERA_SESSION_SECRET is not set');
    return NextResponse.json(
      { error: 'Session cookies are not configured on this deployment.' },
      { status: 503 }
    );
  }

  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = auth.slice('Bearer '.length).trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // "Keep me signed in" governs this cookie too. It used to be handled in the
  // browser; now that the cookie is HttpOnly the server owns the decision, and
  // if it ignored this then an operator who did NOT tick the box would leave a
  // live camera cookie behind on a shared terminal for the full 8 hours.
  let persistent = true;
  try {
    const body = await request.json();
    if (typeof body?.persistent === 'boolean') persistent = body.persistent;
  } catch {
    /* no body: fall back to a persistent cookie */
  }

  // Ask Laravel who this token belongs to. This is the only authority.
  let user: { id?: unknown; role?: unknown };
  try {
    const res = await fetch(`${API_BASE}/auth/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!res.ok) {
      // The API is down or slow. Say so as a 503 rather than 401, so the
      // dashboard does not treat a backend outage as a rejected password and
      // wipe the operator's session.
      return NextResponse.json({ error: 'Could not verify the session.' }, { status: 503 });
    }

    user = await res.json();
  } catch {
    return NextResponse.json({ error: 'Could not verify the session.' }, { status: 503 });
  }

  if (typeof user?.id !== 'number') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const minutes = ttlMinutes();
  const value = mint({ uid: user.id, role: typeof user.role === 'string' ? user.role : 'technician' });

  const res = NextResponse.json({ ok: true, expires_in: minutes * 60, persistent });
  res.cookies.set('qhs_session', value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Omitted when the operator did not ask to stay signed in, which makes it
    // a browser-session cookie: closing the browser ends camera access, which
    // is the safe default on a shared terminal.
    ...(persistent ? { maxAge: minutes * 60 } : {}),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('qhs_session', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}