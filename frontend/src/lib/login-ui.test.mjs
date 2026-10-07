import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const loginUi = () =>
  [
    source('../app/login/page.tsx'),
    source('../components/login/CredentialForm.tsx'),
    source('../components/login/WelcomeOverlay.tsx'),
  ].join('\n');

test('login uses plain product copy without fake coin-terminal language', () => {
  const form = source('../components/login/CredentialForm.tsx');

  for (const copy of ['Email', 'Password', 'Remember email']) {
    assert.match(form, new RegExp(`>\\s*${copy}\\s*<`), `expected form copy: ${copy}`);
  }
  assert.match(form, /Sign in/, 'expected the submit button copy: Sign in');
  assert.doesNotMatch(form, />\s*valid\s*</, 'unexpected login copy: valid');
});

test('no coin vocabulary survives anywhere in the sign-in flow', () => {
  const ui = loginUi();

  for (const removed of [
    'INSERT COIN',
    'Insert coin',
    'CoinMech',
    'Faceplate',
    'Droplets',
    'Coin accepted',
    'Coin jammed',
    'Retry coin',
    'inserting',
    'authenticating',
    'rejecting',
    'Operator Email',
    'Password Access',
    'Forgot Key?',
  ]) {
    assert.doesNotMatch(ui, new RegExp(removed.replace('?', '\\?')), `unexpected login copy: ${removed}`);
  }
});

test('the sign-in state machine has no phases left over from the coin reader', () => {
  const auth = source('./auth.ts');

  // Four states: idle, verifying, success, failed. The other three that
  // existed only to pace an animation are gone.
  for (const phase of ['idle', 'verifying', 'success', 'failed']) {
    assert.match(auth, new RegExp(`['"]${phase}['"]`), `missing phase: ${phase}`);
  }

  assert.doesNotMatch(auth, /inserting|authenticating|rejecting|'jam'/, 'a pacing phase survived');
  assert.match(auth, /isBlockingPhase/);
  assert.match(auth, /phase === 'verifying' \|\| phase === 'success'/);
});

test('a successful sign-in greets the operator by name and role', () => {
  const page = source('../app/login/page.tsx');
  const overlay = source('../components/login/WelcomeOverlay.tsx');

  assert.match(page, /<WelcomeOverlay/);
  assert.doesNotMatch(page, /CoinSlotOverlay|login-sequence/);

  // The greeting reads out the name, role and facility. On a shared terminal
  // that is the whole point of the screen.
  assert.match(page, /greeting\(/);
  assert.match(page, /greetingName\(/);
  assert.match(page, /welcomeDetail\(/);

  assert.match(overlay, /login-welcome-title/);
  assert.match(overlay, /login-welcome-detail/);
  assert.match(overlay, /Continue to dashboard/);
});

test('the greeting is decided by whether this browser has signed in before', () => {
  const page = source('../app/login/page.tsx');

  assert.match(page, /isReturningVisitor\(localStorage\.getItem\(LAST_SIGN_IN_KEY\)\)/);
  // Read before written, or the very first sign-in would read as a return.
  assert.match(page, /localStorage\.setItem\(LAST_SIGN_IN_KEY/);
  assert.ok(
    page.indexOf('LAST_SIGN_IN_KEY)') < page.indexOf('LAST_SIGN_IN_KEY, new Date()'),
    'the previous sign-in must be read before this one is written',
  );

  // Deliberately not keyed on the remembered email: that is only written when
  // "Remember email" is ticked, so it would greet a returning operator as new.
  assert.match(page, /remembered_email/);
});

test('the waiting state is honest about a wait it cannot measure', () => {
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');

  assert.match(page, /setPhase\('verifying'\)/);
  assert.match(form, /Verifying/);
  assert.match(form, /login-progress/);

  // No percentage: password hashing takes seconds on a small instance and
  // there is no way to know how far through it the server is.
  assert.doesNotMatch(form, /%\s*}/, 'an invented percentage would be a lie about a security step');
  assert.match(form, /login-progress-bar/);
  assert.match(form, /role="status"/);
});

test('a failed sign-in says why straight away, with no coin language', () => {
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');

  assert.match(page, /setPhase\('failed'\)/);
  assert.match(page, /That email and password do not match/);
  assert.match(form, /'Try again'/);

  // The old flow waited 700ms for a coin to be thrown out of a slot before
  // showing the reason. Nothing should stand between the operator and the
  // explanation.
  assert.doesNotMatch(page, /totalRejectMs|await wait\(/, 'an artificial delay survived');
  assert.doesNotMatch(source('./auth.ts'), /inserting|authenticating/);
});

test('a failure keeps the email and clears the password', () => {
  const form = source('../components/login/CredentialForm.tsx');

  assert.match(form, /if \(phase !== 'failed'\) return;/);
  assert.match(form, /setPassword\(''\)/);
  assert.doesNotMatch(form, /setEmail\(''\)/);
  assert.match(form, /passwordRef\.current\?\.focus\(\)/);
});

test('the welcome overlay honours reduced motion', () => {
  const styles = source('../app/globals.css');
  const block = styles.slice(styles.indexOf('prefers-reduced-motion'));

  assert.match(styles, /prefers-reduced-motion/);
  assert.match(block, /\.login-welcome/, 'the greeting must be able to stop fading in');
  assert.match(block, /\.login-progress-bar/, 'the progress sweep must be able to stop');
});

test('the coin reader is gone from the codebase, not just unused', () => {
  const css = source('../app/globals.css');
  const page = source('../app/login/page.tsx');

  assert.doesNotMatch(css, /\.slot-/, 'coin CSS survived');
  assert.doesNotMatch(page, /CoinSlot|login-sequence/);
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