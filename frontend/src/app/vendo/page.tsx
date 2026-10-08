"use client";

import Header from '@/components/Header';
import NaekLiveCard from '@/components/NaekLiveCard';
import NaekConfigCard from '@/components/NaekConfigCard';
import { Coins, Clock, Save, Timer, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { usePolling } from '@/lib/usePolling';

interface VendoSettings {
  standard_duration_min: number;
  standard_price: number;
  premium_duration_min: number;
  premium_price: number;
  dry_duration_min: number;
  dry_price: number;
  coin_timeout_seconds: number;
}

interface CycleFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  accent?: boolean;
}

function CycleField({ label, value, onChange, suffix, accent }: CycleFieldProps) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono mb-1.5">{label}</p>
      <div className="relative">
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-11 rounded-xl bg-[var(--bg-base)] border px-3 pr-12 text-base font-bold font-ui outline-none transition-colors ${accent ? 'text-[var(--accent)]' : ''}`}
          style={{ borderColor: 'var(--border)' }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold opacity-50">{suffix}</span>
      </div>
    </div>
  );
}

export default function VendoConfigPage() {
  const [settings, setSettings] = useState<VendoSettings>({
    standard_duration_min: 10,
    standard_price: 50,
    premium_duration_min: 15,
    premium_price: 100,
    dry_duration_min: 8,
    dry_price: 40,
    coin_timeout_seconds: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // Set as soon as any field changes, and cleared on a successful save. The
  // background poll stands down while it is true.
  const dirtyRef = useRef(false);

  const update = (patch: Partial<VendoSettings>) => {
    dirtyRef.current = true;
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const fetchSettings = async () => {
    try {
      const data = await api.getVendoSettings();
      setSettings((prev) => {
        // Never overwrite a field the operator is part-way through editing.
        // This polled every five seconds, so a price being typed was replaced
        // mid-keystroke and the change appeared to vanish.
        if (dirtyRef.current) return prev;
        return { ...prev, ...data };
      });
    } catch {
      console.warn('Vendo settings unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  usePolling(() => void fetchSettings(), { everyMs: 15000, jitterMs: 3000 });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.updateVendoSettings({
        standard_duration_min: parseInt(String(settings.standard_duration_min), 10),
        standard_price: parseFloat(String(settings.standard_price)),
        premium_duration_min: parseInt(String(settings.premium_duration_min), 10),
        premium_price: parseFloat(String(settings.premium_price)),
        // The dry cycle used to be copied from the standard cycle on load and
        // never written back, so anything typed here vanished on the next poll.
        dry_duration_min: parseInt(String(settings.dry_duration_min), 10),
        dry_price: parseFloat(String(settings.dry_price)),
        coin_timeout_seconds: parseInt(String(settings.coin_timeout_seconds), 10),
      });
      dirtyRef.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Vendo Configuration" subtitle="Set the duration and price of each wash cycle" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto">

        {/* Status banner */}
        <div className={`card p-4 flex items-center gap-3 transition-all duration-300 ${saved ? 'opacity-100' : 'opacity-0 -mb-10 hidden'}`} style={{ background: 'var(--success-glow, rgba(34,197,94,0.08))', borderColor: 'var(--success, #22c55e)' }}>
          <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
          <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Settings saved — the vendo will use the new values on the next start.</p>
        </div>
        {error && (
          <div className="card p-4 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: '#ef4444' }}>
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* Live NAEK machine feed (Socket.IO from the iot-bridge edge agent) */}
        <NaekLiveCard />
        <NaekConfigCard />

        {/* Wash cycles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Standard */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
                  <Coins className="text-[var(--accent)]" size={20} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-base">Water/Wash Cycle</h3>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">WATER + WASH</p>
                </div>
              </div>
              <span className="badge badge-online text-[10px] px-2.5 py-1 uppercase tracking-wider">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CycleField label="Duration" value={String(settings.standard_duration_min)} onChange={(v) => update({ standard_duration_min: Number(v) })} suffix="min" />
              <CycleField label="Price" value={String(settings.standard_price)} onChange={(v) => update({ standard_price: Number(v) })} suffix="₱" accent />
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              <Timer size={13} className="opacity-60" />
              Customer must insert <b style={{ color: 'var(--accent)' }}>₱{settings.standard_price}</b> to start this cycle.
            </p>
          </div>

          {/* Premium */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
                  <Coins className="text-[var(--accent)]" size={20} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-base">Soap Cycle</h3>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">SOAP + WASH</p>
                </div>
              </div>
              <span className="badge badge-online text-[10px] px-2.5 py-1 uppercase tracking-wider">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CycleField label="Duration" value={String(settings.premium_duration_min)} onChange={(v) => update({ premium_duration_min: Number(v) })} suffix="min" />
              <CycleField label="Price" value={String(settings.premium_price)} onChange={(v) => update({ premium_price: Number(v) })} suffix="₱" accent />
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              <Timer size={13} className="opacity-60" />
              Customer must insert <b style={{ color: 'var(--accent)' }}>₱{settings.premium_price}</b> to start this cycle.
            </p>
          </div>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
                <Coins className="text-[var(--accent)]" size={20} />
              </div>
              <div>
                <h3 className="font-bold font-display text-base">Dry Cycle</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">DRYING PHASE</p>
              </div>
            </div>
            <span className="badge badge-online text-[10px] px-2.5 py-1 uppercase tracking-wider">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CycleField label="Duration" value={String(settings.dry_duration_min)} onChange={(v) => update({ dry_duration_min: Number(v) })} suffix="min" />
            <CycleField label="Price" value={String(settings.dry_price)} onChange={(v) => update({ dry_price: Number(v) })} suffix="₱" accent />
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <Timer size={13} className="opacity-60" />
            Customer must insert <b style={{ color: 'var(--accent)' }}>₱{settings.dry_price}</b> to start this cycle.
          </p>
        </div>

        {/* Payment timeout */}
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--border)] flex items-center justify-center shrink-0">
                <Clock className="text-[var(--text-muted)]" size={20} />
              </div>
              <div>
                <h3 className="font-bold font-display text-base">Coin Collection Window</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">PAYMENT TIMEOUT</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <CycleField
              label="Timeout per coin"
              value={String(settings.coin_timeout_seconds)}
              onChange={(v) => update({ coin_timeout_seconds: Number(v) })}
              suffix="sec"
            />
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <Timer size={13} className="opacity-60" />
            Time the acceptor keeps accepting coins before starting the selected cycle.
          </p>
        </div>

        {/* Save */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 sticky bottom-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono mr-auto hidden sm:flex">
            <RefreshCw size={13} className="opacity-60" />
            {loading ? 'Loading current configuration…' : 'Latest configuration from the vendo'}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="h-11 px-6 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 8px 24px var(--accent-glow)' }}
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </main>
    </>
  );
}
