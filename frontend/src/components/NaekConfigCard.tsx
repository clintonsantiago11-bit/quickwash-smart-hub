"use client";

import { CheckCircle2, RefreshCw, Save, Settings, Timer, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { socketService, type NaekConfigPayload, type NaekProduct } from '@/lib/socket';
import { usePolling } from '@/lib/usePolling';

interface NaekConfigApi {
  device_id: string;
  shop_name: string;
  lcd_sleep_min: number;
  credits: number;
  total_sales: number;
  sync_pending: boolean;
  last_seen_at: string | null;
  products: {
    slot: number;
    name: string;
    rate: number;
    duration_seconds: number;
    pause_enabled: boolean;
    sync_pending: boolean;
    usage: number;
    net: number;
    status: 'ON' | 'OFF';
  }[];
}

interface DraftProduct {
  name: string;
  rate: string;
  duration: string;
  pause: boolean;
}

/**
 * Editable NAEK machine configuration.
 * Live-observes the device via socket (`naek_config`, ~5s from the agent) and
 * reads the DB mirror via REST (which carries sync_pending). Saving writes the
 * mirror + flags sync_pending; the edge agent pushes it to the device on its
 * next poll and clears the flag, so the card flips back to "Synced"
 * automatically.
 */
export default function NaekConfigCard() {
  const [shopName, setShopName] = useState('');
  const [lcdSleep, setLcdSleep] = useState('60');
  const [products, setProducts] = useState<DraftProduct[]>([]);
  const [syncPending, setSyncPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Init from REST mirror.
  const refresh = async () => {
    try {
      const data: NaekConfigApi = await api.getNaekConfig();
      setShopName(data.shop_name ?? '');
      setLcdSleep(String(data.lcd_sleep_min ?? 60));
      setProducts(
        data.products.map((p, i) => ({
          name: p.name || `PRODUCT ${i + 1}`,
          rate: String(p.rate ?? 0),
          duration: String(p.duration_seconds ?? 0),
          pause: p.pause_enabled ?? false,
        }))
      );
      setSyncPending(data.sync_pending || data.products.some((p) => p.sync_pending));
      setConnected(!!data.last_seen_at);
    } catch (e) {
      console.warn('NAEK config unavailable:', e);
    }
  };

  // Polls through the shared hook rather than a bare setInterval, so this card
  // pauses while the tab is hidden and jitters like every other page instead of
  // hammering the API every 5s from a background tab. The initial fetch stays
  // explicit because usePolling does not fire immediately.
  usePolling(() => void refresh(), { everyMs: 5000, jitterMs: 1500 });

  useEffect(() => {
    socketService.connect();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of external socket state, established repo convention
    refresh();
    const off = socketService.onConnectionChange(setConnected);
    const offCfg = socketService.onNaekConfig((payload: NaekConfigPayload) => {
      setShopName(payload.shopName ?? '');
      setLcdSleep(String(payload.lcdSleep ?? 60));
      setProducts(
        (payload.products ?? []).map((p: NaekProduct, i: number) => ({
          name: p.name || `PRODUCT ${i + 1}`,
          rate: String(p.rate ?? 0),
          duration: String(p.duration ?? 0),
          pause: p.pause ?? false,
        }))
      );
      setConnected(true);
      setLastSync(new Date(payload.timestamp).toLocaleTimeString('en-PH', { hour12: false }));
    });
    return () => {
      // The polling timer is owned by usePolling, which cleans itself up.
      off();
      offCfg();
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateNaekConfig({
        shop_name: shopName,
        lcd_sleep_min: parseInt(lcdSleep, 10) || 60,
        products: products.map((p, slot) => ({
          slot,
          name: p.name || `PRODUCT ${slot + 1}`,
          rate: parseInt(p.rate, 10) || 0,
          duration_seconds: parseInt(p.duration, 10) || 0,
          pause_enabled: p.pause,
        })),
      });
      setSyncPending(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
    refresh();
  };

  const setProduct = (i: number, patch: Partial<DraftProduct>) => {
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
            <Settings className="text-[var(--accent)]" size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold font-display text-base truncate">NAEK Machine Configuration</h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">EDIT RATES &amp; DURATIONS — SYNCED TO DEVICE</p>
          </div>
        </div>
        {syncPending ? (
          <span className="badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
            <RefreshCw size={11} className="inline mr-1 animate-spin" /> Pending sync…
          </span>
        ) : (
          <span className="badge badge-online px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 size={11} className="inline mr-1" /> Synced
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-3 text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Shop Name</span>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full h-11 rounded-xl bg-[var(--bg-base)] border px-3 text-base font-bold font-ui outline-none transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">LCD Sleep (min)</span>
          <input
            type="number"
            min={1}
            max={720}
            value={lcdSleep}
            onChange={(e) => setLcdSleep(e.target.value)}
            className="w-full h-11 rounded-xl bg-[var(--bg-base)] border px-3 text-base font-bold font-ui outline-none transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
        </label>
      </div>

      {/*
        Only ever show what the device actually reported.

        This used to render three placeholder products (WASH/DRY/FOAM at a
        made-up price and duration) whenever the mirror was empty. That is
        worse than an empty table: it looks like real configuration, It can be edited, and saving would push invented prices to the timer.
      */}
      {products.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'var(--bg-base)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            No timer configuration received yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The NAEK 3-in-1 timer has never reported from this site, so there is
            nothing to show and nothing safe to edit. Its slots and prices are
            read from the device, never assumed.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            On the carwash PC, set <code className="font-mono">NAEK_SINK=api</code> and{' '}
            <code className="font-mono">NAEK_API_URL</code> to this site&rsquo;s API, then restart
            the IoT bridge. Sales, credits and this configuration appear once it
            reports.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
          <div key={i} className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Product {i + 1} Name</span>
              <input type="text" value={p.name} onChange={(e) => setProduct(i, { name: e.target.value })} className="w-full h-10 rounded-lg bg-[var(--bg-surface)] border px-3 text-sm font-bold font-ui outline-none" style={{ borderColor: 'var(--border)' }} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Rate (₱)</span>
              <input type="number" min={0} value={p.rate} onChange={(e) => setProduct(i, { rate: e.target.value })} className="w-full h-10 rounded-lg bg-[var(--bg-surface)] border px-3 text-sm font-bold font-ui outline-none" style={{ borderColor: 'var(--border)' }} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Duration (s)</span>
              <input type="number" min={0} value={p.duration} onChange={(e) => setProduct(i, { duration: e.target.value })} className="w-full h-10 rounded-lg bg-[var(--bg-surface)] border px-3 text-sm font-bold font-ui outline-none" style={{ borderColor: 'var(--border)' }} />
            </label>
            <label className="flex items-center gap-2 pb-1 cursor-pointer select-none">
              <input type="checkbox" checked={p.pause} onChange={(e) => setProduct(i, { pause: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Pause 3x</span>
            </label>
          </div>
        ))}
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-end gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono mr-auto">
          {connected ? <Wifi size={13} className="opacity-60" /> : <WifiOff size={13} className="opacity-60" />}
          {connected ? `Live — last sync ${lastSync ?? '…'}` : 'Device offline — changes stay pending'}
        </div>
        <button
          onClick={handleSave}
          // Nothing to push to the device when it has never reported.
          disabled={saving || products.length === 0}
          className="h-11 px-6 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 8px 24px var(--accent-glow)' }}
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save to Device'}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)] font-mono">
        <Timer size={11} className="inline mr-1 opacity-60" /> Applied on the machine within ~5s. Device-side changes come back here automatically.
      </p>
    </div>
  );
}