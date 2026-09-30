import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACTIVITY_THROTTLE_MS,
  IDLE_SIGNOUT_AFTER_MS,
  IDLE_WARN_AFTER_MS,
  defaultIdleConfig,
  formatCountdown,
  idlePhase,
  secondsRemaining,
  shouldRearm,
  shouldSignOut,
} from './idle.ts';

test('the warning appears at five minutes and not a moment before', () => {
  assert.equal(IDLE_WARN_AFTER_MS, 5 * 60 * 1000);
  assert.equal(idlePhase(IDLE_WARN_AFTER_MS - 1), 'active');
  assert.equal(idlePhase(IDLE_WARN_AFTER_MS), 'warning');
  assert.equal(idlePhase(IDLE_WARN_AFTER_MS + 60_000), 'warning');
});

test('activity resets the clock, including a clock that has gone negative', () => {
  assert.equal(idlePhase(0), 'active');
  assert.equal(idlePhase(-5000), 'active', 'activity just happened');
});

test('the grace period is a minute, and it ends in a sign-out', () => {
  assert.equal(IDLE_SIGNOUT_AFTER_MS, IDLE_WARN_AFTER_MS + 60_000);
  assert.equal(shouldSignOut(IDLE_SIGNOUT_AFTER_MS - 1), false);
  assert.equal(shouldSignOut(IDLE_SIGNOUT_AFTER_MS), true);
});

test('the countdown never shows a negative or a fractional value', () => {
  assert.equal(secondsRemaining(IDLE_WARN_AFTER_MS), 60);
  assert.equal(secondsRemaining(IDLE_SIGNOUT_AFTER_MS), 0);
  assert.equal(secondsRemaining(IDLE_SIGNOUT_AFTER_MS + 99_999), 0);
  assert.equal(formatCountdown(60), '1:00');
  assert.equal(formatCountdown(9), '0:09');
  assert.equal(formatCountdown(-5), '0:00');
});

test('a busy mouse cannot re-arm the timer on every event', () => {
  // Pointermove fires constantly; timers here are measured in minutes, so
  // re-arming per event is wasted work for no benefit.
  assert.equal(shouldRearm(1000, 1500), false);
  assert.equal(shouldRearm(1000, 1000 + ACTIVITY_THROTTLE_MS), true);
});

test('the config is internally consistent', () => {
  assert.ok(defaultIdleConfig.signOutAfterMs > defaultIdleConfig.warnAfterMs);
  assert.equal(idlePhase(defaultIdleConfig.warnAfterMs, defaultIdleConfig), 'warning');
  assert.equal(shouldSignOut(defaultIdleConfig.signOutAfterMs, defaultIdleConfig), true);
});
