"use client";

import Header from '@/components/Header';
import { Settings as SettingsIcon, Save, CheckCircle, AlertTriangle, Info, User } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePolling } from '@/lib/usePolling';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  type SystemSettings,
  type SettingsErrors,
  validateSettings,
  hasErrors,
  LIMITS,
  brokerNeedsRestart,
  pendingRestartNote,
} from '@/lib/settings';

interface BrokerInEffect {
  host: string;
  port: number;
}

const DEFAULTS: SystemSettings = {
  low_water_pct: 20,
  low_soap_pct: 15,
  low_wax_pct: 15,
  stale_device_seconds: 90,
  audit_retention_days: 90,
  mqtt_broker_host: '',
  mqtt_broker_port: 1883,
  mqtt_topic_prefix: '',
};

/**
 * System settings.
 *
 * These used to live in localStorage and be read back by nothing: the broker
 * host and port come from environment variables, and no code compared a tank
 * level against a threshold at all. An operator could change a low-water
 * percentage, press Save, see "Saved to this browser", and the machine would
 * carry on ignoring it. The values now round-trip through the API, are
 * validated on the server, and every change is recorded in the audit trail.
 *
 * Two honesty notes this page exists to make:
 *
 *  - The broker host and port are stored but do NOT move a live MQTT
 *    connection. The bridge process holds its own socket, built from its own
 *    environment. The banner below says so instead of letting the Save button
 *    imply otherwise.
 *  - The thresholds are stored and validated, but the bridge does not read them
 *    yet. They take effect once the bridge polls for them; until then the page
 *    labels them as pending rather than claiming they are live.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [brokerInEffect, setBrokerInEffect] = useState<BrokerInEffect | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [adminUser, setAdminUser] = useState<{ full_name: string; email: string; role: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<SettingsErrors>({});

  // Set as soon as any field changes, and cleared on a successful save. The
  // background poll stands down while it is true so a price being typed is not
  // replaced mid-keystroke.
  const dirtyRef = useRef(false);

  // The saved-tick timer is cleared on unmount so it cannot set state on a
  // component that has gone.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getSystemSettings();

      setSettings((prev) => {
        if (dirtyRef.current) return prev;
        return { ...prev, ...(data.settings as Partial<SystemSettings>) };
      });
      setBrokerInEffect(data.broker_in_effect as BrokerInEffect);
      setCanEdit(Boolean(data.can_edit));
      setLoadError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load settings';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // The signed-in operator's own identity, for the "who can change this"
    // card. A failure here must not blank the settings.
    api
      .getProfile()
      .then((user) =>
        setAdminUser({ full_name: user.full_name, email: user.email, role: user.role })
      )
      .catch(() => setAdminUser(null));
  }, [load]);

  usePolling(() => void load(), { everyMs: 30000, jitterMs: 5000 });

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const update = (patch: Partial<SystemSettings>) => {
    dirtyRef.current = true;
    setSaved(false);
    setSaveError('');
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    setSaveError('');
    setSaved(false);

    // Validate before the round trip so the operator gets a field-level
    // message rather than a bare 422. The server re-checks regardless.
    const found = validateSettings(settings);
    setErrors(found);
    if (hasErrors(found)) {
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    try {
      await api.updateSystemSettings({
        low_water_pct: Number(settings.low_water_pct),
        low_soap_pct: Number(settings.low_soap_pct),
        low_wax_pct: Number(settings.low_wax_pct),
        stale_device_seconds: Number(settings.stale_device_seconds),
        audit_retention_days: Number(settings.audit_retention_days),
        mqtt_broker_host: settings.mqtt_broker_host.trim() || null,
        mqtt_broker_port: Number(settings.mqtt_broker_port),
        mqtt_topic_prefix: settings.mqtt_topic_prefix.trim() || null,
      });

      dirtyRef.current = false;
      setSaved(true);
      // Re-read so the page shows what the server actually stored, not what
      // was typed.
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 4000);
    }
  };

  const numberField = (
    id: keyof SystemSettings,
    label: string,
    hint: string,
    min: number,
    max: number,
    suffix?: string,
  ) => {
    const error = errors[id as keyof SettingsErrors];
    const invalid = Boolean(error);

    return (
      <div className="space-y-2">
        <label
          htmlFor={id}
          className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            value={String(settings[id])}
            min={min}
            max={max}
            step={1}
            required
            disabled={!canEdit}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
            onChange={(e) => update({ [id]: e.target.value as unknown as number })}
            className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              borderColor: invalid ? 'var(--danger)' : 'var(--border)',
              paddingRight: suffix ? '3rem' : undefined,
            }}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono bold opacity-50">
              {suffix}
            </span>
          )}
        </div>
        {invalid ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-xs font-semibold"
            style={{ color: 'var(--danger)' }}
          >
            {error}
          </p>
        ) : (
          <p id={`${id}-hint`} className="text-xs opacity-60">
            {hint}
          </p>
        )}
      </div>
    );
  };

  const brokerDiverged =
    brokerInEffect !== null &&
    brokerNeedsRestart(
      { host: settings.mqtt_broker_host || brokerInEffect.host, port: Number(settings.mqtt_broker_port) },
      brokerInEffect,
    );

  if (loadError && loading) {
    return (
      <>
        <Header title="System Settings" subtitle="Configure platform parameters" />
        <main className="flex-1 p-4 md:p-6 w-full max-w-4xl mx-auto">
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="System Settings" subtitle="Configure platform parameters" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 w-full max-w-4xl mx-auto overflow-x-hidden">
        <div className="card p-4 sm:p-8 space-y-8 sm:space-y-12">

          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm opacity-60">Loading settings…</p>
            </div>
          ) : (
            <>
              {!canEdit && (
                <div
                  className="card p-4 flex items-start gap-3"
                  style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.5)' }}
                >
                  <Info size={18} style={{ color: '#f59e0b' }} className="shrink-0 mt-0.5" />
                  <p className="text-sm" style={{ color: '#f59e0b' }}>
                    You are signed in as <strong>{adminUser?.role ?? 'a technician'}</strong>. You
                    can read these settings but not change them &mdash; that needs an admin or
                    manager account.
                  </p>
                </div>
              )}

              {loadError && (
                <div
                  className="card p-4 flex items-start gap-3"
                  style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.5)' }}
                >
                  <AlertTriangle size={18} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                      Could not refresh from the server
                    </p>
                    <p className="text-xs opacity-70 mt-1">{loadError}</p>
                  </div>
                </div>
              )}

              {/* ---- Supply thresholds ---- */}
              <section>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
                  <SettingsIcon size={18} className="text-[var(--accent)]" />
                  Supply Thresholds
                </h3>
                <p className="text-xs opacity-60 mb-4 sm:mb-6">
                  Percentage of tank capacity at which the system raises a low-supply alert.
                  Stored and validated now; the edge bridge reads these on its next cycle.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                  {numberField(
                    'low_water_pct',
                    'LOW WATER (%)',
                    'The main water tank.',
                    LIMITS.low_pct.min,
                    LIMITS.low_pct.max,
                    '%',
                  )}
                  {numberField(
                    'low_soap_pct',
                    'LOW SOAP (%)',
                    'Foam dispenser tank.',
                    LIMITS.low_pct.min,
                    LIMITS.low_pct.max,
                    '%',
                  )}
                  {numberField(
                    'low_wax_pct',
                    'LOW WAX (%)',
                    'Wax dispenser tank.',
                    LIMITS.low_pct.min,
                    LIMITS.low_pct.max,
                    '%',
                  )}
                </div>
              </section>

              {/* ---- Monitoring ---- */}
              <section>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
                  <SettingsIcon size={18} className="text-[var(--accent)]" />
                  Monitoring
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                  {numberField(
                    'stale_device_seconds',
                    'DEVICE OFFLINE AFTER (S)',
                    'How long a device may go unheard before it is shown as offline.',
                    LIMITS.stale_device_seconds.min,
                    LIMITS.stale_device_seconds.max,
                    's',
                  )}
                  {numberField(
                    'audit_retention_days',
                    'AUDIT RETENTION (DAYS)',
                    'Audit rows older than this are removed by the nightly cleanup.',
                    LIMITS.audit_retention_days.min,
                    LIMITS.audit_retention_days.max,
                    'd',
                  )}
                </div>
              </section>

              {/* ---- MQTT ---- */}
              <section>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
                  <SettingsIcon size={18} className="text-[var(--accent)]" />
                  MQTT Broker
                </h3>

                {brokerInEffect && (
                  <div
                    className="card p-3 mb-4 flex items-start gap-3"
                    style={{ background: 'rgba(0,180,216,0.07)', borderColor: 'rgba(0,180,216,0.4)' }}
                  >
                    <Info size={16} style={{ color: 'var(--accent)' }} className="shrink-0 mt-0.5" />
                    <p className="text-xs opacity-80">{pendingRestartNote(brokerInEffect)}</p>
                  </div>
                )}

                {brokerDiverged && (
                  <div
                    className="card p-3 mb-4 flex items-start gap-3"
                    style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.5)' }}
                  >
                    <AlertTriangle size={16} style={{ color: '#f59e0b' }} className="shrink-0 mt-0.5" />
                    <p className="text-xs" style={{ color: '#f59e0b' }}>
                      These values differ from the live connection. Saving records them, but the
                      bridge keeps its current socket until it is restarted.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                  <div className="space-y-2">
                    <label
                      htmlFor="mqtt_broker_host"
                      className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      BROKER HOST
                    </label>
                    <input
                      id="mqtt_broker_host"
                      type="text"
                      value={settings.mqtt_broker_host}
                      placeholder="broker.example.com"
                      disabled={!canEdit}
                      aria-invalid={Boolean(errors.mqtt_broker_host)}
                      aria-describedby={
                        errors.mqtt_broker_host ? 'mqtt_broker_host-error' : 'mqtt_broker_host-hint'
                      }
                      onChange={(e) => update({ mqtt_broker_host: e.target.value })}
                      className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        borderColor: errors.mqtt_broker_host ? 'var(--danger)' : 'var(--border)',
                      }}
                    />
                    {errors.mqtt_broker_host ? (
                      <p
                        id="mqtt_broker_host-error"
                        role="alert"
                        className="text-xs font-semibold"
                        style={{ color: 'var(--danger)' }}
                      >
                        {errors.mqtt_broker_host}
                      </p>
                    ) : (
                      <p id="mqtt_broker_host-hint" className="text-xs opacity-60">
                        Leave blank to use the broker configured on the server. Hostname or IP only.
                      </p>
                    )}
                  </div>

                  {numberField(
                    'mqtt_broker_port',
                    'PORT',
                    'Standard MQTT port is 1883; TLS brokers often use 8883.',
                    LIMITS.mqtt_broker_port.min,
                    LIMITS.mqtt_broker_port.max,
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <label
                    htmlFor="mqtt_topic_prefix"
                    className="block text-[10px] sm:text-xs font-mono uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    TOPIC PREFIX
                  </label>
                  <input
                    id="mqtt_topic_prefix"
                    type="text"
                    value={settings.mqtt_topic_prefix}
                    placeholder="quickwash/quickwash_main"
                    disabled={!canEdit}
                    onChange={(e) => update({ mqtt_topic_prefix: e.target.value })}
                    className="w-full bg-[var(--bg-input)] p-3 sm:p-4 rounded-xl text-sm border focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <p className="text-xs opacity-60">
                    Blank uses the server&rsquo;s prefix. Must match what the firmware publishes
                    to.
                  </p>
                </div>
              </section>

              {/* ---- Signed-in operator ---- */}
              <section>
                <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-6 font-display flex items-center gap-2 opacity-80 uppercase tracking-widest">
                  <User size={18} className="text-[var(--accent)]" />
                  Your Access
                </h3>
                <div className="card p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-glow)' }}
                  >
                    <User size={20} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{adminUser?.full_name ?? '—'}</p>
                    <p className="text-xs opacity-60 font-mono truncate">{adminUser?.email ?? '—'}</p>
                  </div>
                  <span
                    className="badge badge-online px-3 py-1 text-[10px] font-bold uppercase tracking-wider ml-auto shrink-0"
                  >
                    {adminUser?.role ?? 'unknown'}
                  </span>
                </div>
                <p className="text-xs opacity-60 mt-3">
                  {canEdit
                    ? 'You can change these settings. Every change is written to the audit trail.'
                    : 'Only admins and managers can change these settings.'}
                </p>
              </section>

              {/* ---- Save ---- */}
              <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={handleSave}
                  disabled={!canEdit || saving || loading}
                  aria-busy={saving}
                  className="btn btn-primary w-full sm:w-auto px-10 py-4 font-black uppercase tracking-widest text-black flex items-center justify-center gap-2 text-sm shadow-xl hover:shadow-[var(--accent-glow)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
                </button>
                {saveError && (
                  <p role="alert" className="text-xs font-bold" style={{ color: 'var(--danger)' }}>
                    {saveError}
                  </p>
                )}
                {saved && !saveError && (
                  <p className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                    Saved to the server
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}