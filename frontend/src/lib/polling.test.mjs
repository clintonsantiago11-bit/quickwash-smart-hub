import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/**
 * The hidden-tab pause only works if `document.hidden` is read when the timer
 * fires. It used to be sampled when the timer was *scheduled*, so a tab hidden
 * afterwards still fired one poll, and the timer kept re-arming forever in the
 * background - the cost the hook exists to avoid.
 */
test('usePolling reads document.hidden inside the timer, not when scheduling', () => {
  const polling = source('./usePolling.ts');

  const schedule = polling.slice(polling.indexOf('const schedule'), polling.indexOf('const onVisibility'));

  assert.match(
    schedule,
    /setTimeout\(\(\)\s*=>\s*\{[\s\S]*?if \(!isHidden\(\)\) latest\.current\(\)/,
    'the visibility check must happen when the timer fires',
  );
  assert.doesNotMatch(
    schedule,
    /const hidden =[^;]*document\.hidden/,
    'sampling document.hidden at schedule time is the bug this replaces',
  );
});

test('usePolling tears down its timer and listener', () => {
  const polling = source('./usePolling.ts');
  assert.match(polling, /clearTimeout\(timer\)/);
  assert.match(polling, /removeEventListener\('visibilitychange'/);
  assert.match(polling, /stopped = true/);
});

test('the timer callback cannot outlive the effect', () => {
  const polling = source('./usePolling.ts');
  // Re-arming must be guarded, or a poll already in flight reschedules after
  // unmount and keeps a dead component alive.
  assert.match(polling, /const schedule = \(\) => \{\s*\n\s*if \(stopped\) return;/);
});

test('two polling call sites no longer use a bare setInterval', () => {
  for (const [file, reason] of [
    ['../components/NaekConfigCard.tsx', 'NAEK config card polled every 5s regardless of visibility'],
    ['../app/cameras/page.tsx', 'camera probes hold the ESP32 single stream slot and must pause when hidden'],
  ]) {
    const text = source(file);
    assert.doesNotMatch(text, /setInterval\(/, `${file} should use usePolling, not setInterval (${reason})`);
    assert.match(text, /usePolling\(/, `${file} must poll through the shared hook`);
  }
});

test('usePolling is called at component top level, never inside a callback', () => {
  // This is not cosmetic: the first attempt called the hook from inside the
  // existing useEffect, which eslint rejects (rules-of-hooks) and which would
  // re-register the timer whenever the effect re-ran.
  for (const file of ['../components/NaekConfigCard.tsx', '../app/cameras/page.tsx']) {
    const text = source(file);
    assert.doesNotMatch(
      text,
      /useEffect\([^)]*=>[\s\S]*?usePolling\(/,
      `${file} must not call a hook from inside an effect callback`,
    );
  }
});

test('usePolling is imported where it is now used', () => {
  for (const file of ['../components/NaekConfigCard.tsx', '../app/cameras/page.tsx']) {
    assert.match(source(file), /import \{ usePolling \} from '@\/lib\/usePolling'/, file);
  }
});