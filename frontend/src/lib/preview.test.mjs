import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  COIN_INSERT_MS, PREVIEW_SCAN_MS, previewTimeline, previewTotalMs, totalRejectMs,
} from './login-sequence.ts';


const preview = readFileSync(new URL('../components/login/CoinSlotPreview.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/profile/page.tsx', import.meta.url), 'utf8');

test('the preview replays the real sequence, in the real order', () => {
  const steps = previewTimeline();
  assert.deepEqual(
    steps.map((s) => s.phase),
    ['inserting', 'authenticating', 'rejecting'],
  );
});

test('each preview step is held for the same time the real sign-in uses', () => {
  const [inserting, authenticating, rejecting] = previewTimeline();

  assert.equal(inserting.afterMs, COIN_INSERT_MS, 'the drop must not be sped up for the preview');
  assert.equal(rejecting.afterMs, totalRejectMs(), 'the jam and return must match the real thing');
  assert.equal(authenticating.afterMs, PREVIEW_SCAN_MS);
  assert.ok(PREVIEW_SCAN_MS > 0, 'the scan has to be long enough to see the beam');
});

test('the preview never replays a success or a redirect', () => {
  const phases = previewTimeline().map((s) => s.phase);
  assert.ok(!phases.includes('success'), 'a success panel would be a lie for a signed-in user');
  assert.ok(!phases.includes('jam'), 'jam is a resting state, not part of the animation');
});

test('the total is the sum of its steps', () => {
  const expected = COIN_INSERT_MS + PREVIEW_SCAN_MS + totalRejectMs();
  assert.equal(previewTotalMs(), expected);
});

test('the replay button is reachable from the profile', () => {
  assert.match(page, /ReplayCoinReader/);
  assert.match(page, /CoinSlotPreview/);
  assert.match(preview, /Replay coin reader/);
  assert.match(preview, /onDismiss/);
});

test('the preview is animation only and cannot authenticate anyone', () => {
  // The reason this is safe to ship to operators: there is no code path from
  // the preview to a token, a session, or the API's login route.
  assert.doesNotMatch(preview, /api\./, 'the preview must not talk to the API');
  assert.doesNotMatch(preview, /auth_token|isAuthenticated|qhs_session/);
  assert.doesNotMatch(preview, /login\(|setToken|router\.push/);
  assert.doesNotMatch(preview, /createToken/);
});

test('the preview starts on mount and can be dismissed with Escape', () => {
  // The first step is the initial state, not something set inside an effect,
  // so mounting shows the coin with no extra render pass.
  assert.match(preview, /useState<MachinePhase \| null>\(\(\) => previewTimeline\(\)\[0\]\.phase\)/);
  assert.match(preview, /event\.key === 'Escape'/);
  assert.match(preview, /return clearTimers;/, 'timers must be cleared on unmount');
  assert.doesNotMatch(preview, /if \(run === 0\) return;/);
});

test('a finished run dismisses itself so the button can start it again', () => {
  // Regression: the last step only cleared the phase. The component stayed
  // mounted rendering nothing while the parent still thought it was open, so
  // a second click on Replay changed nothing and the preview played once.
  const lastStep = preview.slice(preview.indexOf('index === steps.length - 1'));
  assert.match(lastStep, /onDismiss\(\);/, 'the final step must notify the parent it is done');
  assert.ok(
    lastStep.indexOf('onDismiss();') < lastStep.indexOf('setPhase(steps[index + 1]'),
    'dismiss must sit on the final-step branch',
  );
});

