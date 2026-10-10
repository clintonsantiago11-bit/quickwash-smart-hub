import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  activityLabel,
  fieldErrorsFrom,
  initials,
  isDirty,
  LIMITS,
  memberSince,
  isPasswordComplete,
  MAX_AVATAR_BYTES,
  passwordProblems,
  passwordStrength,
  relativeTime,
  roleLabel,
  toDraft,
  toPayload,
  toProfile,
  validateAvatar,
  validateDraft,
} from './profile.ts';

test('a sparse API response is filled in rather than leaving holes', () => {
  const p = toProfile({ full_name: 'Clint Santiago', email: 'clint@quickwash.com' });
  assert.equal(p.full_name, 'Clint Santiago');
  assert.equal(p.timezone, 'Asia/Manila');
  assert.equal(p.is_dark_mode, true);
  assert.equal(p.avatar_url, null);
});

test('a missing profile falls back to empty defaults, never invented values', () => {
  const p = toProfile(null);
  assert.equal(p.full_name, '');
  assert.equal(p.email, '');
  assert.equal(p.username, '');
});

test('null text columns come back as empty strings for editing', () => {
  const draft = toDraft(toProfile({ full_name: 'A B', phone: null, designation: null }));
  assert.equal(draft.phone, '');
  assert.equal(draft.designation, '');
});

test('the payload trims, lowercases the email, and sends no other column', () => {
  const payload = toPayload({
    full_name: '  Clint Santiago  ',
    email: '  Clint@QuickWash.com ',
    phone: ' +63 912 345 6789 ',
    designation: ' Owner ',
  });
  assert.deepEqual(payload, {
    full_name: 'Clint Santiago',
    email: 'clint@quickwash.com',
    phone: '+63 912 345 6789',
    designation: 'Owner',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['designation', 'email', 'full_name', 'phone']);
});

test('saving is only dirty when something actually changed', () => {
  const saved = toDraft(toProfile({ full_name: 'Clint', email: 'c@q.com', phone: null, designation: 'Owner' }));
  assert.equal(isDirty(saved, saved), false);
  assert.equal(isDirty({ ...saved, full_name: 'Clint ' }, saved), false, 'whitespace is not a change');
  assert.equal(isDirty({ ...saved, email: 'C@Q.com' }, saved), false, 'email case is not a change');
  assert.equal(isDirty({ ...saved, phone: '0912' }, saved), true);
});

test('draft validation mirrors the server rules', () => {
  const base = { full_name: 'Clint Santiago', email: 'clint@q.com', phone: '', designation: '' };
  assert.deepEqual(validateDraft(base), {});

  assert.match(validateDraft({ ...base, full_name: '' }).full_name, /full name/i);
  assert.match(validateDraft({ ...base, email: 'nope' }).email, /valid email/i);
  assert.match(validateDraft({ ...base, phone: 'abc<script>' }).phone, /phone/i);
  assert.equal(validateDraft({ ...base, phone: '+63 912 345 6789' }).phone, undefined);
});

test('password problems list exactly what is missing', () => {
  assert.deepEqual(passwordProblems('', ''), ['At least 8 characters', 'An uppercase letter', 'A lowercase letter', 'A number']);

  const almost = passwordProblems('Brandnew1', 'Brandnew2');
  assert.ok(almost.includes('The two entries match'));

  assert.deepEqual(passwordProblems('BrandNew1', 'BrandNew1'), []);
  assert.equal(isPasswordComplete('BrandNew1', 'BrandNew1'), true);
  assert.equal(isPasswordComplete('short1A', 'short1A'), false);
});

test('password strength never promises a strong score for a weak password', () => {
  assert.equal(passwordStrength('').score, 0);
  assert.equal(passwordStrength('abc').score, 0, 'too short stays at zero');
  assert.ok(passwordStrength('password').score <= 1);
  assert.equal(passwordStrength('Str0ng!Passphrase#2026').score, 4);
});

test('avatar uploads are rejected before they start for the wrong type or size', () => {
  // Plain objects: these run under node --experimental-strip-types, which
  // only strips types from .ts files, so no `as File` assertions in here.
  assert.equal(validateAvatar({ type: 'image/png', size: 1000 }), null);

  assert.match(validateAvatar({ type: 'application/pdf', size: 1000 }), /JPG, PNG or WebP/);
  assert.match(validateAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 }), /under 2 MB/);
});

test('roles are labelled for display, never shown as the raw enum', () => {
  assert.equal(roleLabel('admin'), 'Administrator');
  assert.equal(roleLabel('manager'), 'Facility Manager');
  assert.equal(roleLabel('technician'), 'Technician');
  assert.equal(roleLabel(null), 'Unknown');
});

test('activity is labelled, and unknown actions are passed through', () => {
  assert.equal(activityLabel('LOGIN'), 'Signed in');
  assert.equal(activityLabel('CHANGE_PASSWORD'), 'Password changed');
  assert.equal(activityLabel('SOMETHING_NEW'), 'SOMETHING_NEW');
});

test('relative time is honest about never and about old dates', () => {
  assert.equal(relativeTime(null), 'Never');
  assert.equal(relativeTime('not-a-date'), 'Unknown');

  const now = new Date('2026-03-10T12:00:00Z').getTime();
  assert.equal(relativeTime('2026-03-10T11:59:30Z', now), 'Just now');
  assert.equal(relativeTime('2026-03-10T11:30:00Z', now), '30m ago');
  assert.equal(relativeTime('2026-03-10T09:00:00Z', now), '3h ago');
  assert.equal(relativeTime('2026-03-08T12:00:00Z', now), '2d ago');
  assert.notEqual(relativeTime('2026-01-01T12:00:00Z', now), '0d ago', 'older than a week shows a date');
});

test('a join date never reads "Never", which would be nonsense', () => {
  assert.equal(memberSince(null), '—');
  assert.equal(memberSince('not-a-date'), '—');
  const joined = memberSince('2026-01-15T00:00:00Z');
  assert.match(joined, /2026/);
  assert.notEqual(joined, 'Never');
});

test('initials fall back sensibly for short and empty names', () => {
  assert.equal(initials('Clint Santiago'), 'CS');
  assert.equal(initials('Clint'), 'CL');
  assert.equal(initials('  '), '?');
  assert.equal(initials(null), '?');
});

test('a Laravel 422 becomes one readable message per field', () => {
  const err = { body: { errors: { email: ['That email address is already in use.'], phone: [] } } };
  const errors = fieldErrorsFrom(err);
  assert.equal(errors.email, 'That email address is already in use.');
  assert.equal(errors.phone, undefined, 'an empty message list is dropped');
  assert.deepEqual(fieldErrorsFrom(new Error('network')), {});
  assert.deepEqual(fieldErrorsFrom(null), {});
});

/**
 * fieldErrorsFrom reads `error.body`, so the throw site has to provide it.
 *
 * api.ts attached only `status`, so every validation failure collapsed into one
 * generic banner with no field marked - the helper existed, looked correct, and
 * was always handed undefined. Verified by running both halves: a thrown error
 * with status but no body yields {}.
 */
test('the error api.ts throws carries the 422 body, not just the status', async () => {
  const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

  // Find the throw that follows the !res.ok branch, rather than asserting on a
// fixed character window - the comments around it move and would make the
// window a fragile thing to maintain.
const branchStart = apiSource.indexOf('if (!res.ok)');
const throwStatement = apiSource
    .slice(branchStart)
    .match(/throw[\s\S]*?;/)?.[0] ?? '';

assert.match(
  throwStatement,
  /throw Object\.assign\(\s*new Error\(message\),\s*\{[^}]*\bbody\b/,
  'the thrown error must carry body, or fieldErrorsFrom can never read a 422',
);
assert.match(
  throwStatement,
  /status: res\.status/,
  'the status must still be carried so callers can tell 403 from 500',
);
});

test('a length that the server would reject is caught before the round trip', () => {
  // These mirror UpdateProfileRequest. Each of these passed validation before
  // the ceilings were added and returned a 422.
  const over = (patch) => ({ full_name: 'Ana Reyes', email: 'ana@example.com', phone: '', designation: '', ...patch });

  const longPhone = validateDraft(over({ phone: '+63 1234567890123456789' }));
  assert.match(longPhone.phone ?? '', /20/, 'a phone over 20 characters must be rejected');

  const longName = validateDraft(over({ full_name: 'x'.repeat(101) }));
  assert.ok(longName.full_name, 'a name over 100 characters must be rejected');

  const longEmail = validateDraft(over({ email: 'a'.repeat(95) + '@example.com' }));
  assert.ok(longEmail.email, 'an email over 100 characters must be rejected');

  const longDesignation = validateDraft(over({ designation: 'd'.repeat(101) }));
  assert.ok(longDesignation.designation, 'a designation over 100 characters must be rejected');
});

test('values at the limit are still accepted', () => {
  // An off-by-one here would block a legitimate edit, which is worse than the
  // 422 it was meant to avoid.
  const ok = validateDraft({
    full_name: 'x'.repeat(LIMITS.full_name.max),
    email: 'a'.repeat(LIMITS.email.max - 13) + '@example.com',
    phone: '+63 1234567890',
    designation: 'd'.repeat(LIMITS.designation.max),
  });
  assert.deepEqual(ok, {}, JSON.stringify(ok));
  assert.ok('+63 1234567890'.length <= LIMITS.phone.max);
});

test('designation is still clearable and still validated', () => {
  const base = { full_name: 'Ana Reyes', email: 'ana@example.com', phone: '' };
  assert.deepEqual(validateDraft({ ...base, designation: '' }), {});
  assert.ok(validateDraft({ ...base, designation: 'd'.repeat(101) }).designation);
});
