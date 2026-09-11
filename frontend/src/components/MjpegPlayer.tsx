"use client";

import { useEffect, useRef, useState } from 'react';

type MjpegPlayerProps = {
  src: string;
  alt: string;
  className?: string;
  onConnected?: () => void;
  onFailed?: () => void;
  maxRetries?: number;
};

// Find the first index of a 2-byte marker starting at `from`, or -1.
function findMarker(buf: Uint8Array, from: number, a: number, b: number): number {
  for (let i = Math.max(0, from); i < buf.length - 1; i++) {
    if (buf[i] === a && buf[i + 1] === b) return i;
  }
  return -1;
}

/**
 * Fetch-based MJPEG player.
 *
 * Why not a plain <img src=".../stream">? Browsers do NOT abort an <img>
 * download when the element is removed from the DOM — during client-side
 * navigation the old stream keeps downloading in the background forever,
 * hogging the ESP32-CAM's single stream slot. A fetch() with an
 * AbortController, however, reliably kills the connection on unmount, so the
 * camera slot is released the moment the player goes away.
 *
 * Renders each decoded JPEG frame via object URLs and auto-retries briefly
 * when the slot is busy (503) to smooth expand/close transitions.
 */
export default function MjpegPlayer({
  src,
  alt,
  className,
  onConnected,
  onFailed,
  maxRetries = 3,
}: MjpegPlayerProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const frameUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let disposed = false;

    const setAndRevoke = (url: string | null) => {
      if (frameUrlRef.current && frameUrlRef.current !== url) {
        URL.revokeObjectURL(frameUrlRef.current);
      }
      frameUrlRef.current = url;
      setFrameUrl(url);
    };

    const run = async (attempt = 0): Promise<void> => {
      try {
        const res = await fetch(src, { cache: 'no-store', signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

        setFailed(false);
        onConnected?.();

        const reader = res.body.getReader();
        let buf = new Uint8Array(0);

        for (;;) {
          const { done, value } = await reader.read();
          if (done || disposed) break;
          if (!value || value.length === 0) continue;

          const merged = new Uint8Array(buf.length + value.length);
          merged.set(buf);
          merged.set(value, buf.length);
          buf = merged;

          // Extract every complete JPEG frame (SOI = FF D8, EOI = FF D9)
          for (;;) {
            const soi = findMarker(buf, 0, 0xff, 0xd8);
            if (soi === -1) {
              buf = new Uint8Array(0); // garbage, no frame start
              break;
            }
            const eoi = findMarker(buf, soi + 2, 0xff, 0xd9);
            if (eoi === -1) {
              if (soi > 0) buf = buf.slice(soi); // drop garbage before SOI, keep partial frame
              break;
            }
            const frame = buf.slice(soi, eoi + 2);
            buf = buf.slice(eoi + 2);
            setAndRevoke(URL.createObjectURL(new Blob([frame], { type: 'image/jpeg' })));
          }
        }
        throw new Error('stream ended');
      } catch {
        if (disposed || ctrl.signal.aborted) return;
        if (attempt < maxRetries) {
          setTimeout(() => {
            if (!disposed && !ctrl.signal.aborted) run(attempt + 1);
          }, 1000);
        } else {
          setFailed(true);
          onFailed?.();
        }
      }
    };

    run();

    return () => {
      disposed = true;
      ctrl.abort(); // <- the whole point: truly kills the browser connection
      if (frameUrlRef.current) {
        URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      {frameUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={frameUrl} alt={alt} className={className} />
      ) : (
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text-muted)' }}>
          {failed ? 'Stream unavailable — retrying…' : 'Connecting to stream…'}
        </p>
      )}
    </div>
  );
}
