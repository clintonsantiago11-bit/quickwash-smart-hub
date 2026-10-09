/* ==================================================================
 * System settings page: validation and shape.
 *
 * The page used to keep everything in localStorage and read it back from
 * nowhere. These helpers are pure so the rules can be tested without a
 * browser or a server.
 * ================================================================== */

export interface SystemSettings {
  low_water_pct: number;
  low_soap_pct: number;
  low_wax_pct: number;
  stale_device_seconds: number;
  audit_retention_days: number;
  mqtt_broker_host: string;
  mqtt_broker_port: number;
  mqtt_topic_prefix: string;
}

/**
 * Bounds enforced by the controller, restated here so the form can show the
 * error before the round trip. The server is the authority; this is only so an
 * operator is not told "yes" locally and 422 remotely.
 */
export const LIMITS = {
  low_pct: { min: 0, max: 100 },
  // Floor of 30s: the bridge marks a device stale at 90s (iot-bridge/db.js)
  // and /devices uses 30s. Below that the dashboard contradicts the agent.
  stale_device_seconds: { min: 30, max: 3600 },
  audit_retention_days: { min: 7, max: 3650 },
  mqtt_broker_port: { min: 1, max: 65535 },
} as const;

export type NumericField =
  | 'low_water_pct'
  | 'low_soap_pct'
  | 'low_wax_pct'
  | 'stale_device_seconds'
  | 'audit_retention_days'
  | 'mqtt_broker_port';

type Range = { min: number; max: number };

function rangeFor(field: NumericField): Range {
  if (field === 'stale_device_seconds') return LIMITS.stale_device_seconds;
  if (field === 'audit_retention_days') return LIMITS.audit_retention_days;
  if (field === 'mqtt_broker_port') return LIMITS.mqtt_broker_port;
  return LIMITS.low_pct;
}

/**
 * Validate one numeric field.
 *
 * The parsed number is returned alongside the message so a caller can write the
 * normalised value back rather than the raw string.
 */
export function validateNumeric(
  field: NumericField,
  raw: string | number,
): { ok: true; value: number } | { ok: false; message: string } {
  const { min, max } = rangeFor(field);

  const text = String(raw).trim();
  if (text === '') {
    return { ok: false, message: 'Required' };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, message: 'Must be a number' };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, message: 'Must be a whole number' };
  }
  if (value < min || value > max) {
    return { ok: false, message: `Must be between ${min} and ${max}` };
  }

  return { ok: true, value };
}

/**
 * Broker host: a hostname or IP, nothing else.
 *
 * The server applies the same rule. Rejecting a scheme, credentials or a path
 * here means the field cannot quietly hold "mqtt://user:pass@host/x", which
 * would be a credential in a field shown in plaintext on a settings page.
 */
export function validateBrokerHost(
  raw: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const text = raw.trim();

  // Blank means "keep whatever the environment provides".
  if (text === '') return { ok: true, value: null };

  if (/\s/.test(text)) {
    return { ok: false, message: 'No spaces allowed' };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(text)) {
    return {
      ok: false,
      message: 'Hostname or IP only — no scheme, port, or credentials',
    };
  }

  return { ok: true, value: text };
}

export type SettingsErrors = Partial<Record<NumericField | 'mqtt_broker_host', string>>;

/** Validate a whole settings object. Returns {} when everything passes. */
export function validateSettings(input: SystemSettings): SettingsErrors {
  const errors: SettingsErrors = {};

  const numericFields: NumericField[] = [
    'low_water_pct',
    'low_soap_pct',
    'low_wax_pct',
    'stale_device_seconds',
    'audit_retention_days',
    'mqtt_broker_port',
  ];

  // The form holds strings in the numeric fields while they are being edited,
  // so each value is read as either and handed to validateNumeric as unknown.
  const raw = input as unknown as Record<string, unknown>;

  for (const field of numericFields) {
    const result = validateNumeric(field, raw[field] as string | number);
    if (!result.ok) errors[field] = result.message;
  }

  const host = validateBrokerHost(String(raw.mqtt_broker_host ?? ''));
  if (!host.ok) errors.mqtt_broker_host = host.message;

  return errors;
}

export function hasErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Whether a stored broker host differs from the one the running clients use.
 *
 * The page has to say this out loud. Saving a host here writes a database row;
 * the live MQTT socket is held by the bridge process and was built from its own
 * environment. Without the warning the page implies a change took effect.
 */
export function brokerNeedsRestart(
  stored: { host: string; port: number },
  inEffect: { host: string; port: number },
): boolean {
  return stored.host !== inEffect.host || stored.port !== inEffect.port;
}

/**
 * What "the bridge will use this on its next restart" means for the operator.
 *
 * Only the broker fields are affected. The thresholds are stored for the
 * bridge to read, but the bridge does not read them yet — saying otherwise
 * would repeat the original sin of implying a change took effect.
 */
export function pendingRestartNote(inEffect: {
  host: string;
  port: number;
}): string {
  return `The running bridge is connected to ${inEffect.host}:${inEffect.port}. A broker saved here is used the next time the bridge starts.`;
}