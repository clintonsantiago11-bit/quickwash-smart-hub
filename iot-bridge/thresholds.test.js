const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  DEFAULT_THRESHOLDS,
  isUsableLevel,
  evaluateOne,
  evaluateLevels,
  describeBreach,
} = require('./thresholds.js');

/**
 * The settings screen exposed low-water and low-soap percentages that were
 * written to localStorage and read by nobody - no code in the repository
 * compared a tank level to a threshold. These cover the comparison that makes
 * those numbers mean something.
 */

const T = { low_water_pct: 20, low_soap_pct: 15, low_wax_pct: 15 };

test('a level comfortably above the threshold breaches nothing', () => {
  const { breaches } = evaluateLevels({ water: 80, soap_a: 70, soap_b: 70, wax: 90 }, T);
  assert.deepEqual(breaches, []);
});

test('a level below the threshold breaches', () => {
  const { breaches } = evaluateLevels({ water: 10 }, T);
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0].type, 'LOW_WATER');
  assert.equal(breaches[0].level, 10);
  assert.equal(breaches[0].threshold, 20);
});

test('a level exactly on the threshold is a breach', () => {
  // At or below, not below. A tank sitting on the configured value has not
  // been replenished, and treating it as healthy would mean the number the
  // operator set does not do what they think.
  const { breaches } = evaluateLevels({ water: 20 }, T);
  assert.equal(breaches.length, 1, 'exactly at the threshold must still alert');
});

test('a missing reading never breaches', () => {
  // The firmware omits levels it has no sensor for. `null < 20` is true in
  // JavaScript, so a naive comparison would raise a low-water alert for a tank
  // nobody is reporting on.
  for (const missing of [undefined, null, NaN, '20', '', {}]) {
    const { breaches } = evaluateLevels({ water: missing }, T);
    assert.equal(breaches.length, 0, `must ignore ${String(missing)}`);
  }
  assert.equal(isUsableLevel(null), false);
  assert.equal(isUsableLevel(42), true);
});

test('one missing tank does not suppress the others', () => {
  const { breaches } = evaluateLevels({ water: 10, soap_a: null }, T);
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0].type, 'LOW_WATER');
});

test('zero is a real reading and breaches', () => {
  const { breaches } = evaluateLevels({ water: 0 }, T);
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0].level, 0);
  assert.equal(breaches[0].severity, 'critical', 'an empty tank stops the machine');
});

test('severity is critical near empty and warning above that', () => {
  assert.equal(evaluateOne(5, 20).severity, 'critical');
  assert.equal(evaluateOne(6, 20).severity, 'warning');
  assert.equal(evaluateOne(20, 20).severity, 'warning');
});

test('both soap tanks share one LOW_SOAP alert', () => {
  // createAlert dedupes on (device, type), so two entries of the same type
  // would bump one row twice rather than describe both tanks.
  const { breaches } = evaluateLevels({ soap_a: 5, soap_b: 8 }, T);
  const soap = breaches.filter((b) => b.type === 'LOW_SOAP');
  assert.equal(soap.length, 1);
  assert.equal(soap[0].level, 5, 'the worse tank is the one reported');
});

test('only the lower soap tank is named', () => {
  const { breaches } = evaluateLevels({ soap_b: 4 }, T);
  assert.equal(breaches[0].type, 'LOW_SOAP');
  assert.equal(breaches[0].label, 'Soap tank B');
});

test('wax has its own threshold', () => {
  const { breaches } = evaluateLevels({ wax: 10 }, T);
  assert.equal(breaches[0].type, 'LOW_WAX');
  assert.equal(breaches[0].threshold, 15);
});

test('thresholds are honoured rather than hardcoded', () => {
  // Raise the threshold in the dashboard and the alert should follow it.
  const relaxed = evaluateLevels({ water: 18 }, { ...T, low_water_pct: 5 });
  assert.equal(relaxed.breaches.length, 0, '18% is fine when the threshold is 5%');

  const tightened = evaluateLevels({ water: 18 }, { ...T, low_water_pct: 30 });
  assert.equal(tightened.breaches.length, 1, 'the same reading breaches at 30%');
});

test('an out-of-range threshold is ignored rather than trusted or clamped', () => {
  // Clamping 900 to 100 would make every tank look empty and raise a flood of
  // alerts; trusting -5 would make every tank look full and silence a real
  // fault. Ignoring both keeps the previous behaviour until the row is fixed.
  assert.equal(evaluateOne(50, 900), null, 'a nonsense high threshold alerts nothing');
  assert.equal(evaluateOne(5, -20), null, 'a nonsense low threshold alerts nothing');
  assert.equal(evaluateOne(5, 20).breached, true, 'a valid threshold still works');
});

test('a non-numeric threshold is ignored, not compared against', () => {
  assert.equal(evaluateOne(10, undefined), null);
  assert.equal(evaluateOne(10, 'twenty'), null);
});

test('missing thresholds fall back to the documented defaults', () => {
  const { breaches } = evaluateLevels({ water: 12 }, {});
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0].threshold, DEFAULT_THRESHOLDS.low_water_pct);
});

test('a tank back above its threshold is reported as recoverable', () => {
  const { recoverable } = evaluateLevels({ water: 90, soap_a: 90 }, T);
  assert.ok(recoverable.includes('LOW_WATER'));
  assert.ok(recoverable.includes('LOW_SOAP'));
});

test('a tank that reports nothing is not recoverable but a reported one is', () => {
  // Wax is not in this reading, so there is no evidence it recovered.
  const { recoverable } = evaluateLevels({ water: 90 }, T);
  assert.ok(recoverable.includes('LOW_WATER'));
  assert.equal(recoverable.includes('LOW_WAX'), false, 'no reading, no recovery');
});

test('a breaching tank is NOT reported as recoverable', () => {
  // resolveAlerts clears by (device, type). If a breaching type were also
  // listed as recoverable, one reading would raise the alert and immediately
  // clear it, and the fault would blink instead of sticking.
  const { breaches, recoverable } = evaluateLevels({ water: 5, soap_a: 90 }, T);
  assert.equal(breaches[0].type, 'LOW_WATER');
  assert.equal(
    recoverable.includes('LOW_WATER'),
    false,
    'a low tank must not be cleared on the same reading that reported it',
  );
  assert.ok(recoverable.includes('LOW_SOAP'), 'the healthy tank still clears');
});

test('an unreported tank is never treated as recovered', () => {
  // No reading is not evidence of recovery, otherwise a tank that stops
  // reporting clears its own alert.
  const { recoverable } = evaluateLevels({ water: 90, soap_a: null, wax: undefined }, T);
  assert.ok(recoverable.includes('LOW_WATER'));
  assert.equal(
    recoverable.includes('LOW_SOAP'),
    false,
    'a soap tank that reported nothing has not recovered',
  );
});

test('an empty reading object produces no breaches', () => {
  const { breaches } = evaluateLevels({}, T);
  assert.deepEqual(breaches, []);
});

test('undefined levels object is handled', () => {
  const { breaches } = evaluateLevels(undefined, T);
  assert.deepEqual(breaches, []);
});

test('the alert message states the reading and the configured threshold', () => {
  // "Low water level" alone gives an operator nothing to compare against.
  const { breaches } = evaluateLevels({ water: 12 }, T);
  const message = describeBreach(breaches[0]);
  assert.match(message, /12%/);
  assert.match(message, /20%/);
  assert.match(message, /Water tank/);
});

test('multiple breaches produce one message each', () => {
  const { breaches } = evaluateLevels({ water: 1, wax: 1 }, T);
  assert.equal(breaches.length, 2);
  for (const b of breaches) {
    assert.ok(describeBreach(b).length > 10);
  }
});