import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed session cookie for the camera proxy routes.
 *
 * Why a cookie at all, when the dashboard authenticates to the Laravel API
 * with a Sanctum bearer token? Because two of the three camera consumers
 * cannot set an Authorization header:
 *
 *   1. <iframe src="/api/camera/panel">  (app/cameras/page.tsx) - an iframe
 *      navigation carries no custom headers, only cookies.
 *   2. MjpegPlayer fetches the stream, but browsers attach cookies to a
 *      same-origin fetch by default, so the cookie arrives without the
 *      caller doing anything.
 *   3. The camera status probe is an ordinary same-origin fetch.
 *
 * The cookie used to be `qhs_session=1` - a literal "1", written by the
 * browser and checked with a regex that only asked whether a cookie of that
 * name existed. Anyone could set it and read the camera. That was acceptable
 * while the camera sat on an unreachable LAN address. It is not acceptable
 * once CAMERA_HOST points at something reachable from the internet, because
 * then the ESP32-CAM has no authentication of its own (app_httpd.cpp
 * registers every route, including /reg, as HTTP_GET with no auth handler) and
 * this cookie becomes the only thing standing in front of it.
 *
 * So the value is signed here, by the server, with a secret that never
 * reaches the browser. The client cannot forge or extend it.
 *
 * Format: v1.<base64url(payload)>.<base64url(hmac-sha256)>
 *
 * Tradeoff worth stating: this is stateless, so revoking the underlying
 * Sanctum token does NOT revoke the cookie until its own exp passes. The
 * expiry is therefore kept in step with SANCTUM_TOKEN_EXPIRATION rather than
 * made long, and the camera routes additionally honour it strictly.
 */

const VERSION = 'v1';

/** Fallback TTL mirrors the backend's 8h Sanctum token lifetime. */
const DEFAULT_TTL_MINUTES = 480;

export type CameraSession = {
  /** users.id */
  uid: number;
  role: string;
  /** unix seconds */
  exp: number;
};

function secret(): string | null {
  const raw = process.env.CAMERA_SESSION_SECRET;
  if (!raw || raw.trim() === '') return null;
  return raw;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  const key = secret();
  if (!key) {
    throw new Error('CAMERA_SESSION_SECRET is not set');
  }
  return createHmac('sha256', key).update(`${VERSION}.${payloadB64}`).digest('base64url');
}

export function ttlMinutes(): number {
  const raw = Number(process.env.CAMERA_SESSION_TTL_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MINUTES;
}

/** Build the cookie value for a freshly authenticated user. */
export function mint(session: Omit<CameraSession, 'exp'>, ttl = ttlMinutes()): string {
  const payload: CameraSession = {
    uid: session.uid,
    role: session.role,
    exp: Math.floor(Date.now() / 1000) + ttl * 60,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${VERSION}.${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify and decode. Returns null for anything that is not a valid,
 * unexpired, correctly signed cookie. Never throws.
 */
export function verify(value: string | undefined): CameraSession | null {
  if (!value) return null;
  if (!secret()) {
    // Fail closed rather than fall back to accepting unsigned cookies: a
    // misconfigured deployment must not serve the camera to the world.
    console.error('camera session: CAMERA_SESSION_SECRET is not set, refusing');
    return null;
  }

  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return null;

  const [, payloadB64, provided] = parts;
  if (!payloadB64 || !provided) return null;

  let expected: string;
  try {
    expected = sign(payloadB64);
  } catch {
    return null;
  }

  // Constant-time compare so a wrong signature cannot be discovered by
  // timing the response, the same reason the ingest key uses hash_equals().
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: CameraSession;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload?.uid !== 'number' || typeof payload?.exp !== 'number') return null;
  if (payload.exp * 1000 <= Date.now()) return null;

  return payload;
}

/** Pull the cookie out of a Request's Cookie header without a parser dep. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`)
  );
  return match?.[1];
}