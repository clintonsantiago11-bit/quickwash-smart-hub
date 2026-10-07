import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  greeting,
  greetingName,
  isReturningVisitor,
  roleLabel,
  welcomeDetail,
  WELCOME_MS,
} from './welcome.ts';

test('a browser that has signed in before gets the returning greeting', () => {
  assert.equal(isReturningVisitor('2026-10-01T09:00:00Z'), true);
  assert.equal(greeting('Clint Santiago', true), 'Welcome back, Clint Santiago');
});

test('a browser signing in for the first time gets a plain welcome', () => {
  assert.equal(isReturningVisitor(null), false);
  assert.equal(isReturningVisitor(''), false);
  assert.equal(isReturningVisitor('not-a-date'), false, 'a corrupt value must not read as returning');
  assert.equal(greeting('Clint Santiago', false), 'Welcome, Clint Santiago');
});

test('the greeting never renders a blank name', () => {
  assert.equal(greetingName({ full_name: 'Clint Santiago' }), 'Clint Santiago');
  assert.equal(greetingName({ full_name: '   ' }), 'Operator', 'whitespace is not a name');
  assert.equal(greetingName({ full_name: null, username: 'clint' }), 'clint');
  assert.equal(greetingName(null), 'Operator');
  assert.equal(greetingName({}), 'Operator');
});

test('roles read as words, never as the raw enum', () => {
  assert.equal(roleLabel('admin'), 'Administrator');
  assert.equal(roleLabel('manager'), 'Facility Manager');
  assert.equal(roleLabel('technician'), 'Technician');
  assert.equal(roleLabel('something-new'), 'Operator', 'an unknown role falls back rather than leaking');
  assert.equal(roleLabel(null), 'Operator');
});

test('the detail line names who is signed in and where, on a shared terminal', () => {
  assert.equal(
    welcomeDetail({ role: 'admin', facility_name: 'QuickWash Main Facility' }),
    'Signed in as Administrator at QuickWash Main Facility.',
  );
  assert.equal(welcomeDetail({ role: 'manager', facility_name: null }), 'Signed in as Facility Manager.');
  assert.equal(welcomeDetail(null), 'Signed in as Operator.');
});

test('the greeting is shown long enough to read before the redirect', () => {
  assert.ok(WELCOME_MS >= 1200, 'under 1.2s is too fast to read a name');
  assert.ok(WELCOME_MS <= 3000, 'long enough to start feeling like a stall');
});