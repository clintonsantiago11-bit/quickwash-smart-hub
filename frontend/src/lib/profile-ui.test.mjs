import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const page = source('../app/profile/page.tsx');
const lib = source('./profile.ts');

test('the profile page ships no invented identity or activity', () => {
  // The page used to open with a hardcoded operator and a fabricated
  // activity feed that included a fake "login from new device" alert. If the
  // API was unreachable, Save would then write those fakes over the real
  // record, so these strings must never reappear.
  for (const fake of [
    'System Administrator',
    'admin@quickwash.hub',
    '+63 912 345 6789',
    'Main Facility Manager',
    '#ADMIN-01',
    'Login from new device detected',
    'Main Terminal',
  ]) {
    assert.doesNotMatch(page, new RegExp(fake.replace(/[+#]/g, '\\$&')), `profile must not hardcode: ${fake}`);
  }

  // No static activity array either; the feed comes from the API.
  assert.doesNotMatch(page, /const activityFeed\s*=/);
  assert.doesNotMatch(page, /role:\s*'Administrator'/);
});

test('the profile reads its real data from the API', () => {
  assert.match(page, /api\.getProfile\(\)/);
  assert.match(page, /api\.getProfileActivity\(/);
  assert.match(page, /api\.updateProfile\(/);
  assert.match(page, /api\.updatePreferences\(/);
  assert.match(page, /api\.changePassword\(/);
  assert.match(page, /api\.uploadAvatar\(/);

  // The profile is loaded and the activity feed fetched in parallel, so a
  // slow activity request never delays the page becoming usable.
  assert.match(page, /toProfile\(/);
  assert.doesNotMatch(page, /await api\.getProfileActivity/);
});

test('the profile has real loading and failure states instead of a blank page', () => {
  assert.match(page, /if \(loadError\)/, 'a failed load must be reported');
  assert.match(page, /role="alert"/);
  assert.match(page, /role="status"/);
  assert.match(page, /PageSkeleton/, 'reuse the shared skeleton rather than inventing another');
  assert.doesNotMatch(page, /bg-\[var\(--bg-hover\)\]"\s*\/>/, 'no ad-hoc inline skeleton blocks');
});

test('the route is covered by a loading boundary and an error boundary', () => {
  const loading = source('../app/loading.tsx');
  const error = source('../app/error.tsx');

  assert.match(loading, /PageSkeleton/, 'navigating must not leave a blank screen');
  assert.match(loading, /role="status"|label/);

  assert.match(error, /'use client'/, 'an error boundary must be a client component');
  assert.match(error, /reset/, 'a crash must be recoverable without a full reload');
  assert.match(error, /ErrorState/);
});

test('saving is honest: no fake delay, no blocking alert, disabled until dirty', () => {
  // The old page held the spinner for a hardcoded 800ms and used window.alert.
  assert.doesNotMatch(page, /window\.alert|\balert\(/);
  assert.doesNotMatch(page, /setTimeout\(\(\) => \{\s*setIsSaving/);
  assert.match(page, /disabled=\{!dirty \|\| saving\}/);
  assert.match(page, /isDirty\(/);
});

test('every profile input is labelled and exposes its error', () => {
  // Field renders the label from its id prop, so the contract is that each
  // id is handed to <Field id=...> and the input inside repeats it.
  assert.match(page, /<label htmlFor=\{id\}/, 'Field must render a label bound to its id');
  assert.match(page, /id=\{errorId\}/);

  for (const id of ['profile-name', 'profile-email', 'profile-phone', 'profile-designation']) {
    assert.match(page, new RegExp(`<Field id="${id}"`), `missing Field for: ${id}`);
    assert.match(page, new RegExp(`id="${id}"`), `missing input: ${id}`);
  }

  for (const id of ['current-password', 'new-password']) {
    assert.match(page, new RegExp(`<Field id="${id}"`), `password field must be labelled: ${id}`);
  }
  assert.match(page, /id="confirm-password"/);

  assert.match(page, /aria-invalid=/);
  assert.match(page, /aria-describedby=/);
  assert.match(page, /aria-label="Change profile photo"/);
});

test('the pure profile logic carries the rules, not the page', () => {
  for (const fn of ['validateDraft', 'isDirty', 'passwordStrength', 'validateAvatar', 'fieldErrorsFrom', 'relativeTime', 'initials', 'roleLabel']) {
    assert.match(lib, new RegExp(`export function ${fn}\\b`), `lib/profile.ts must export ${fn}`);
    assert.match(page, new RegExp(`\\b${fn}\\b`), `the page should use ${fn}`);
  }
});
