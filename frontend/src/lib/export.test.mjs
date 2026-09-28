import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toMatrix, toCsv } from './export.ts';

const rows = [
  { Timestamp: '2026-01-01 10:00', User: 'Ana', IP: '10.0.0.1', Action: 'Sign in', Details: 'ok' },
  { Timestamp: '2026-01-01 10:05', User: 'Ben', IP: null, Action: 'Coins', Details: 'said "hi", left\nnewline' },
];

test('toMatrix derives the header from the row keys and stringifies values', () => {
  const matrix = toMatrix(rows);
  assert.deepEqual(matrix.header, ['Timestamp', 'User', 'IP', 'Action', 'Details']);
  assert.equal(matrix.body.length, 2);
  assert.equal(matrix.body[0][1], 'Ana');
  assert.equal(matrix.body[1][2], '');
});

test('toCsv escapes commas, quotes and newlines so columns stay intact', () => {
  const csv = toCsv(toMatrix(rows));
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Timestamp,User,IP,Action,Details');
  assert.ok(lines.slice(2).join('\n').includes('"said ""hi"", left\nnewline"'), lines.slice(2).join('\n'));
  assert.equal(csv.split('\n').length, 4, 'the quoted newline must stay inside one CSV field');
});

test('toCsv produces nothing for an empty row set (the UI blocks empty exports)', () => {
  assert.deepEqual(toMatrix([]), { header: [], body: [] });
  assert.equal(toCsv(toMatrix([])), '');
});
