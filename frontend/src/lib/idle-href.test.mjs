import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearIdleSignInHref,
  idleSignInHref,
  isIdleSignIn,
} from './idle.ts';

test('an idle sign-out links to the sign-in page with the reason attached', () => {
  const href = idleSignInHref();
  assert.match(href, /^\/login\?/);
  assert.ok(isIdleSignIn(href.slice(href.indexOf('?'))), 'the reason must survive the link');
});

test('the notice is only shown for an idle sign-out', () => {
  assert.equal(isIdleSignIn('?reason=idle'), true);
  assert.equal(isIdleSignIn('?reason=expired'), false);
  assert.equal(isIdleSignIn(''), false);
  assert.equal(isIdleSignIn('?next=/devices'), false);
});

test('closing the notice returns a clean sign-in URL', () => {
  assert.equal(clearIdleSignInHref(), '/login');
  // After closing, reloading must not bring the notice back.
  assert.equal(isIdleSignIn(clearIdleSignInHref()), false);
});
