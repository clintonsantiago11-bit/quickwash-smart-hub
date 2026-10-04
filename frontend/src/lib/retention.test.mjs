import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  retentionMessage,
  retentionTitle,
  retentionUrgency,
  shouldWarnAboutRetention,
} from './retention.ts';

const base = {
  retention_days: 90,
  cutoff_at: '2026-06-01T00:00:00+08:00',
  warn_at: '2026-06-08T00:00:00+08:00',
  days_until_delete: 5,
  expiring_count: 1200,
  approaching_count: 400,
  warn_days_before_delete: 7,
};

test('a warning is only shown when something is actually at stake', () => {
  assert.equal(shouldWarnAboutRetention(null), false);
  assert.equal(shouldWarnAboutRetention({ ...base, expiring_count: 0, approaching_count: 0 }), false);
  assert.equal(shouldWarnAboutRetention({ ...base, approaching_count: 0 }), true);
  assert.equal(shouldWarnAboutRetention({ ...base, expiring_count: 0 }), true);
});

test('urgency escalates as the deletion date closes in', () => {
  assert.equal(retentionUrgency({ ...base, days_until_delete: 5 }), 'soon');
  assert.equal(retentionUrgency({ ...base, days_until_delete: 1 }), 'urgent');
  assert.equal(retentionUrgency({ ...base, expiring_count: 0 }), 'none');
});

test('the message always says deletion cannot be recovered', () => {
  for (const preview of [
    base,
    { ...base, days_until_delete: 1 },
    { ...base, expiring_count: 0 },
  ]) {
    assert.match(
      retentionMessage(preview),
      /cannot be recovered/,
      'every warning must state the deletion is permanent',
    );
  }
});

test('an urgent warning leads with the count that is about to be deleted', () => {
  const message = retentionMessage({ ...base, days_until_delete: 1 });
  assert.match(message, /next automatic cleanup/);
  assert.match(message, /1,200 records/);
  assert.equal(retentionTitle({ ...base, days_until_delete: 1 }), 'Audit records being deleted');
});

test('a non-urgent warning says how many days remain and mentions the next batch', () => {
  const message = retentionMessage(base);
  assert.match(message, /within 5 days/);
  assert.match(message, /1,200 records/);
  assert.match(message, /400 records will follow/);
  assert.equal(retentionTitle(base), 'Audit records approaching deletion');
});

test('with nothing expiring yet it only warns about what is coming', () => {
  const message = retentionMessage({ ...base, expiring_count: 0 });
  assert.match(message, /400 records will pass the 90-day retention window/);
  assert.doesNotMatch(message, /1,200/);
  assert.doesNotMatch(message, /90 days/, 'the window should read as an adjective');
  assert.equal(retentionTitle({ ...base, expiring_count: 0 }), 'Audit retention');
});

test('singular and plural counts read properly', () => {
  assert.match(retentionMessage({ ...base, expiring_count: 1, days_until_delete: 1 }), /1 record will be/);
  assert.match(retentionMessage({ ...base, expiring_count: 2, days_until_delete: 1 }), /2 records will be/);
  assert.match(retentionMessage({ ...base, retention_days: 1, expiring_count: 0 }), /1-day retention window/);
});

test('an unparseable cutoff does not produce "Invalid Date"', () => {
  const message = retentionMessage({ ...base, cutoff_at: 'not-a-date' });
  assert.doesNotMatch(message, /Invalid Date/);
  assert.match(message, /retention cutoff/);
});