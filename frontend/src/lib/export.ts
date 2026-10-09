export type ExportFormat = 'excel' | 'csv' | 'pdf';
export type Cell = string | number;
export interface Matrix {
  header: string[];
  body: Cell[][];
}

/** Header comes from the first row's keys so callers pass plain objects. */
export function toMatrix(rows: Record<string, unknown>[]): Matrix {
  if (rows.length === 0) return { header: [], body: [] };
  const header = Object.keys(rows[0]);
  return {
    header,
    body: rows.map((row) =>
      header.map((key) => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        return typeof value === 'number' ? value : String(value);
      }),
    ),
  };
}

/**
 * RFC 4180 quoting, plus spreadsheet formula neutralisation.
 *
 * Quoting alone is not enough. Excel, LibreOffice and Google Sheets all treat a
 * cell whose first character is = + - @ (or a leading tab/CR) as a FORMULA, not
 * text, and evaluate it when the file is opened. RFC 4180 quoting does not
 * prevent that - the quotes are stripped by the parser and the cell is
 * evaluated.
 *
 * This is reachable here without any privilege: AuthController writes the
 * submitted email into audit_logs.details on every failed sign-in, so an
 * unauthenticated POST to /api/auth/login plants whatever an attacker sends in
 * the email field. An administrator who later exports the audit trail to CSV or
 * Excel and double-clicks a cell has that formula evaluated on their own
 * machine. `=cmd|'/c calc'!A1` runs a command; `=HYPERLINK(...)` exfiltrates.
 *
 * Prefixing with a single quote forces the cell to be read as text, which is
 * how Excel's own "treat as text" works. The quote is part of the cell
 * contents in a strict CSV reader, so it is only inserted for values that
 * actually need it rather than for every cell, which would corrupt ordinary
 * data.
 */
const FORMULA_TRIGGER = /^[=+\-@ \t\r]/;

export function escapeCsvCell(cell: Cell): string {
  const raw = String(cell);

  // Only a real string can be a formula - a number cannot start with '='.
  const guarded =
    typeof cell === 'string' && FORMULA_TRIGGER.test(raw) ? `'${raw}` : raw;

  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const csvCell = escapeCsvCell;

/** RFC 4180 quoting so commas, quotes and newlines cannot break a column. */
export function toCsv(matrix: Matrix): string {
  return [matrix.header, ...matrix.body].map((line) => line.map(csvCell).join(',')).join('\n');
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function writeExcel(matrix: Matrix, filename: string) {
  const exceljs = await import('exceljs');
  const workbook = new exceljs.default.Workbook();
  const sheet = workbook.addWorksheet('Audit Log');
  sheet.addRow(matrix.header);
  matrix.body.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as BlobPart;
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

async function writePdf(matrix: Matrix, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const lines = [matrix.header.join('   '), ...matrix.body.map((row) => row.join('   '))];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('QuickWash - Audit Log', margin, margin);
  doc.setFontSize(8);

  let y = margin + 28;
  for (const [index, line] of lines.entries()) {
    if (index === 0) doc.setFont('helvetica', 'bold');
    const wrapped = doc.splitTextToSize(line, width) as string[];
    for (const piece of wrapped) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(piece, margin, y);
      y += 10;
    }
  }
  doc.save(`${filename}.pdf`);
}

/** One row shape in, one real file out. CSV stays dependency-free. */
export async function exportRows(rows: Record<string, unknown>[], filename: string, format: ExportFormat) {
  const matrix = toMatrix(rows);
  if (matrix.header.length === 0) return;

  if (format === 'excel') return writeExcel(matrix, filename);
  if (format === 'pdf') return writePdf(matrix, filename);

  // Excel opens UTF-8 CSV correctly only with the BOM prefix.
  download(new Blob([`﻿${toCsv(matrix)}`], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}
