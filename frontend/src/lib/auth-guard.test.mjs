import assert from 'node:assert/strict';
import { test } from 'node:test';

// These guard against the same class of bug twice. The auth guard once read
// `localStorage.getItem('isAuthenticated')` and used it as a boolean, but what
// is actually stored is the string 'false' - truthy - so the redirect to
// /login never fired and the guard was decorative. The assertions below are
// written against behaviour, not against source text, so a future refactor
// cannot quietly reintroduce it.

/** Mirror of the storage contract in src/lib/api.ts. */
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

function installGlobals() {
  const local = makeStorage();
  const session = makeStorage();
  globalThis.window = { localStorage: local, sessionStorage: session };
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  return { local, session };
}

test("a stored token in sessionStorage alone counts as signed in", async () => {
  const { session } = installGlobals();
  session.setItem('auth_token', 't');

  const { hasStoredSession } = await import('./api.ts');
  assert.equal(hasStoredSession(), true, 'default sessions live in sessionStorage');
});

test('a stored token in localStorage counts as signed in', () => {
  const { local } = installGlobals();
  local.setItem('auth_token', 't');
  return import('./api.ts').then(({ hasStoredSession }) => {
    assert.equal(hasStoredSession(), true);
  });
});

test('no token at all is not a session', async () => {
  installGlobals();
  const { hasStoredSession } = await import('./api.ts');
  assert.equal(hasStoredSession(), false);
});

test('the isAuthenticated flag alone never implies a session', async () => {
  const { local } = installGlobals();
  local.setItem('isAuthenticated', 'false');

  const { hasStoredSession } = await import('./api.ts');
  assert.equal(
    hasStoredSession(),
    false,
    'the string "false" is truthy, so gating on this flag is how the guard broke',
  );
});

test('the flag is not consulted even when it says true', async () => {
  const { local } = installGlobals();
  local.setItem('isAuthenticated', 'true');
  local.setItem('auth_token', 't');
  const { hasStoredSession } = await import('./api.ts');
  assert.equal(hasStoredSession(), true, 'token present: signed in');

  // Token revoked but flag left behind - the token is the source of truth.
  local.removeItem('auth_token');
  const again = await import('./api.ts');
  assert.equal(
    again.hasStoredSession(),
    false,
    'a stale flag must not be able to claim a session that has gone',
  );
});