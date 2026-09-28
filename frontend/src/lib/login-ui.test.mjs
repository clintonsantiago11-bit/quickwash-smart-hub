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

test('the coin mechanism covers the screen as a card-sized modal dialog', () => {
  const page = source('../app/login/page.tsx');
  const overlay = source('../components/login/CoinSlotOverlay.tsx');
  const styles = source('../app/globals.css');

  assert.match(page, /<CoinSlotOverlay/);
  assert.doesNotMatch(page, /CoinSlotFeedback/);

  assert.match(overlay, /role="dialog"/);
  assert.match(overlay, /aria-modal="true"/);
  assert.match(overlay, /aria-labelledby="slot-stage-title"/);
  assert.match(overlay, /stageRef\.current\?\.focus\(\)/);

  // Nothing in the dialog is actionable, so Tab must not walk out behind
  // the scrim into the disabled form.
  assert.match(overlay, /onKeyDown=\{holdFocus\}/);
  assert.match(overlay, /if \(event\.key !== 'Tab'\) return;/);
  assert.match(overlay, /event\.preventDefault\(\);\s*\n\s*stageRef\.current\?\.focus\(\);/);

  // Fixed to the whole viewport, and the stage is card-sized and centred.
  assert.match(styles, /\.slot-scrim\s*\{[\s\S]*?position: fixed;/);
  assert.match(styles, /\.slot-scrim\s*\{[\s\S]*?inset: 0;/);
  assert.match(styles, /\.slot-scrim\s*\{[\s\S]*?place-items: center;/);
  assert.match(styles, /\.slot-stage\s*\{[\s\S]*?width: min\(100%, 25\.5rem\)/);
});

test('the coin is a plain blue disc clipped by the slotway', () => {
  const overlay = source('../components/login/CoinSlotOverlay.tsx');
  const styles = source('../app/globals.css');

  // The coin has to be a child of the clipping slotway, otherwise it slides
  // in front of the machine instead of being swallowed by it.
  assert.match(overlay, /className="slot-slotway"[\s\S]*?className="slot-coin"/);
  assert.match(styles, /\.slot-slotway\s*\{[\s\S]*?overflow: hidden;/);

  // A blue circle, not a decorated token.
  const coin = styles.slice(styles.indexOf('.slot-coin {'), styles.indexOf('.slot-coin::after'));
  assert.match(coin, /border-radius: 50%/);
  assert.match(coin, /radial-gradient\(circle at 36% 30%, #A5E4FF/);
  assert.match(coin, /width: 5\.2rem;\s*\n\s*height: 5\.2rem;/);

  // The slit is cut into a metal faceplate with a bright lip over it.
  assert.match(overlay, /className="slot-plate"/);
  assert.match(overlay, /className="slot-lip"/);
  assert.match(overlay, /className="slot-slit"/);
});

test('a rejected credential catches the coin, returns it, then offers a retry', () => {
  const auth = source('./auth.ts');
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');
  const sequence = source('./login-sequence.ts');
  const styles = source('../app/globals.css');

  for (const phase of ['inserting', 'authenticating', 'rejecting', 'jam', 'success', 'error']) {
    assert.match(auth, new RegExp(`['"]${phase}['"]`));
  }

  assert.match(sequence, /credentials'\) return 'rejecting'/);
  assert.match(page, /terminalPhase\(kind\)/);
  assert.match(page, /setPhase\('rejecting'\)/);
  assert.match(page, /setPhase\('jam'\)/);
  assert.match(page, /await wait\(totalRejectMs\(\)\)/);

  // Catch first, return second, on separate properties of the same disc.
  assert.match(styles, /@keyframes slot-coin-catch/);
  assert.match(styles, /@keyframes slot-coin-return/);
  assert.match(
    styles,
    /slot-coin-catch 280ms[^\n]*slot-coin-return 420ms[^\n]*280ms/,
  );
  assert.match(styles, /\.slot-scrim\[data-phase='rejecting'\] \.slot-blocker \{ opacity: 1; \}/);

  // The retry is the sign-in button itself, relabelled, and it is only
  // reachable once the coin has been ejected and the form is live again.
  assert.match(form, /'Retry coin'/);
  assert.match(form, /isBlockingPhase\(phase\)/);
  assert.match(page, /phase !== 'jam' && phase !== 'error' && \(/);
});

test('signing in posts the credential immediately instead of waiting on a fake delay', () => {
  const page = source('../app/login/page.tsx');
  const sequence = source('./login-sequence.ts');

  assert.doesNotMatch(page, /COIN_INSERT_MS = 520/, 'the old blocking delay is gone');
  assert.match(page, /const startedAt = performance\.now\(\)/);
  assert.match(page, /api\.login\(credentials\.email, credentials\.password\)/);
  assert.match(page, /shouldHoldResult\(elapsed\)/);
  assert.match(page, /phaseWhilePending\(performance\.now\(\) - startedAt\)/);
  assert.match(sequence, /COIN_MIN_VISIBLE_MS/);
});

test('a jam clears the password and keeps the email; a network fault keeps both', () => {
  const form = source('../components/login/CredentialForm.tsx');

  assert.match(form, /if \(phase !== 'jam'\) return;/);
  assert.match(form, /setPassword\(''\)/);
  assert.doesNotMatch(form, /setEmail\(''\)/);
  assert.match(form, /passwordRef\.current\?\.focus\(\)/);
});

test('the coin mechanism honours reduced motion in every state', () => {
  const styles = source('../app/globals.css');
  const block = styles.slice(styles.indexOf('prefers-reduced-motion'));

  assert.match(styles, /prefers-reduced-motion/);
  for (const phase of ['inserting', 'authenticating', 'rejecting', 'success']) {
    assert.match(
      block,
      new RegExp(`slot-scrim\\[data-phase='${phase}'\\] \\.slot-coin`),
      `reduced motion must hold a static coin position for: ${phase}`,
    );
  }
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
