import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

/**
 * Extracts one flat CSS rule by its exact opening selector. Slicing between
 * two indexOf() calls is unsafe here because a combined selector such as
 * ".a,\n.b {" also matches a search for ".b {", earlier in the file. Pass
 * { last: true } when the standalone rule is shadowed by such a combined one.
 */
const ruleOf = (css, selector, { last = false } = {}) => {
  const start = last ? css.lastIndexOf(selector) : css.indexOf(selector);
  if (start < 0) return '';
  const end = css.indexOf('\n}', start);
  return end < 0 ? '' : css.slice(start, end + 2);
};

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

test('the coin is a struck gold disc clipped by the slotway', () => {
  const overlay = source('../components/login/CoinSlotOverlay.tsx');
  const styles = source('../app/globals.css');

  // The coin has to be a child of the clipping slotway, otherwise it slides
  // in front of the machine instead of being swallowed by it.
  assert.match(overlay, /className="slot-slotway"[\s\S]*?className="slot-coin"/);
  assert.match(styles, /\.slot-slotway\s*\{[\s\S]*?overflow: hidden;/);

  const coin = ruleOf(styles, '.slot-coin {');
  assert.match(coin, /width: 5\.4rem;\s*\n\s*height: 5\.4rem;/);
  assert.match(coin, /transform-style: preserve-3d;/);

  // Gold, not the old cyan sphere.
  const face = ruleOf(styles, '.slot-coin-face {');
  assert.match(face, /radial-gradient\(circle at 42% 34%, #F7D278/);
  assert.doesNotMatch(`${coin}${face}`, /#A5E4FF|#0EA5E9/);

  // Two faces held apart in 3D, so the coin still shows an edge at the
  // halfway point of the flip instead of collapsing to a hairline.
  assert.match(face, /transform: translateZ\(2px\)/);
  assert.match(styles, /\.slot-coin-face,\s*\n\.slot-coin-back \{[\s\S]*?backface-visibility: hidden;/);
  assert.match(ruleOf(styles, '.slot-coin-back {', { last: true }), /transform: rotateY\(180deg\) translateZ\(2px\)/);
  assert.match(overlay, /className="slot-coin-face" \/>/);
  assert.match(overlay, /className="slot-coin-back" \/>/);

  // A coin is flat with a raised rim, not a shaded sphere. The rim and the
  // embossed droplet are what stop it reading as a ball.
  const rim = ruleOf(styles, '.slot-coin-face::before {');
  assert.match(rim, /inset 0 2px 0 rgba\(255, 240, 197/);
  assert.match(rim, /inset 0 -2px 0 rgba\(86, 56, 6/);
  const emblem = ruleOf(styles, '.slot-coin-face::after {');
  assert.match(emblem, /border-radius: 50% 50% 50% 0/);
  assert.match(emblem, /transform: rotate\(-45deg\)/);
});


test('the acceptor is drawn with a vertical slit, LED, plunger and engraving', () => {
  const overlay = source('../components/login/CoinSlotOverlay.tsx');
  const styles = source('../app/globals.css');

  assert.match(overlay, /className="slot-acceptor"/);
  assert.match(overlay, /slot-screw--tl/);
  assert.match(overlay, /className="slot-bezel"/);
  assert.match(overlay, /className="slot-face"/);
  assert.match(overlay, /className="slot-led"/);
  assert.match(overlay, /className="slot-plunger"/);
  assert.match(overlay, /className="slot-engraving"/);

  // A coin acceptor takes a coin through a narrow TALL slit. The old
  // horizontal gap is a coin return and must not come back.
  const slit = styles.slice(styles.indexOf('.slot-slit {'), styles.indexOf('.slot-beam {'));
  assert.match(slit, /width: 1\.1rem;/);
  assert.match(slit, /height: 4\.2rem;/);
  assert.doesNotMatch(styles, /\.slot-plate|\.slot-lip/);

  // The face panel is what occludes the coin below the mouth; without it
  // the coin would be visible lying across the slit.
  assert.match(styles, /\.slot-face\s*\{[\s\S]*?z-index: 3;/);

  // Its transparent window has to be exactly as wide as the slit. A wider
  // window leaves slivers beside the slit with the coin showing through.
  const face = styles.slice(styles.indexOf('.slot-face {'), styles.indexOf('/* The bar the coin passes behind'));
  const window = face.match(/transparent ([\d.]+)rem ([\d.]+)rem/);
  assert.ok(window, 'the face needs a transparent window for the slit');
  const windowWidth = Number(window[2]) - Number(window[1]);
  assert.equal(
    windowWidth,
    1.1,
    `the face window is ${windowWidth}rem but the slit is 1.1rem, so the coin leaks through`,
  );

  // The engraving is confined to the machine graphic, never to the product
  // copy on the page or the form.
  const page = source('../app/login/page.tsx');
  const form = source('../components/login/CredentialForm.tsx');
  assert.doesNotMatch(`${page}\n${form}`, /Insert coin/i);
});

test('the coin flips as it enters and tumbles back out when rejected', () => {
  const styles = source('../app/globals.css');
  assert.match(styles, /\.slot-mech \{[^}]*perspective: 700px;/);
  assert.match(styles, /@keyframes slot-coin-feed \{[\s\S]*?rotateX\(360deg\)/);
  assert.match(styles, /@keyframes slot-coin-return \{[\s\S]*?rotateX\(500deg\)/);
  assert.match(styles, /@keyframes slot-plunger-fire/);
  assert.match(styles, /@keyframes slot-beam-sweep/);

  // The flip must land on a whole turn so the coin rests face-up showing its
  // embossed emblem. Half a turn would leave it on its blank reverse.
  assert.doesNotMatch(styles, /rotateX\(180deg\)/);
  assert.doesNotMatch(styles, /rotateX\(150deg\)/);
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
