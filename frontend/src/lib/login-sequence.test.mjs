import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COIN_EJECT_MS,
  COIN_INSERT_MS,
  COIN_MIN_VISIBLE_MS,
  COIN_REJECT_MS,
  phaseWhilePending,
  shouldHoldResult,
  terminalPhase,
  totalRejectMs,
} from './login-sequence.ts';

test('the coin is still dropping right after the request starts', () => {
  assert.equal(phaseWhilePending(0), 'inserting');
  assert.equal(phaseWhilePending(COIN_INSERT_MS - 1), 'inserting');
});

test('a request still running after the coin lands moves on to authenticating', () => {
  assert.equal(phaseWhilePending(COIN_INSERT_MS), 'authenticating');
  assert.equal(phaseWhilePending(COIN_INSERT_MS + 5000), 'authenticating');
});

test('a result that lands almost immediately is shown without waiting for the coin', () => {
  assert.equal(shouldHoldResult(0), false);
  assert.equal(shouldHoldResult(COIN_MIN_VISIBLE_MS - 1), false);
});

test('a mid-flight result waits for the coin to finish dropping', () => {
  assert.equal(shouldHoldResult(COIN_MIN_VISIBLE_MS), true);
  assert.equal(shouldHoldResult(COIN_INSERT_MS - 1), true);
});

test('a result that arrives after the coin has landed is not held', () => {
  assert.equal(shouldHoldResult(COIN_INSERT_MS), false);
  assert.equal(shouldHoldResult(9000), false);
});

test('only a rejected credential jams the coin', () => {
  assert.equal(terminalPhase('credentials'), 'rejecting');
  assert.equal(terminalPhase('network'), 'error');
  assert.equal(terminalPhase('timeout'), 'error');
  assert.equal(terminalPhase('server'), 'error');
});

test('a healthy login reports success', () => {
  assert.equal(terminalPhase('ok'), 'success');
});

test('the jam rattles, holds, then ejects the coin out of the reader', () => {
  assert.ok(COIN_REJECT_MS > 0);
  assert.ok(COIN_EJECT_MS > 0);
  assert.equal(totalRejectMs(), COIN_REJECT_MS + COIN_EJECT_MS);
});

test('an unknown failure kind still reaches a terminal phase', () => {
  assert.equal(terminalPhase('nonsense'), 'error');
});
