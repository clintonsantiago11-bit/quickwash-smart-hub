import assert from 'node:assert/strict';
import { test } from 'node:test';

// Set before importing, because camera-session reads the secret at call time
// rather than at module load - but keep it out of the shared env so a
// forgotten value cannot silently make verify() permissive.
process.env.CAMERA_SESSION_SECRET = 'test-secret-not-a-real-one';

const { mint, verify, readCookie, ttlMinutes } = await import('./camera-session.ts');

const VALID = mint({ uid: 7, role: 'admin' });

test('a freshly minted cookie verifies', () => {
  const session = verify(VALID);
  assert.equal(session.uid, 7);
  assert.equal(session.role, 'admin');
  assert.ok(session.exp * 1000 > Date.now());
});

test('the cookie is a signed three-part v1 value, not a bare marker', () => {
  const parts = VALID.split('.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'v1');
  // The old gate accepted any non-empty value; the payload is now readable but
  // useless to forge without the secret.
  assert.notEqual(parts[1], '1');
});

test('the legacy forged cookie does not verify', () => {
  // This is the exact value the old cookie-presence check accepted.
  assert.equal(verify('1'), null);
  assert.equal(verify('qhs_session=1'), null);
});

test('a tampered payload is rejected', () => {
  const parts = VALID.split('.');
  const forged = Buffer.from(
    JSON.stringify({ uid: 1, role: 'admin', exp: Math.floor(Date.now() / 1000) + 9999 })
  ).toString('base64url');
  assert.equal(verify(`${parts[0]}.${forged}.${parts[2]}`), null);
});

test('a tampered signature is rejected', () => {
  const parts = VALID.split('.');
  const flipped = parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A');
  assert.equal(verify(`${parts[0]}.${parts[1]}.${flipped}`), null);
});

test('payloads swapped between cookies are rejected', () => {
  const other = mint({ uid: 99, role: 'technician' });
  const a = VALID.split('.');
  const b = other.split('.');
  assert.equal(verify(`${a[0]}.${b[1]}.${a[2]}`), null);
});

test('malformed values are rejected without throwing', () => {
  for (const bad of ['', '.', '..', 'v1', 'v1.a', 'v1.a.b.c', 'v2.a.b', 'notacookie']) {
    assert.equal(verify(bad), null, `should reject: ${JSON.stringify(bad)}`);
  }
});

test('a non-JSON payload is rejected', () => {
  assert.equal(verify(`v1.${Buffer.from('not json').toString('base64url')}.sig`), null);
});

test('an expired cookie is rejected', () => {
  // mint() computes exp from now + ttl, so a negative-ish ttl gives an already
  // expired value without reaching into the implementation.
  const expired = mint({ uid: 7, role: 'admin' }, -60);
  assert.equal(verify(expired), null);
});

test('verify fails closed when the secret is unset', () => {
  const saved = process.env.CAMERA_SESSION_SECRET;
  delete process.env.CAMERA_SESSION_SECRET;
  try {
    assert.equal(verify(VALID), null, 'an unconfigured deployment must serve nobody');
  } finally {
    process.env.CAMERA_SESSION_SECRET = saved;
  }
});

test('a cookie signed with a different secret is rejected', () => {
  const saved = process.env.CAMERA_SESSION_SECRET;
  process.env.CAMERA_SESSION_SECRET = 'a-completely-different-secret';
  try {
    assert.equal(verify(VALID), null);
  } finally {
    process.env.CAMERA_SESSION_SECRET = saved;
  }
});

test('readCookie pulls the value out of a Cookie header', () => {
  const req = new Request('http://x/', { headers: { cookie: 'other=1; qhs_session=' + VALID + '; z=2' } });
  assert.equal(readCookie(req, 'qhs_session'), VALID);
});

test('readCookie returns undefined when absent or empty', () => {
  assert.equal(readCookie(new Request('http://x/'), 'qhs_session'), undefined);
  assert.equal(
    readCookie(new Request('http://x/', { headers: { cookie: 'other=1' } }), 'qhs_session'),
    undefined
  );
});

test('ttlMinutes prefers a valid override and ignores nonsense', () => {
  const saved = process.env.CAMERA_SESSION_TTL_MINUTES;
  try {
    process.env.CAMERA_SESSION_TTL_MINUTES = '60';
    assert.equal(ttlMinutes(), 60);
    process.env.CAMERA_SESSION_TTL_MINUTES = 'soon';
    assert.equal(ttlMinutes(), 480);
    process.env.CAMERA_SESSION_TTL_MINUTES = '-5';
    assert.equal(ttlMinutes(), 480);
  } finally {
    if (saved === undefined) delete process.env.CAMERA_SESSION_TTL_MINUTES;
    else process.env.CAMERA_SESSION_TTL_MINUTES = saved;
  }
});