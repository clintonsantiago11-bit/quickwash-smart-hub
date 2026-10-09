import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  LIMITS,
  validateNumeric,
  validateBrokerHost,
  validateSettings,
  hasErrors,
  brokerNeedsRestart,
  pendingRestartNote,
} = await import('./settings.ts');

const VALID = {
  low_water_pct: 25,
  low_soap_pct: 18,
  low_wax_pct: 12,
  stale_device_seconds: 120,
  audit_retention_days: 180,
  mqtt_broker_host: 'broker.example.com',
  mqtt_broker_port: 8883,
  mqtt_topic_prefix: 'quickwash/main',
};

test('a complete valid payload passes', () => {
  const errors = validateSettings(VALID);
  assert.equal(hasErrors(errors), false, JSON.stringify(errors));
});

test('thresholds accept the full 0-100 range', () => {
  for (const value of [0, 1, 50, 99, 100]) {
    assert.equal(validateNumeric('low_water_pct', value).ok, true, `should accept ${value}`);
  }
});

test('a threshold over 100 is rejected with the range in the message', () => {
  // This is the case the old page let through: type="number" without a max, so
  // 150 saved without complaint and would have overflowed the column.
  const result = validateNumeric('low_water_pct', 150);
  assert.equal(result.ok, false);
  assert.match(result.message, /between 0 and 100/);
});

test('a negative threshold is rejected', () => {
  assert.equal(validateNumeric('low_soap_pct', -5).ok, false);
});

test('a fractional value is rejected because the column is an integer', () => {
  const result = validateNumeric('low_water_pct', 12.5);
  assert.equal(result.ok, false);
  assert.match(result.message, /whole number/);
});

test('non-numeric input is rejected rather than becoming NaN', () => {
  for (const bad of ['abc', '', '  ', '1e999', NaN]) {
    assert.equal(validateNumeric('low_water_pct', bad).ok, false, `should reject ${String(bad)}`);
  }
});

test('stale_device_seconds has a floor of 30, not 0', () => {
  // Below 30s the dashboard would disagree with /devices (30s) and the bridge
  // (90s) about the same device, and it would flicker.
  assert.equal(validateNumeric('stale_device_seconds', 29).ok, false);
  assert.equal(validateNumeric('stale_device_seconds', 30).ok, true);
  assert.equal(validateNumeric('stale_device_seconds', 3600).ok, true);
  assert.equal(validateNumeric('stale_device_seconds', 3601).ok, false);
});

test('retention is bounded at 7 days and 10 years', () => {
  assert.equal(validateNumeric('audit_retention_days', 6).ok, false);
  assert.equal(validateNumeric('audit_retention_days', 7).ok, true);
  assert.equal(validateNumeric('audit_retention_days', 3650).ok, true);
  assert.equal(validateNumeric('audit_retention_days', 3651).ok, false);
});

test('the MQTT port is bounded to a real port range', () => {
  assert.equal(validateNumeric('mqtt_broker_port', 0).ok, false);
  assert.equal(validateNumeric('mqtt_broker_port', 1).ok, true);
  assert.equal(validateNumeric('mqtt_broker_port', 65535).ok, true);
  assert.equal(validateNumeric('mqtt_broker_port', 65536).ok, false);
});

test('a blank broker host means "use the server default"', () => {
  const result = validateBrokerHost('   ');
  assert.equal(result.ok, true);
  assert.equal(result.value, null);
});

test('a plain hostname and an IP are both accepted', () => {
  assert.equal(validateBrokerHost('broker.example.com').ok, true);
  assert.equal(validateBrokerHost('192.168.1.10').ok, true);
  assert.equal(validateBrokerHost('my-broker_1.internal').ok, true);
});

test('a host carrying a scheme, credentials or a path is rejected', () => {
  // These are the strings that would put credentials into a field rendered in
  // plaintext on a settings page.
  for (const bad of [
    'mqtt://broker.example.com',
    'mqtts://user:pass@broker.example.com',
    'broker.example.com:1883',
    'broker.example.com/path',
    'broker example.com',
    'broker.example.com?x=1',
  ]) {
    assert.equal(validateBrokerHost(bad).ok, false, `should reject ${bad}`);
  }
});

test('validation reports every bad field, not just the first', () => {
  const errors = validateSettings({
    ...VALID,
    low_water_pct: 150,
    mqtt_broker_port: 99999,
    mqtt_broker_host: 'mqtt://evil',
  });

  assert.equal(errors.low_water_pct !== undefined, true);
  assert.equal(errors.mqtt_broker_port !== undefined, true);
  assert.equal(errors.mqtt_broker_host !== undefined, true);
});

test('a settings object mid-edit with string numbers still validates', () => {
  // The form holds strings in numeric inputs while typing.
  const errors = validateSettings({ ...VALID, low_water_pct: '25', mqtt_broker_port: '8883' });
  assert.equal(hasErrors(errors), false, JSON.stringify(errors));
});

test('brokerNeedsRestart compares stored against live', () => {
  assert.equal(
    brokerNeedsRestart({ host: 'a.example', port: 1883 }, { host: 'a.example', port: 1883 }),
    false,
  );
  assert.equal(
    brokerNeedsRestart({ host: 'b.example', port: 1883 }, { host: 'a.example', port: 1883 }),
    true,
    'a different host means the saved value is not the live one',
  );
  assert.equal(
    brokerNeedsRestart({ host: 'a.example', port: 8883 }, { host: 'a.example', port: 1883 }),
    true,
    'a different port means the same',
  );
});

test('the restart note names the live broker, not the stored one', () => {
  const note = pendingRestartNote({ host: 'live.example', port: 1883 });
  assert.match(note, /live\.example/);
  assert.match(note, /1883/);
  assert.match(note, /next time the bridge starts/i);
});

test('limits are exposed as plain data for the form attributes', () => {
  assert.equal(LIMITS.low_pct.min, 0);
  assert.equal(LIMITS.low_pct.max, 100);
  assert.equal(LIMITS.stale_device_seconds.min, 30);
});