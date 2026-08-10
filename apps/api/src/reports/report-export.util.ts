import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ReportRunResult } from '@taskapp/shared-types';

/** CSV — one row per (metric, dimension) pair; simplest export, no external library needed. */
export function toCsv(results: ReportRunResult[]): string {
  const lines = ['metric,dimension_label,dimension_value,value'];
  for (const result of results) {
    for (const row of result.rows) {
      lines.push(
        [result.metric, csvField(row.dimension_label), csvField(row.dimension_value ?? ''), row.value].join(','),
      );
    }
  }
  return lines.join('\n');
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Excel — one sheet per metric so each can be pivoted/charted independently once opened. */
export async function toXlsx(reportName: string, results: ReportRunResult[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Task Management Application';
  workbook.created = new Date();

  for (const result of results) {
    const sheet = workbook.addWorksheet(sheetName(result.metric));
    sheet.columns = [
      { header: 'Dimension', key: 'label', width: 32 },
      { header: 'Value', key: 'value', width: 16 },
    ];
    for (const row of result.rows) {
      sheet.addRow({ label: row.dimension_label, value: row.value });
    }
    sheet.getRow(1).font = { bold: true };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function sheetName(metric: string): string {
  // Excel sheet names cap at 31 chars and disallow a few punctuation characters.
  return metric.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
}

/**
 * PDF — plain text/table rendering via pdfkit, not chart images: sufficient for the
 * scheduled/emailed use case (docs/05-FEATURES.md §3.5) without standing up a separate
 * headless-browser rendering service just for this.
 */
export function toPdf(reportName: string, results: ReportRunResult[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(reportName, { underline: true });
    doc.moveDown();
    doc.fontSize(9).fillColor('gray').text(`Generated ${new Date().toISOString()}`);
    doc.fillColor('black');
    doc.moveDown();

    for (const result of results) {
      doc.fontSize(13).text(metricHeading(result.metric));
      doc.moveDown(0.3);
      doc.fontSize(10);
      if (result.rows.length === 0) {
        doc.fillColor('gray').text('No data for the selected range.').fillColor('black');
      }
      for (const row of result.rows) {
        doc.text(`${row.dimension_label}: ${formatValue(row.value)}`);
      }
      doc.moveDown();
    }

    doc.end();
  });
}

function metricHeading(metric: string): string {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
