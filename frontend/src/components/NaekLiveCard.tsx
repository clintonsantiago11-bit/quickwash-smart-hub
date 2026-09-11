"use client";

import { Activity, Coins, Radio, Store, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { socketService, type NaekSnapshot } from '@/lib/socket';

/**
 * Live view of the NAEK 3-in-1 carwash timer.
 * Data arrives over Socket.IO (`naek_update` events) from the iot-bridge
 * NAEK edge agent. Falls back to a "waiting" state until the first
 * snapshot lands (device offline / bridge down).
 */
export default function NaekLiveCard() {
  const [snapshot, setSnapshot] = useState<NaekSnapshot | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socketService.connect();

    const offConn = socketService.onConnectionChange(setConnected);
    const offNaek = socketService.onNaekUpdate((payload) => {
      if (payload?.snapshot?.products?.length) {
        setSnapshot(payload.snapshot);
        setLastUpdate(new Date(payload.timestamp).toLocaleTimeString('en-PH', { hour12: false }));
      }
    });

    return () => {
      offConn();
      offNaek();
    };
  }, []);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
            <Store className="text-[var(--accent)]" size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold font-display text-base truncate">
              NAEK 3-in-1 Timer {snapshot?.shopName ? <span className="opacity-60 font-normal">— {snapshot.shopName}</span> : ''}
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">LIVE MACHINE STATUS</p>
          </div>
        </div>
        <span
          className={`badge shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${connected ? 'badge-online' : 'badge-offline'}`}
        >
          {connected ? 'Bridge Live' : 'Bridge Off'}
        </span>
      </div>

      {!snapshot ? (
        <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--border)' }}>
          <Radio className="mx-auto mb-2 opacity-40" size={22} />
          <p className="text-sm text-[var(--text-muted)]">
            Waiting for NAEK data…
          </p>
          <p className="text-[11px] text-[var(--text-muted)] opacity-70 mt-1 font-mono">
            Join the vendo hotspot and run the IoT bridge to go live.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-mono" style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left py-2 font-bold">Product</th>
                  <th className="text-right py-2 font-bold">Rate</th>
                  <th className="text-right py-2 font-bold">Duration</th>
                  <th className="text-right py-2 font-bold">Status</th>
                  <th className="text-right py-2 font-bold">Usage</th>
                  <th className="text-right py-2 font-bold">Net</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.products.map((p) => (
                  <tr key={p.name} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2.5 font-bold uppercase">{p.name}</td>
                    <td className="py-2.5 text-right font-mono">₱{p.rate}</td>
                    <td className="py-2.5 text-right font-mono">{p.duration}s</td>
                    <td className="py-2.5 text-right">
                      <span className={`badge px-2 py-0.5 text-[10px] font-bold ${p.status === 'ON' ? 'badge-online' : 'badge-offline'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono">{p.usage}</td>
                    <td className="py-2.5 text-right font-mono font-bold">₱{p.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <Coins size={12} /> Total Sales
              </div>
              <p className="text-lg sm:text-xl font-bold font-ui mt-1" style={{ color: 'var(--accent)' }}>
                ₱{snapshot.totalSales}
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <Activity size={12} /> Credits
              </div>
              <p className="text-lg sm:text-xl font-bold font-ui mt-1">₱{snapshot.credits}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <Timer size={12} /> Synced
              </div>
              <p className="text-lg sm:text-xl font-bold font-ui mt-1 font-mono">{lastUpdate ?? '--:--:--'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
