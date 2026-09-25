"use client";

import Header from '@/components/Header';
import MjpegPlayer from '@/components/MjpegPlayer';
import { Camera, AlertCircle, Maximize2, Settings, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '@/lib/socket';

interface CameraFeed {
  id: string;
  name: string;
  streamUrl: string;
  controlUrl?: string;
  status: 'online' | 'degraded' | 'offline';
}

interface HardwareUpdate {
  topic: string;
  data: {
    status?: string;
    stream_url?: string;
  };
  timestamp?: string;
}

const CAMERA_CONTROL_URL = process.env.NEXT_PUBLIC_CAMERA_CONTROL_URL || 'http://192.168.1.7/';

const initialCameras: CameraFeed[] = [
  { id: 'esp32_cam_1', name: 'Main Wash Bay', streamUrl: '/api/camera/stream', controlUrl: CAMERA_CONTROL_URL, status: 'offline' },
];

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraFeed[]>(initialCameras);
  const [viewer, setViewer] = useState<{ camId: string; name: string; type: 'panel' | 'stream' } | null>(null);
  const camerasRef = useRef<CameraFeed[]>(initialCameras);
  useEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

  // Close the in-page viewer with the Escape key
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  // Probe a camera's health. `force` bypasses the "already streaming, don't
  // touch the slot" shortcut so the Retry button always does a full check.
  const probeCamera = useCallback(async (cam: CameraFeed, force = false) => {
    try {
      // 1) Is the camera itself reachable? (lightweight endpoint, multi-client safe)
      const statusRes = await fetch('/api/camera/panel/status', { cache: 'no-store' });
      if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);

      // Already streaming in the UI -> don't touch the stream slot at all.
      if (!force && camerasRef.current.find(c => c.id === cam.id)?.status === 'online') return;

      // 2) Probe the stream briefly, then release the slot immediately.
      //    NOTE: fetch() does NOT throw on 503/504 — check res.ok explicitly!
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        const streamRes = await fetch(cam.streamUrl, { cache: 'no-store', signal: ctrl.signal });
        if (!streamRes.ok) throw new Error(`stream ${streamRes.status}`);
        await streamRes.body?.cancel(); // release proxy + camera slot right away
        setCameras(cur => cur.map(c => c.id === cam.id ? { ...c, status: 'online' } : c));
      } catch {
        // Stream slot busy (503) or stream down, but the camera is reachable
        setCameras(cur => cur.map(c => c.id === cam.id ? { ...c, status: 'degraded' } : c));
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Camera itself unreachable
      setCameras(cur => cur.map(c => c.id === cam.id ? { ...c, status: 'offline' } : c));
    }
  }, []);

  useEffect(() => {
    // Connect to Socket.IO to listen for Camera MQTT heartbeats
    socketService.connect();

    const probeAll = () => {
      initialCameras.forEach(cam => probeCamera(cam));
    };
    probeAll();
    const probeInterval = setInterval(probeAll, 10000);

    const removeListener = socketService.onHardwareUpdate((msg: HardwareUpdate) => {
      // If a camera sends a status update with a stream_url, mark it online
      if (!msg || !msg.topic || !msg.topic.includes('/status/esp32_cam')) return;
      const camId = msg.topic.split('/').pop();
      if (camId) {
        setCameras(prev => prev.map(c => 
          c.id === camId 
            ? { ...c, status: msg.data.status === 'online' ? 'online' : 'offline', streamUrl: msg.data.stream_url || c.streamUrl } 
            : c
        ));
      }
    });

    return () => {
      removeListener();
      clearInterval(probeInterval);
    };
  }, [probeCamera]);

  return (
    <>
      <Header title="Live Camera Feeds" subtitle="Real-time ESP-CAM surveillance" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto overflow-x-hidden">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          {cameras.map((cam) => (
            <div key={cam.id} className="card p-0 overflow-hidden flex flex-col group transition-all hover:border-[var(--accent)] hover:shadow-2xl hover:shadow-[var(--accent-glow)]">
              <div className="p-4 sm:p-5 flex justify-between items-center gap-3 bg-[var(--bg-elevated)]" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black font-display text-sm sm:text-base lg:text-lg truncate uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{cam.name}</h3>
                  <p className="text-[10px] lg:text-xs font-bold font-mono truncate opacity-50 uppercase tracking-widest">{cam.id}</p>
                </div>
                <span className={`badge shrink-0 px-3 py-1 text-[10px] lg:text-xs font-bold uppercase tracking-widest ${cam.status === 'online' ? 'badge-online ring-4 ring-[var(--success-muted)]' : cam.status === 'degraded' ? 'badge-offline !text-[var(--warning)] !border-[var(--warning)]/40' : 'badge-offline'}`}>
                  {cam.status === 'online' ? '● LIVE' : cam.status === 'degraded' ? '⚠ CAM OK · NO STREAM' : 'OFFLINE'}
                </span>
              </div>
              
              <div className="relative aspect-video bg-[#05070a] flex items-center justify-center overflow-hidden">
                {cam.status === 'online' && viewer?.camId !== cam.id ? (
                  <MjpegPlayer
                    src={cam.streamUrl}
                    alt={`Stream from ${cam.name}`}
                    className="w-full h-full object-cover sm:object-contain"
                    onConnected={() => {
                      setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, status: 'online' } : c));
                    }}
                    onFailed={() => {
                      setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, status: 'offline' } : c));
                    }}
                  />
                ) : cam.status === 'online' && viewer?.camId === cam.id ? (
                  <div className="text-center flex flex-col items-center p-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                      <Maximize2 size={32} className="opacity-30 text-white" />
                    </div>
                    <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text-muted)' }}>Playing in viewer window</p>
                  </div>
                ) : cam.status === 'degraded' ? (
                  <div className="text-center flex flex-col items-center p-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[var(--warning-muted)] flex items-center justify-center mb-4 border border-[var(--warning)]/20">
                      <AlertCircle size={32} style={{ color: 'var(--warning)' }} />
                    </div>
                    <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--warning)' }}>Camera Detected — Stream Down</p>
                    <p className="text-[10px] lg:text-xs mt-2 leading-relaxed font-bold opacity-50 text-center" style={{ color: 'var(--text-muted)' }}>
                      The ESP32 is on the network but its stream server is not responding. It may be rebooting, or the camera sensor has failed (check power supply / ribbon cable). Settings remain available.
                    </p>
                    <button
                      onClick={() => probeCamera(cam, true)}
                      className="mt-4 px-4 py-2 text-[10px] lg:text-xs font-black uppercase tracking-widest rounded-lg border border-white/10 bg-white/5 hover:bg-[var(--accent)] hover:text-black transition-all"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ⟳ Retry Connection
                    </button>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center p-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                      <Camera size={32} className="opacity-20 text-white" />
                    </div>
                    <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] opacity-30" style={{ color: 'var(--text-muted)' }}>No Signal Detected</p>
                    <button
                      onClick={() => probeCamera(cam, true)}
                      className="mt-4 px-4 py-2 text-[10px] lg:text-xs font-black uppercase tracking-widest rounded-lg border border-white/10 bg-white/5 hover:bg-[var(--accent)] hover:text-black transition-all"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ⟳ Retry Connection
                    </button>
                  </div>
                )}

                {/* Overlays */}
                {cam.status === 'online' && (
                  <div className="absolute top-4 left-4 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
                       <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                       <span className="text-[10px] font-bold text-white font-mono uppercase tracking-widest">REC</span>
                    </div>
                  </div>
                )}

                {cam.status !== 'offline' && (
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    {cam.controlUrl && (
                      <button
                        onClick={() => setViewer({ camId: cam.id, name: cam.name, type: 'panel' })}
                        title="Camera settings (in-app)"
                        className="w-10 h-10 rounded-xl bg-black/60 text-white flex items-center justify-center hover:bg-[var(--accent)] hover:text-black transition-all backdrop-blur-md border border-white/10 shadow-xl group/btn"
                      >
                        <Settings size={18} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                    )}
                    {cam.status === 'online' && (
                      <button
                        onClick={() => setViewer({ camId: cam.id, name: cam.name, type: 'stream' })}
                        title="Expand stream (in-app)"
                        className="w-10 h-10 rounded-xl bg-black/60 text-white flex items-center justify-center hover:bg-[var(--accent)] hover:text-black transition-all backdrop-blur-md border border-white/10 shadow-xl group/btn"
                      >
                        <Maximize2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {cam.status === 'offline' && (
                <div className="p-5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--warning-muted)] flex items-center justify-center shrink-0 border border-[var(--warning)]/20">
                      <AlertCircle size={20} style={{ color: 'var(--warning)' }}/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs lg:text-sm font-black text-[var(--warning)] uppercase tracking-widest">Network Alert</p>
                      <p className="text-[10px] lg:text-xs mt-1 leading-relaxed font-bold opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        Surveillance node unreachable. Check the ESP32-CAM power supply (solid 5V/2A), reseat the camera ribbon cable, or open its control panel to verify the sensor.
                      </p>
                      <p className="text-[10px] lg:text-xs mt-2 leading-relaxed font-bold opacity-40" style={{ color: 'var(--text-secondary)' }}>
                        Target device: {CAMERA_CONTROL_URL} (auto-retrying every 10s)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </main>

      {/* In-page viewer modal: full-screen stream or camera control panel */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setViewer(null)}
        >
          <div
            className="card w-full max-w-5xl max-h-[95vh] p-0 overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex justify-between items-center gap-3 bg-[var(--bg-elevated)]" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <h3 className="font-black font-display text-sm sm:text-base truncate uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                  {viewer.name} — {viewer.type === 'panel' ? 'Camera Settings' : 'Full-Screen Stream'}
                </h3>
                <p className="text-[10px] font-bold font-mono truncate opacity-50 uppercase tracking-widest">
                  {viewer.type === 'panel' ? 'ESP32 CameraWebServer (embedded)' : 'Live MJPEG feed'}
                </p>
              </div>
              <button
                onClick={() => setViewer(null)}
                title="Close (Esc)"
                className="w-9 h-9 shrink-0 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-[var(--accent)] hover:text-black transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-[60vh] bg-[#05070a] flex items-center justify-center overflow-hidden">
              {viewer.type === 'panel' ? (
                <iframe
                  src="/api/camera/panel"
                  title={`${viewer.name} control panel`}
                  className="w-full h-[75vh] bg-[#181818]"
                />
              ) : (
                <MjpegPlayer
                  src="/api/camera/stream"
                  alt={`Full-screen stream from ${viewer.name}`}
                  className="w-full h-full max-h-[80vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
