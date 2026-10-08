import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const idle = source('../components/IdleLogout.tsx');
const login = source('../app/login/page.tsx');
const layout = source('../app/layout.tsx');

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

test('the local session is cleared before the sign-out waits on the network', () => {
  const signOut = idle.slice(idle.indexOf('const signOut ='), idle.indexOf('const dismissWarning'));

  const clearToken = signOut.indexOf('api.setToken(null)');
  const clearCookie = signOut.indexOf('qhs_session=; Max-Age=0');
  const serverCall = signOut.indexOf('api.logout()');
  const navigate = signOut.indexOf('router.push(');

  assert.ok(clearToken > -1, 'the token must be cleared');
  assert.ok(clearCookie > -1, 'the session cookie must be cleared');
  assert.ok(clearToken < serverCall, 'clear the token before telling the server');
  assert.ok(clearCookie < serverCall, 'clear the cookie before telling the server');
  assert.ok(serverCall < navigate, 'navigate without waiting on the server round trip');
  assert.match(signOut, /void api\.logout\(\)/, 'the server call must not be awaited');
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
