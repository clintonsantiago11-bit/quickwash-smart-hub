import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');

/**
 * The live policy carried `https://quickwash-api.onrender.com/api%0A`: a
 * trailing newline in a dashboard env var survived the slash strip, produced a
 * source expression that could never match, and the header ended in
 * "https: wss:" so the wildcards quietly carried every request instead.
 */
test('a configured origin is trimmed before it becomes a CSP source', () => {
  assert.match(config, /url\.trim\(\)/, 'the env value must be trimmed');
  // Whitespace has to go before the slash strip, or it survives it.
  const trim = config.indexOf('url.trim()');
  const slashes = config.indexOf('replace(/\\/+$/');
  assert.ok(trim > -1 && slashes > trim, 'trim must run before the trailing-slash strip');
});

test('origins are validated rather than trusted, so a bad value is dropped', () => {
  assert.match(config, /new URL\(cleaned\)/);
  assert.match(config, /catch \{\s*return null;/, 'an unparseable value must be dropped, not emitted');
  assert.match(config, /return `\$\{parsed\.protocol\}\/\/\$\{parsed\.host\}`/, 'only the origin is emitted');
});

test('the production policy carries no wildcard source', () => {
  // script-src is a ternary: the dev arm may keep unsafe-eval, the production
  // arm must not. Asserting on a bare literal would just match whichever came
  // first in the file.
  assert.match(config, /isDev\s*\n?\s*\?\s*"script-src [^"]*"\s*\n?\s*:\s*"script-src [^"]*"/);

  const arms = config.match(/script-src 'self'[^"]*/g) ?? [];
  const production = arms.filter((a) => !a.includes('unsafe-eval'));
  assert.equal(production.length, 1, `expected exactly one clean production script-src, got ${production.length}`);
  assert.doesNotMatch(production[0], /unsafe-eval/, 'unsafe-eval must not reach production');
  assert.equal(arms.filter((a) => a.includes('unsafe-eval')).length, 1, 'only the dev arm may use unsafe-eval');

  // Bare "https:" or "wss:" anywhere in a source list is the exfiltration
  // channel: with the token in localStorage, any injected script can post it
  // to any host on the internet.
  for (const directive of ['img-src', 'connect-src']) {
    const line = config.match(new RegExp(`\\\`${directive}[^\`]*\\\``));
    assert.ok(line, `${directive} must be built`);
    assert.doesNotMatch(line[0], /(?<![\w-])https:(?![\w-])/, `${directive} must not allow any https origin`);
    assert.doesNotMatch(line[0], /(?<![\w-])wss:(?![\w-])/, `${directive} must not allow any wss origin`);
  }
});

test('both the http and ws form of a configured origin are allowed', () => {
  // A WebSocket is matched by its ws:// scheme, so naming only the http one
  // breaks a live feed while ordinary calls keep working.
  assert.match(config, /withSocketForm/);
  assert.match(config, /replace\(\/\^http/, 'http origins must be expanded to their ws form');
});

test('the hardening headers are present', () => {
  for (const header of [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
  ]) {
    assert.match(config, new RegExp(header), `missing header: ${header}`);
  }
  assert.match(config, /"frame-ancestors 'none'"/);
  assert.match(config, /"object-src 'none'"/);
});

test('polling pauses on a hidden tab across every polling page', () => {
  const polling = readFileSync(new URL('./usePolling.ts', import.meta.url), 'utf8');
  assert.match(polling, /document\.hidden/, 'the interval must know when the tab is hidden');
  assert.match(polling, /visibilitychange/);

  for (const page of ['devices', 'vending', 'alerts', 'audit']) {
    const source = readFileSync(new URL(`../app/${page}/page.tsx`, import.meta.url), 'utf8');
    assert.match(source, /usePolling\(/, `${page} should use the shared polling hook`);
    // A raw interval would keep hitting the API from a tab nobody is reading.
    assert.doesNotMatch(source, /setInterval\(/, `${page} should not keep its own raw interval`);
  }
});
