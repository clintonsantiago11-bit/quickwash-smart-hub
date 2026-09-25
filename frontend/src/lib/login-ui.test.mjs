import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('login uses plain product copy without fake coin-terminal language', () => {
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');

  for (const copy of ['Email', 'Password', 'Remember email', 'Sign in']) {
    assert.match(form, new RegExp(`>\\s*${copy}\\s*<`), `expected form copy: ${copy}`);
  }

  const loginUi = `${page}\n${form}`;
  assert.match(form, /phase/);
  assert.doesNotMatch(loginUi, />\s*valid\s*</, 'unexpected login copy: valid');
  for (const removed of [
    'Operator Email',
    'Password Access',
    'Forgot Key?',
    'INSERT COIN',
    'CoinMech',
    'Faceplate',
    'Droplets',
  ]) {
    assert.doesNotMatch(loginUi, new RegExp(removed.replace('?', '\\?')), `unexpected login copy: ${removed}`);
  }
});

test('coin-slot feedback maps credential attempts to insert, authenticate, jam, and accept states', () => {
  const auth = source('./auth.ts');
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');
  const feedback = source('../components/login/CoinSlotFeedback.tsx');
  const styles = source('../app/globals.css');
  const loginFeedback = `${form}\n${feedback}`;

  for (const phase of ['inserting', 'authenticating', 'jam', 'success', 'error']) {
    assert.match(auth, new RegExp(`['"]${phase}['"]`));
  }

  assert.match(page, /setPhase\('inserting'\)/);
  assert.match(page, /setPhase\('authenticating'\)/);
  assert.match(page, /kind === 'credentials' \? 'jam' : 'error'/);
  assert.match(form, /CoinSlotFeedback/);
  assert.match(form, /phase=\{phase\}/);
  assert.doesNotMatch(form, /login-spinner/);

  for (const copy of ['Inserting credential', 'Authenticating', 'Coin jammed', 'Coin accepted', 'Sign-in unavailable']) {
    assert.match(loginFeedback, new RegExp(copy));
  }

  for (const animation of ['login-coin-drop', 'login-coin-scan', 'login-coin-jam']) {
    assert.match(styles, new RegExp(animation));
  }
  assert.match(styles, /prefers-reduced-motion/);
});

test('QuickWash branding uses the supplied PNG without SVG wrappers', () => {
  const mark = source('../components/QuickWashMark.tsx');
  const page = source('../app/login/page.tsx');
  const sidebar = source('../components/Sidebar.tsx');
  const appRoot = new URL('../app/', import.meta.url);
  const publicRoot = new URL('../../public/', import.meta.url);

  assert.match(mark, /import Image from 'next\/image'/);
  assert.match(mark, /src="\/vendologo\.png"/);
  assert.match(mark, /alt=\{title\}/);
  assert.doesNotMatch(mark, /<svg|data:image|<image/);
  assert.match(page, /<QuickWashMark/);
  assert.match(sidebar, /<QuickWashMark/);
  assert.ok(existsSync(new URL('vendologo.png', publicRoot)));
  assert.ok(existsSync(new URL('icon.png', appRoot)));
  assert.ok(existsSync(new URL('apple-icon.png', appRoot)));
  assert.ok(!existsSync(new URL('icon.svg', appRoot)));
  assert.ok(!existsSync(new URL('favicon.ico', appRoot)));
  assert.ok(!existsSync(new URL('favicon.ico', publicRoot)));
  assert.ok(!existsSync(new URL('icon.svg', publicRoot)));
});
