import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { buildSalesInvoiceSheets } from '../finance-report-generator';
import { buildCashVoucherSheet } from './CashVoucherReport';
import { buildCheckVoucherSheet } from './CheckVoucherReport';
import { buildExpensesSheet } from './ExpensesReport';
import { buildPettyCashSheet } from './PettyCashReport';
import { buildValesSheet } from './ValesReport';

/**
 * Generates a single Excel workbook with multiple sheets — one per report type.
 *
 * @param {Object} reportData
 * @param {Array}  reportData.invoices           - Sales invoice records
 * @param {Array}  reportData.cashVouchers       - Cash voucher records
 * @param {Array}  reportData.checkVouchers      - Check voucher records
 * @param {Array}  reportData.expenses           - Expense records
 * @param {Array}  reportData.pettyCash          - Petty cash records
 * @param {Array}  reportData.vales              - Vales records
 *
 * @param {Object} options
 * @param {Object} options.dateRange             - { start, end, year, quarter, month }
 * @param {Object} options.summaryMetrics        - Petty cash summary metrics
 * @param {Number} options.expensesTarget        - Target amount for expenses footer
 * @param {Array}  options.include               - Which sheets to include (default: all)
 *                                                 e.g. ['invoices','cashVouchers','checkVouchers','expenses','pettyCash','vales']
 * @param {String} options.filename              - Override output filename
 */
export const generateCombinedReport = async (reportData = {}, options = {}) => {
  const {
    invoices = [],
    cashVouchers = [],
    checkVouchers = [],
    expenses = [],
    pettyCash = [],
    vales = [],
  } = reportData;

  const {
    dateRange = {},
    summaryMetrics = {},
    expensesTarget = 12500000,
    include = ['invoices', 'cashVouchers', 'checkVouchers', 'expenses', 'pettyCash', 'vales'],
    filename,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JJC Engineering Works & General Services';
  workbook.created = new Date();
  workbook.lastModifiedBy = 'JJC Finance';
  workbook.modified = new Date();

  const shouldInclude = (key) => include.includes(key);

  // ── Cover / Index sheet ─────────────────────────────────────────────────────
  const cover = workbook.addWorksheet('Index', { views: [{ showGridLines: false }] });
  cover.columns = [
    { key: 'A', width: 6 },
    { key: 'B', width: 40 },
    { key: 'C', width: 20 },
    { key: 'D', width: 20 },
  ];

  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = dateRange.year || new Date().getFullYear();

  cover.mergeCells('B2:D2');
  const titleCell = cover.getCell('B2');
  titleCell.value = 'JJC ENGINEERING WORKS & GENERAL SERVICES';
  titleCell.font = { name: 'Calibri', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  cover.mergeCells('B3:D3');
  const subTitle = cover.getCell('B3');
  subTitle.value = `COMBINED FINANCIAL REPORT — ${year}`;
  subTitle.font = { name: 'Calibri', size: 12, bold: true };
  subTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  cover.mergeCells('B4:D4');
  const dateCell = cover.getCell('B4');
  dateCell.value = `Generated: ${today}`;
  dateCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF666666' } };
  dateCell.alignment = { horizontal: 'center' };

  cover.getRow(6).getCell(2).value = 'SHEET';
  cover.getRow(6).getCell(3).value = 'RECORDS';
  cover.getRow(6).getCell(4).value = 'STATUS';
  [2, 3, 4].forEach(c => {
    const cell = cover.getRow(6).getCell(c);
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  const indexRows = [
    shouldInclude('invoices')     && ['Sales Invoices',    invoices.length,     invoices.length     ? '✓ Included' : '— No data'],
    shouldInclude('cashVouchers') && ['Cash Vouchers',     cashVouchers.length, cashVouchers.length ? '✓ Included' : '— No data'],
    shouldInclude('checkVouchers')&& ['Check Vouchers',    checkVouchers.length,checkVouchers.length? '✓ Included' : '— No data'],
    shouldInclude('expenses')     && ['Expenses',          expenses.length,     expenses.length     ? '✓ Included' : '— No data'],
    shouldInclude('pettyCash')    && ['Petty Cash',        pettyCash.length,    pettyCash.length    ? '✓ Included' : '— No data'],
    shouldInclude('vales')        && ['Vales',             vales.length,        vales.length        ? '✓ Included' : '— No data'],
  ].filter(Boolean);

  indexRows.forEach((rowData, i) => {
    const r = cover.getRow(7 + i);
    r.getCell(2).value = rowData[0];
    r.getCell(3).value = rowData[1];
    r.getCell(4).value = rowData[2];
    const isIncluded = String(rowData[2]).startsWith('✓');
    [2, 3, 4].forEach(c => {
      const cell = r.getCell(c);
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (c === 4) cell.font = { name: 'Calibri', size: 10, color: { argb: isIncluded ? 'FF107C10' : 'FF999999' } };
    });
    r.height = 20;
  });

  // ── Report sheets ────────────────────────────────────────────────────────────
  if (shouldInclude('invoices') && invoices.length > 0) {
    await buildSalesInvoiceSheets(workbook, invoices);
  }
  if (shouldInclude('cashVouchers') && cashVouchers.length > 0) {
    await buildCashVoucherSheet(workbook, cashVouchers, dateRange);
  }
  if (shouldInclude('checkVouchers') && checkVouchers.length > 0) {
    await buildCheckVoucherSheet(workbook, checkVouchers, dateRange);
  }
  if (shouldInclude('expenses') && expenses.length > 0) {
    await buildExpensesSheet(workbook, expenses, dateRange, expensesTarget);
  }
  if (shouldInclude('pettyCash') && pettyCash.length > 0) {
    await buildPettyCashSheet(workbook, pettyCash, dateRange, summaryMetrics);
  }
  if (shouldInclude('vales') && vales.length > 0) {
    await buildValesSheet(workbook, vales, dateRange);
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const outputFilename = filename || `JJC_Combined_Report_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, outputFilename);
};
