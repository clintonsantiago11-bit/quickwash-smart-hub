import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSupplies, resolveBayStatus, naekLastCycle } from './dashboard.ts';

test('normalizeSupplies drops the Wax Tank and keeps only the real gauges', () => {
  const result = normalizeSupplies([
    { label: 'Water Tank', level: 80 },
    { label: 'Soap Tank A', level: 50 },
    { label: 'Soap Tank B', level: null },
    { label: 'Wax Tank', level: 42 },
  ]);
  assert.deepEqual(result.map((s) => s.label), ['Water Tank', 'Soap Tank A', 'Soap Tank B']);
  assert.deepEqual(result.map((s) => s.level), [80, 50, null]);
  assert.ok(result.every((s) => /^#[0-9A-Fa-f]{6}$/.test(s.color)), 'each gauge keeps its own fixed colour');
});

test('normalizeSupplies reports missing levels as null instead of inventing values', () => {
  assert.deepEqual(normalizeSupplies(undefined).map((s) => s.level), [null, null, null]);
  assert.deepEqual(normalizeSupplies([]).map((s) => s.label), ['Water Tank', 'Soap Tank A', 'Soap Tank B']);
});

test('resolveBayStatus shows available when only the NAEK timer is live', () => {
  assert.deepEqual(
    resolveBayStatus({ esp32Status: null, naekOnline: true }),
    { status: 'available', hasStatus: true, online: true },
  );
});

test('resolveBayStatus shows active while the wash controller reports a cycle', () => {
  const result = resolveBayStatus({ esp32Status: 'active', naekOnline: true });
  assert.equal(result.status, 'active');
  assert.equal(result.hasStatus, true);
  assert.equal(result.online, true);
});

test('a jam reported by the wash controller outranks NAEK liveness', () => {
  const result = resolveBayStatus({ esp32Status: 'error', naekOnline: true });
  assert.equal(result.status, 'error');
  assert.equal(result.hasStatus, true);
});

test('with no live machine the card stays unknown instead of guessing', () => {
  assert.deepEqual(
    resolveBayStatus({ esp32Status: null, naekOnline: false }),
    { status: 'available', hasStatus: false, online: false },
  );
});

test('naekLastCycle names the cycle the machine ran and ignores other events', () => {
  assert.equal(naekLastCycle([{ type: 'sales_reset' }]), null);
  assert.equal(naekLastCycle([{ type: 'sale', product: 'Regular Wash' }]), 'Regular Wash');
});
