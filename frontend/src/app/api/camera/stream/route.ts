export const dynamic = 'force-dynamic';

// Proxies the ESP32-CAM MJPEG stream so the browser only ever talks to
// localhost. This avoids CORS / Brave Shields / Private Network Access
// restrictions when embedding http://<camera-ip>:81/stream directly.
const CAMERA_STREAM_URL = 'http://192.168.1.7:81/stream';

type ActiveStream = {
  abort: () => void;
  lastActivity: number;
};

// The ESP32-CAM stream server serves only ONE client at a time (extra
// connections are accepted but never receive data -> "blank" players).
// Track live proxied connections; extra requests fail fast (503) instead.
const activeStreams = new Set<ActiveStream>();

// Reap connections that stopped producing data. When the client vanishes
// without a clean cancel (e.g. client-side navigation between pages), the
// stream stalls but the camera slot would stay held forever. Healthy streams
// push frames continuously, so anything idle for >12s is dead.
const REAP_INTERVAL_MS = 5000;
const IDLE_LIMIT_MS = 12000;
const reaper = setInterval(() => {
  const now = Date.now();
  for (const conn of activeStreams) {
    if (now - conn.lastActivity > IDLE_LIMIT_MS) {
      activeStreams.delete(conn);
      conn.abort();
    }
  }
}, REAP_INTERVAL_MS);
// Don't keep the dev server alive just for the reaper.
if (typeof reaper.unref === 'function') reaper.unref();

export async function GET(request: Request) {
  // Server-side auth gate (see panel route): the camera feed is private.
  const cookies = request.headers.get('cookie') ?? '';
  const hasAuth = /(?:^|;\s*)auth_token=[^;]+/.test(cookies);
  if (!hasAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (activeStreams.size >= 1) {
    return new Response('Another stream client is active. Close it first.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Abort upstream when the browser disconnects (expand/refresh/navigate) or
  // when the camera accepts TCP but never sends headers within 8s.
  const upstreamAbort = new AbortController();
  const onClientDisconnect = () => upstreamAbort.abort();
  request.signal.addEventListener('abort', onClientDisconnect);
  const headerTimeout = setTimeout(() => upstreamAbort.abort(), 8000);

  const conn: ActiveStream = {
    abort: () => upstreamAbort.abort(),
    lastActivity: Date.now(),
  };
  activeStreams.add(conn);

  try {
    const upstream = await fetch(CAMERA_STREAM_URL, {
      cache: 'no-store',
      signal: upstreamAbort.signal,
      headers: { Connection: 'keep-alive' },
    });
    clearTimeout(headerTimeout);

    if (!upstream.body) {
      activeStreams.delete(conn);
      return new Response(`Camera stream upstream error: ${upstream.status}`, { status: 502 });
    }

    const reader = upstream.body.getReader();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeStreams.delete(conn);
      clearTimeout(headerTimeout);
      request.signal.removeEventListener('abort', onClientDisconnect);
      reader.cancel().catch(() => {});
    };

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          conn.lastActivity = Date.now();
          if (done) {
            release();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch {
          // Upstream failed or client disconnect aborted the fetch
          release();
          try {
            controller.close();
          } catch {
            /* controller already closed */
          }
        }
      },
      cancel() {
        // Browser dropped the response (img removed, page refresh, tab close):
        // release the camera's single stream slot immediately.
        release();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'keep-alive',
      },
    });
  } catch {
    activeStreams.delete(conn);
    clearTimeout(headerTimeout);
    return new Response('Camera stream unreachable. Check that the ESP32-CAM is powered on and connected.', {
      status: 504,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
