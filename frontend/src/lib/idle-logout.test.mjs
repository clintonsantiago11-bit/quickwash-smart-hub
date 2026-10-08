import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const idle = source('../components/IdleLogout.tsx');
const login = source('../app/login/page.tsx');
const layout = source('../app/layout.tsx');
const api = source('./api.ts');

/**
 * The reported bug: after an idle sign-out the page went dead. The URL was
 * already /login and the "Signing you out" overlay was still covering it,
 * swallowing every click until the browser was refreshed.
 *
 * The cause was a one-way latch. This component lives in the root layout, so
 * it survives navigation; `signingOut` was set to true and never back to
 * false, and the render guard could therefore never return null again.
 */
test('the idle watcher renders nothing on the sign-in page', () => {
  assert.match(idle, /if \(pathname === '\/login'\) return null;/);
  assert.match(
    idle,
    /if \(remaining === null && !signingOut\) return null;/,
    'the guard must still hide the overlay when there is nothing to report',
  );
});

test('the overlay cannot be left stranded by a one-way latch', () => {
  // A keyed remount gives a fresh set of latches whenever the route changes,
  // so a completed sign-out cannot survive into the next page.
  assert.match(idle, /return <IdleWatcher key=\{pathname\} \/>;/);
  assert.doesNotMatch(
    idle,
    /if \(signingOutRef\.current\) return;[\s\S]{0,120}setSigningOut\(false\)/,
    'state must not be cleared from inside the sign-out path itself',
  );
});

test('the local session is cleared without waiting on the network', () => {
  const signOut = idle.slice(idle.indexOf('const signOut ='), idle.indexOf('const dismissWarning'));

  const revoke = signOut.indexOf('api.logout()');
  const clearToken = signOut.indexOf('api.setToken(null)');
  const clearCookie = signOut.indexOf('qhs_session=; Max-Age=0');
  const navigate = signOut.indexOf('router.push(');

  assert.ok(clearToken > -1, 'the token must be cleared');
  assert.ok(clearCookie > -1, 'the session cookie must be cleared');

  // logout() reads the token synchronously when it is called, so it has to be
  // called before the token is cleared or the request goes out unauthorised
  // and the server row is never revoked.
  assert.ok(revoke < clearToken, 'the revocation must start before the token is cleared');
  assert.ok(clearToken < navigate, 'the session is cleared before navigating');
  assert.match(signOut, /\.catch\(\(\) => undefined\)/, 'the revocation must not be awaited');
  assert.doesNotMatch(signOut, /await api\.logout\(\)/, 'awaiting it is what made the overlay hang');
});

test('sign-out actually sends the token so the server can revoke it', () => {
  // The regression: reading the token from the client after it had been cleared
  // meant a 401 that was swallowed, leaving the row valid for eight hours.
  assert.match(api, /const token = this\.getToken\(\);/);
  assert.match(api, /explicitToken: token/);
  assert.match(api, /const token = opts\.explicitToken !== undefined \? opts\.explicitToken : this\.token;/);
});

test('the sign-in page explains an idle sign-out and offers a way to close it', () => {
  assert.match(login, /isIdleSignIn\(searchParams\.toString\(\)\)/);
  assert.match(login, /Signed out after 5 minutes of inactivity/);
  assert.match(login, /aria-label="Dismiss this notice"/);
  assert.match(login, /clearIdleSignInHref\(\)/);
  assert.match(login, /onClick=\{dismissTimedOutNotice\}/);
});

test('the idle timer does not run on the sign-in page', () => {
  assert.match(layout, /<IdleLogout \/>/, 'the watcher stays mounted in the root layout');
  // The outer component returns early, so the inner timer and activity
  // listeners never mount on the sign-in page.
  const outer = idle.slice(
    idle.indexOf('export default function IdleLogout'),
    idle.indexOf('function IdleWatcher'),
  );
  assert.match(outer, /if \(pathname === '\/login'\) return null;/);
  assert.doesNotMatch(outer, /setInterval\(/, 'the one-second timer must not run while signed out');
  assert.doesNotMatch(outer, /addEventListener/, 'input tracking must not run while signed out');
});
