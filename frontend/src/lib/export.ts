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

const csvCell = (cell: Cell) => {
  const text = String(cell);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

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
