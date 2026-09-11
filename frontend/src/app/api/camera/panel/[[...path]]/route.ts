export const dynamic = 'force-dynamic';

// Proxies the ESP32-CAM control panel (stock CameraWebServer) so it can be
// embedded inside the app without leaving the site. The camera's own HTML
// builds API URLs from `document.location.origin` and the stream from `:81`,
// so we rewrite those to app-relative proxy paths:
//   /status /control /capture /reg /greg /xclk /pll /resolution -> here (port 80)
//   /stream -> /api/camera/stream (our dedicated MJPEG proxy)
const CAMERA_HOST = 'http://192.168.1.7';

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, ctx: RouteContext) {
  // Server-side auth gate: middleware lets /api/* through by design, so the
  // camera proxy must check the session cookie itself. Anyone without a valid
  // session is denied — the live feed is not public.
  const cookies = request.headers.get('cookie') ?? '';
  const hasAuth = /(?:^|;\s*)auth_token=[^;]+/.test(cookies);
  if (!hasAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { path } = await ctx.params;
  const subPath = path && path.length ? '/' + path.join('/') : '/';
  const search = new URL(request.url).search;

  try {
    const upstream = await fetch(`${CAMERA_HOST}${subPath}${search}`, {
      cache: 'no-store',
      headers: { Connection: 'keep-alive' },
    });

    const contentType = upstream.headers.get('content-type') ?? 'text/plain';

    // Rewrite the index page so its JS talks to our proxies instead of the
    // camera host directly.
    if (subPath === '/' && contentType.includes('text/html')) {
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

    // Pass everything else straight through (status JSON, capture JPEGs, control ACKs)
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
