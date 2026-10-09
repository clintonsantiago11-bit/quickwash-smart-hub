export const dynamic = 'force-dynamic';

// Vercel terminates a function after its max duration, and that cap includes
// time spent streaming a response. 300s is the Hobby ceiling, so the value is
// set explicitly to make the cap deliberate rather than implicit.
export const maxDuration = 300;

// Proxies the ESP32-CAM control panel (the stock CameraWebServer app) so it can
// be embedded inside this site without leaving the origin. The camera's own
// HTML builds its API URLs from `document.location.origin` and the stream from
// `:81`, so those are rewritten to app-relative proxy paths:
//
//   /  /status /capture  -> here, on CAMERA_HOST (port 80)
//   /stream               -> /api/camera/stream (the dedicated MJPEG proxy)
//
// CAMERA_HOST is normally a LAN address the cloud cannot route to, which is
// why a cloud deployment shows the camera as offline. It can also be pointed at
// a tunnel, so this proxy must not assume it is talking to something harmless.

import { verify, readCookie } from '@/lib/camera-session';

const CAMERA_HOST = process.env.CAMERA_HOST || 'http://192.168.1.7';

/**
 * Which camera endpoints may be proxied.
 *
 * This is the important control. The ESP32-CAM has no authentication of its
 * own - app_httpd.cpp registers every route as HTTP_GET and defines no auth
 * handler - so anything allowed here is available to anyone who can reach
 * this page. That includes /reg and /greg, which read and WRITE sensor
 * registers and can leave the sensor in a state it never recovers from
 * without a power cycle. Those are debugging endpoints and are never allowed.
 *
 * Read-only is the default. The write-ish controls are gated behind an
 * explicit opt-in because they are not needed to watch a carwash, and an
 * operator reconfiguring a camera over the internet is a far worse outcome
 * than an operator who cannot find the brightness slider.
 */
const ALWAYS_ALLOWED = new Set(['/', '/status', '/capture']);

const OPT_IN_ALLOWED = new Set(['/control', '/resolution']);

function writeAllowed(): boolean {
  return process.env.CAMERA_PANEL_ALLOW_WRITE === 'true';
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, ctx: RouteContext) {
  const session = verify(readCookie(request, 'qhs_session'));
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { path } = await ctx.params;
  const subPath = path && path.length ? '/' + path.join('/') : '/';
  const search = new URL(request.url).search;

  // Match on the path alone so query strings cannot smuggle a route past the
  // check. `/status` and `/reg?x=` are different requests.
  const route = subPath.split('?')[0];

  const allowed = ALWAYS_ALLOWED.has(route) || (writeAllowed() && OPT_IN_ALLOWED.has(route));
  if (!allowed) {
    // 403, not 404: this is a deliberate policy, and a clear status is more
    // honest to whoever is debugging than pretending the endpoint is missing.
    return new Response(
      `Camera endpoint "${route}" is not proxied. /reg, /greg, /xclk and /pll write sensor state and are never proxied.`,
      { status: 403 }
    );
  }

  try {
    const upstream = await fetch(`${CAMERA_HOST}${subPath}${search}`, {
      cache: 'no-store',
      headers: { Connection: 'keep-alive' },
    });

    const contentType = upstream.headers.get('content-type') ?? 'text/plain';

    // Rewrite the index page so its JS talks to our proxies instead of the
    // camera host directly. Both literals are present verbatim in every
    // variant the stock sketch ships (ov2640/ov3660/ov5640), so these
    // replacements do match - but they are exact string replacements, so if the
    // camera firmware changes them the page still loads and its buttons
    // simply stop working. That failure is quiet, so it is worth stating.
    if (route === '/' && contentType.includes('text/html')) {
      const html = await upstream.text();
      const rewritten = html
        .replace(
          'var baseHost = document.location.origin',
          "var baseHost = '/api/camera/panel'"
        )
        .replace(
          "var streamUrl = baseHost + ':81'",
          "var streamUrl = '/api/camera'"
        );
      return new Response(rewritten, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    // Pass everything else straight through (status JSON, capture JPEGs).
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch {
    return new Response('Camera control panel unreachable. Check that the ESP32-CAM is powered on.', {
      status: 504,
    });
  }
}