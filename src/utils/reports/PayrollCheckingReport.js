/**
 * PayrollCheckingReport.js
 *
 * Generates an Excel payroll checking sheet for JJC Engineering Works.
 *
 * STABILITY DESIGN — all known ExcelJS XML-corruption sources avoided:
 *  1. ZERO mergeCells() calls         — merge XML is the #1 corruption source
 *  2. blank() writes a real cell      — rows with height but no cells = invalid XML
 *  3. No font object spreading        — spread copies prototype props → bad XML attrs
 *  4. pageSetup set after ws creation — constructor pageSetup unreliable in ExcelJS
 *  5. All strings sanitized           — API values may contain chars illegal in XML 1.0
 *  6. fitToWidth/fitToHeight explicit — required when fitToPage is true
 *  7. Amounts are always Number type  — string-concatenating '₱ ' kills numFmt
 *
 * DYNAMIC CALCULATIONS:
 *  Static  → line-item values (grossPayroll, fees, petty, canteen, etc.)
 *  Formula → all totals, so editing any cell in Excel recalculates everything:
 *
 *   CASH & COINS      = =F{totalBalanceRow}          (mirrors TOTAL BALANCE)
 *   TOTAL BALANCE     = =SUM(F{firstLine}:F{lastLine})  — grossPayroll + additionalFees only
 *   PAYROLL (summary) = =F{totalBalanceRow}          (same ref as above)
 *   TOTAL CASH NEED   = =SUM(F{summaryStart}:F{summaryEnd})
 *
 *  adjustedGross (JS only, for TOTAL CASH NEED fallback)
 *              = grossPayroll + totalFees + adjustment
 *
 * Column layout (A–F, no merges):
 *   A (2)   left margin
 *   B (44)  date · descriptions · summary labels · TOTAL CASH NEED · footer
 *   C (5)   currency prefix — "Php" or "₱"
 *   D (20)  right-side labels — "CASH & COINS =" / "TOTAL BALANCE ="
 *   E (2)   spacer
 *   F (18)  ALL monetary values
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import apiService from '../api/api-service';

// ─────────────────────────────────────────────────────────────────────────────
// XML STRING SANITIZER
// ─────────────────────────────────────────────────────────────────────────────

function sanitize(value) {
  if (typeof value !== 'string') return value;
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uD800-\uDFFF]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE CONSTANTS — plain object literals only, never spread
// ─────────────────────────────────────────────────────────────────────────────

const FONT      = 'Calibri';
const MONEY_FMT = '₱ #,##0.00';

const FONT_BOLD         = { name: FONT, bold: true,  size: 11 };
const FONT_BOLDLG       = { name: FONT, bold: true,  size: 13 };
const FONT_BOLDUL       = { name: FONT, bold: true,  size: 11, underline: true };
const FONT_NORMAL       = { name: FONT, bold: false, size: 11 };
const FONT_ITALIC       = { name: FONT, bold: false, size: 11, italic: true };
const FONT_SMALL_GRAY   = { name: FONT, bold: false, size: 9, color: { argb: 'FF888888' } };
const FONT_SMALL_LTGRAY = { name: FONT, bold: false, size: 9, italic: true, color: { argb: 'FFAAAAAA' } };

const ALIGN_LEFT  = { horizontal: 'left',  vertical: 'middle' };
const ALIGN_RIGHT = { horizontal: 'right', vertical: 'middle' };

const medium    = { style: 'medium', color: { argb: 'FF000000' } };
const BOX_THICK = { top: medium, bottom: medium, left: medium, right: medium };

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRecord(id) {
  const res = await apiService.finance.getPayrollCheckingRecord(id);
  return res?.data ?? null;
}

async function fetchAllRecords() {
  const listRes = await apiService.finance.getPayrollCheckingRecords();
  const list    = listRes?.data ?? [];
  const hydrated = await Promise.all(
    list.map((r) => fetchRecord(r.id).catch(() => r))
  );
  return hydrated.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED VALUES  (used as formula fallback results so Excel shows correct
//                  values even before the user triggers a recalculation)
// ─────────────────────────────────────────────────────────────────────────────

function computeRecord(record) {
  const grossPayroll = Number(record.gross_payroll ?? record.net_payroll ?? 0);
  const adjustment   = Number(record.adjustment_cash ?? 0);
  const totalFees    = Number(record.total_additional_fees ?? 0);
  const totalReimbs  = Number(record.total_reimbursements  ?? 0);
  const petty        = Number(record.petty_cash_replenishment ?? 50_000);
  const canteen      = Number(record.canteen ?? 7_000);
  const monthlyBills = Number(record.monthly_bills_total ?? 0);

  // totalBalance  = TOTAL BALANCE row formula result:
  //                 grossPayroll + additionalFees ONLY (adjustment is NOT a line-item row)
  const totalBalance = grossPayroll + totalFees;

  // adjustedGross = grossPayroll + totalFees + adjustment
  //                 used as the PAYROLL summary line value
  const adjustedGross = grossPayroll + totalFees + adjustment;

  const totalCashNeeded = adjustedGross + petty + canteen + monthlyBills + totalReimbs;

  return {
    grossPayroll,
    adjustment,
    totalBalance,
    adjustedGross,
    petty,
    canteen,
    monthlyBills,
    totalCashNeeded,
    additionalFees: record.additional_fees ?? [],
    reimbursements: record.reimbursements  ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDateHeader(cutoffDate) {
  return new Date(cutoffDate).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatPeriodLabel(cutoffDate, cutoffPeriod) {
  const d       = new Date(cutoffDate);
  const month   = d.toLocaleDateString('en-PH', { month: 'long' });
  const year    = d.getFullYear();
  if (cutoffPeriod === '1st') return `${month} 1 - 15, ${year}`;
  const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
  return `${month} 16 - ${lastDay}, ${year}`;
}

function sheetName(record) {
  const d  = new Date(record.cutoff_date);
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mo} ${d.getFullYear()} - ${record.cutoff_period}`.substring(0, 31);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildCheckingSheet(wb, record) {
  const cv = computeRecord(record);

  const ws = wb.addWorksheet(sheetName(record), {
    views: [{ showGridLines: false }],
  });

  // pageSetup must be set AFTER worksheet creation
  ws.pageSetup.paperSize   = 9;
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.fitToPage   = true;
  ws.pageSetup.fitToWidth  = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins     = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

  ws.getColumn('A').width = 2;
  ws.getColumn('B').width = 44;
  ws.getColumn('C').width = 5;
  ws.getColumn('D').width = 20;
  ws.getColumn('E').width = 2;
  ws.getColumn('F').width = 18;

  let row = 1;

  const COL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };

  // ── Cell helpers ──────────────────────────────────────────────────────────

  const set = (colLetter, r, value, font, align, border, numFmt) => {
    const c = ws.getRow(r).getCell(COL[colLetter]);
    if (value !== undefined && value !== null) {
      c.value = typeof value === 'string' ? sanitize(value) : value;
    }
    if (font)   c.font      = font;
    if (align)  c.alignment = align;
    if (border) c.border    = border;
    if (numFmt) c.numFmt    = numFmt;
    return c;
  };

  // Static numeric value — user can edit; formulas reference these cells
  const money = (colLetter, r, amount, font, border) =>
    set(colLetter, r, Number(amount), font, ALIGN_RIGHT, border ?? null, MONEY_FMT);

  // Dynamic formula cell — recalculates in Excel when referenced cells change.
  // `result` is the pre-computed fallback shown before Excel recalculates.
  const formula = (colLetter, r, expr, result, font, border) =>
    set(colLetter, r, { formula: expr, result: Number(result) },
        font, ALIGN_RIGHT, border ?? null, MONEY_FMT);

  // blank() writes an empty cell so the row has a valid <c> XML element
  const blank = (height = 10) => {
    ws.getRow(row).height = height;
    set('B', row, '');
    row++;
  };

  // =========================================================================
  // SECTION 1 — Header
  //   CASH & COINS is a formula =F{totalBalanceRow}.
  //   We don't know that row yet, so we save the cell reference and fill it
  //   in after TOTAL BALANCE is written.
  // =========================================================================

  ws.getRow(row).height = 24;
  set('B', row, formatDateHeader(record.cutoff_date), FONT_BOLD, ALIGN_LEFT);
  set('D', row, 'CASH & COINS  =', FONT_BOLD, ALIGN_RIGHT);
  // Static value = adjustedGross (grossPayroll + totalFees + adjustment)
  const cashCoinsCell = ws.getRow(row).getCell(COL['F']);
  cashCoinsCell.value     = cv.adjustedGross;
  cashCoinsCell.font      = FONT_BOLD;
  cashCoinsCell.alignment = ALIGN_RIGHT;
  cashCoinsCell.border    = BOX_THICK;
  cashCoinsCell.numFmt    = MONEY_FMT;
  row++;

  blank(14);

  // =========================================================================
  // SECTION 2 — Line items  (all STATIC — these are the editable inputs)
  // =========================================================================

  // Track the first and last line-item rows for the TOTAL BALANCE SUM formula
  const firstLineRow = row;

  // Monthly payroll — STATIC
  ws.getRow(row).height = 22;
  set  ('B', row,
    `MONTHLY PAYROLL  (${formatPeriodLabel(record.cutoff_date, record.cutoff_period)})`,
    FONT_BOLDUL, ALIGN_LEFT);
  money('F', row, cv.adjustedGross, FONT_NORMAL);
  row++;

  // Additional fees — STATIC (dynamic count from API)
  for (const fee of cv.additionalFees) {
    ws.getRow(row).height = 18;
    set  ('B', row, sanitize(fee.label ?? ''), FONT_NORMAL, ALIGN_LEFT);
    money('F', row, Number(fee.amount ?? 0), FONT_NORMAL);
    row++;
  }

  // Last line-item row (the row just written above)
  const lastLineRow = row - 1;

  blank(12);

  // ── TOTAL BALANCE — DYNAMIC FORMULA ──────────────────────────────────────
  // =SUM(F{firstLineRow}:F{lastLineRow})  →  grossPayroll + additionalFees ONLY
  // adjustment is not a written line-item row, so it is correctly excluded.
  ws.getRow(row).height = 22;
  set('D', row, 'TOTAL BALANCE  =', FONT_BOLD, ALIGN_RIGHT);
  formula('F', row,
    `SUM(F${firstLineRow}:F${lastLineRow})`,
    cv.totalBalance,     // fallback = grossPayroll + totalFees (no adjustment)
    FONT_BOLD, BOX_THICK);
  const totalBalanceRow = row;
  row++;

  blank(18);

  // =========================================================================
  // SECTION 3 — Summary
  // =========================================================================

  ws.getRow(row).height = 20;
  set('B', row, 'SUMMARY', FONT_BOLD, ALIGN_LEFT);
  row++;

  const summaryStartRow = row;

  // summaryLine for STATIC values
  const summaryLine = (label, amount, font = FONT_NORMAL) => {
    ws.getRow(row).height = 18;
    set  ('B', row, sanitize(label), font, ALIGN_LEFT);
    money('F', row, amount, font);
    row++;
  };

  // PAYROLL — DYNAMIC: mirrors TOTAL BALANCE (grossPayroll + additionalFees)
  ws.getRow(row).height = 18;
  set    ('B', row, 'PAYROLL', FONT_NORMAL, ALIGN_LEFT);
  formula('F', row,
    `F${totalBalanceRow}`,
    cv.adjustedGross,     // fallback = grossPayroll + totalFees
    FONT_NORMAL);
  row++;

  // Fixed cost lines — STATIC
  summaryLine('PETTY CASH REPLENISHMENT', cv.petty);
  summaryLine('CANTEEN',                  cv.canteen);
  summaryLine('MONTHLY BILLS',            cv.monthlyBills);

  // Reimbursements — STATIC (dynamic count from API)
  for (const reimb of cv.reimbursements) {
    summaryLine(reimb.label ?? '', Number(reimb.amount ?? 0));
  }

  const summaryEndRow = row - 1;

  blank(14);

  // ── TOTAL CASH NEED — DYNAMIC FORMULA ────────────────────────────────────
  // =SUM(F{summaryStartRow}:F{summaryEndRow})
  // = PAYROLL (totalBalance) + ADJUSTMENT + petty + canteen + bills + reimbs
  ws.getRow(row).height = 26;
  set    ('B', row, 'TOTAL CASH NEED', FONT_BOLDLG, ALIGN_LEFT);
  formula('F', row,
    `SUM(F${summaryStartRow}:F${summaryEndRow})`,
    cv.totalCashNeeded,  // fallback result
    FONT_BOLDLG, BOX_THICK);
  row++;

  // =========================================================================
  // SECTION 4 — Footer
  // =========================================================================

  if (record.remarks) {
    blank(12);
    ws.getRow(row).height = 18;
    set('B', row, `Remarks: ${sanitize(record.remarks)}`, FONT_ITALIC, ALIGN_LEFT);
    row++;
  }

  blank(14);

  const statusParts = [
    `Status: ${sanitize((record.status ?? 'draft').toUpperCase())}`,
    record.created_by_name  ? `Prepared by: ${sanitize(record.created_by_name)}`  : '',
    record.approved_by_name ? `Approved by: ${sanitize(record.approved_by_name)}` : '',
  ].filter(Boolean);

  ws.getRow(row).height = 16;
  set('B', row, statusParts.join('     |     '), FONT_SMALL_GRAY, ALIGN_LEFT);
  row++;

  ws.getRow(row).height = 14;
  set('B', row, 'Report generated by JJC Finance Hub', FONT_SMALL_LTGRAY, ALIGN_LEFT);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function PayrollCheckingReport(recordId = null) {
  let records;

  if (recordId) {
    const single = await fetchRecord(recordId);
    if (!single) throw new Error(`Record ${recordId} not found.`);
    records = [single];
  } else {
    records = await fetchAllRecords();
    if (!records.length) throw new Error('No payroll checking records found.');
  }

  records.sort((a, b) => {
    const da = new Date(a.cutoff_date);
    const db = new Date(b.cutoff_date);
    return da - db || (a.cutoff_period === '1st' ? -1 : 1);
  });

  const wb      = new ExcelJS.Workbook();
  wb.creator    = 'JJC Engineering Finance Hub';
  wb.created    = new Date();
  wb.modified   = new Date();

  for (const record of records) {
    buildCheckingSheet(wb, record);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const today    = new Date().toISOString().slice(0, 10);
  const filename = recordId
    ? `payroll_checking_${records[0].cutoff_date}_${records[0].cutoff_period}.xlsx`
    : `payroll_checking_all_${today}.xlsx`;

  saveAs(blob, filename);
}

export { buildCheckingSheet };