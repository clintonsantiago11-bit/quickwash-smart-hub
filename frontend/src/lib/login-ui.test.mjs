import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('login uses plain product copy without fake coin-terminal language', () => {
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');

  for (const copy of ['Email', 'Password', 'Remember email', 'Sign in']) {
    assert.match(form, new RegExp(`>\\s*${copy}\\s*<`), `expected form copy: ${copy}`);
  }

  const loginUi = `${page}\n${form}`;
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

test('QuickWash Q mark is shared by login, sidebar, and browser icon', () => {
  const mark = source('../components/QuickWashMark.tsx');
  const page = source('../app/login/page.tsx');
  const sidebar = source('../components/Sidebar.tsx');
  const icon = source('../app/icon.svg');

  assert.match(mark, /QuickWash/);
  assert.match(mark, /<svg/);
  assert.match(page, /<QuickWashMark/);
  assert.match(sidebar, /<QuickWashMark/);
  assert.doesNotMatch(sidebar, /Droplets/);
  assert.match(icon, /QW-Q-MARK/);
  assert.doesNotMatch(icon, /qw-drop/);
});
