//ExpensesReport.js 
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Generates the JJC Engineering Expenses Report
 * Updates: Separated Classification column and fixed footer borders.
 * @param {Array} expenses - List of expense objects
 * @param {Object} dateRange - { year, quarter, month }
 * @param {Number} targetAmount - Target amount for the footer (default: 12,500,000)
 */
export const buildExpensesSheet = async (workbook, expenses = [], dateRange = {}, targetAmount = 12500000) => {
  const sheet = workbook.addWorksheet('Expenses', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }]
  });

  // =========================================================
  // 1. STYLES CONFIGURATION
  // =========================================================
  const FONT_MAIN = { name: 'Calibri', size: 11 };
  const FONT_BOLD = { name: 'Calibri', size: 11, bold: true };
  const FONT_TITLE = { name: 'Calibri', size: 16, bold: true };
  const FONT_SUBTITLE = { name: 'Calibri', size: 12, bold: true };
  
  const BORDER_ALL = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const ALIGN_CENTER = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const ALIGN_LEFT = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const ALIGN_RIGHT = { vertical: 'middle', horizontal: 'right' };
  
  // Footer Colors
  const COLOR_GREEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } }; // Lime Green
  const COLOR_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
  const COLOR_ORANGE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } }; // Orange Accent

  // =========================================================
  // 2. COLUMN SETUP (9 Columns A-I)
  // =========================================================
  sheet.columns = [
    { key: 'A', width: 13 },  // DATE
    { key: 'B', width: 30 },  // PARTICULARS (Description)
    { key: 'C', width: 20 },  // PARTICULARS (Account Classification)
    { key: 'D', width: 35 },  // COMPANY/SUPPLIER
    { key: 'E', width: 25 },  // ADDRESS
    { key: 'F', width: 18 },  // T.I.N
    { key: 'G', width: 15 },  // O.R./C.I.
    { key: 'H', width: 18 },  // AMOUNT (VAT)
    { key: 'I', width: 18 },  // AMOUNT (NON-VAT)
  ];

  // =========================================================
  // 3. TITLE SECTION (Rows 1-3)
  // =========================================================
  
  // Row 1: Company Name
  sheet.mergeCells('A1:I1');
  const row1 = sheet.getCell('A1');
  row1.value = 'JJC ENGINEERING WORKS AND GENERAL SERVICES';
  row1.font = FONT_TITLE;
  row1.alignment = ALIGN_CENTER;

  // Row 2: Dynamic Period
  sheet.mergeCells('A2:I2');
  const row2 = sheet.getCell('A2');
  let periodText = '';
  
  if (dateRange.quarter) {
    if (dateRange.quarter === 'q1') periodText = 'JANUARY, FEBRUARY, MARCH';
    else if (dateRange.quarter === 'q2') periodText = 'APRIL, MAY, JUNE';
    else if (dateRange.quarter === 'q3') periodText = 'JULY, AUGUST, SEPTEMBER';
    else periodText = 'OCTOBER, NOVEMBER, DECEMBER';
  } else if (dateRange.month) {
    const date = new Date();
    date.setMonth(dateRange.month - 1);
    periodText = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  } else {
    periodText = 'JANUARY, FEBRUARY, MARCH'; 
  }

  row2.value = `SUMMARY OF EXPENSES FOR THE MONTH OF ${periodText} ${dateRange.year || new Date().getFullYear()}`;
  row2.font = FONT_SUBTITLE;
  row2.alignment = ALIGN_CENTER;

  // Row 3: Cash Disbursement
  sheet.mergeCells('A3:I3');
  const row3 = sheet.getCell('A3');
  row3.value = 'CASH DISBURSEMENT';
  row3.font = FONT_SUBTITLE;
  row3.alignment = ALIGN_CENTER;

  // =========================================================
  // 4. HEADER ROW (Rows 4-5)
  // =========================================================
  
  // Define Header Merges & Values
  const headerLayout = [
    { cell: 'A4', val: 'DATE', merge: 'A4:A5' },
    { cell: 'B4', val: 'PARTICULARS', merge: 'B4:C4' }, // Merged for Item & Class
    { cell: 'D4', val: 'COMPANY/SUPPLIER', merge: 'D4:D5' },
    { cell: 'E4', val: 'ADDRESS', merge: 'E4:E5' },
    { cell: 'F4', val: 'T.I.N (VAT)', merge: null },
    { cell: 'F5', val: 'VAT', merge: null },
    { cell: 'G4', val: 'O.R./C.I./S.I.', merge: 'G4:G5' },
    { cell: 'H4', val: 'AMOUNT', merge: 'H4:I4' },
    { cell: 'H5', val: 'VAT', merge: null },
    { cell: 'I5', val: 'NON - VAT', merge: null },
  ];

  headerLayout.forEach(h => {
    const cell = sheet.getCell(h.cell);
    cell.value = h.val;
    cell.font = FONT_BOLD;
    cell.alignment = ALIGN_CENTER;
    if (h.merge) sheet.mergeCells(h.merge);
  });

  // Apply Borders to Header Block
  for (let r = 4; r <= 5; r++) {
    for (let c = 1; c <= 9; c++) {
      const cell = sheet.getRow(r).getCell(c);
      cell.border = BORDER_ALL;
      if (!cell.value && !cell.isMerged) cell.value = ''; 
    }
  }

  // =========================================================
  // 5. DATA POPULATION
  // =========================================================
  let currentRow = 6;
  let totalVat = 0;
  let totalNonVat = 0;

  const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedExpenses.forEach((item) => {
    const row = sheet.getRow(currentRow);
    
    // Financials
    const vat = parseFloat(item.vat_amount ?? item.vatAmount ?? item.amount ?? 0);
    const nonVat = parseFloat(item.non_vat_amount ?? item.nonVatAmount ?? 0);
    totalVat += vat;
    totalNonVat += nonVat;

    // 1. DATE
    const c1 = row.getCell(1);
    c1.value = item.date ? new Date(item.date) : '';
    c1.numFmt = 'd mmm yyyy';
    c1.alignment = ALIGN_CENTER;

    // 2. PARTICULARS (Description)
    const c2 = row.getCell(2);
    c2.value = item.particulars || '';
    c2.alignment = ALIGN_LEFT;

    // 3. PARTICULARS (Classification) - NEW
    const c3 = row.getCell(3);
    c3.value = item.classification || item.account_classification || item.category || ''; 
    c3.alignment = ALIGN_LEFT;

    // 4. COMPANY
    const c4 = row.getCell(4);
    c4.value = item.company_supplier || item.company || '';
    c4.alignment = ALIGN_LEFT;

    // 5. ADDRESS
    const c5 = row.getCell(5);
    c5.value = item.address || item.company_address || 'ANTIPOLO CITY';
    c5.alignment = ALIGN_LEFT;

    // 6. TIN
    const c6 = row.getCell(6);
    c6.value = item.tin || item.company_tin || '';
    c6.alignment = ALIGN_CENTER;

    // 7. OR/CI (REF) - support multiple possible field names returned by API/frontend
    const c7 = row.getCell(7);
    const refValue =
      item.reference_number ||
      item.refNumber ||
      item.or_ci_si ||
      item.orCiSi ||
      item.orCiSi ||
      item.reference ||
      '';
    c7.value = refValue;
    c7.alignment = ALIGN_CENTER;

    // 8. VAT AMOUNT
    const c8 = row.getCell(8);
    c8.value = vat !== 0 ? vat : null;
    c8.numFmt = '#,##0.00';
    c8.alignment = ALIGN_RIGHT;

    // 9. NON-VAT AMOUNT
    const c9 = row.getCell(9);
    c9.value = nonVat !== 0 ? nonVat : null;
    c9.numFmt = '#,##0.00';
    c9.alignment = ALIGN_RIGHT;

    // Apply borders
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER_ALL;
      cell.font = FONT_MAIN;
    }

    currentRow++;
  });

  // =========================================================
  // 6. FOOTER / TOTALS
  // =========================================================
  
  // Helper to create summary rows with specific border/color logic
  const createSummaryRow = (label, value, bgColor = null, nonVatValue = null) => {
    const row = sheet.getRow(currentRow);
    
    // Label Cell (Column G)
    const labelCell = row.getCell(7);
    labelCell.value = label;
    labelCell.font = FONT_BOLD;
    labelCell.alignment = ALIGN_RIGHT;
    labelCell.border = BORDER_ALL;
    if (bgColor) labelCell.fill = bgColor;

    // Value Cell (Column H - VAT)
    const valueCell = row.getCell(8);
    valueCell.value = value;
    valueCell.numFmt = '#,##0.00';
    valueCell.font = FONT_BOLD;
    valueCell.alignment = ALIGN_RIGHT;
    valueCell.border = BORDER_ALL;
    if (bgColor) valueCell.fill = bgColor;

    // Non-VAT Cell (Column I) - Always needs border
    const nonVatCell = row.getCell(9);
    nonVatCell.border = BORDER_ALL; // Fix: Ensure incomplete border is closed
    if (nonVatValue !== null) {
      nonVatCell.value = nonVatValue;
      nonVatCell.numFmt = '#,##0.00';
      nonVatCell.font = FONT_BOLD;
      nonVatCell.alignment = ALIGN_RIGHT;
    }

    currentRow++;
  };

  // 1. TOTAL AMOUNT (White)
  const totalAmount = totalVat;
  createSummaryRow('TOTAL AMOUNT  =', totalVat, null, totalNonVat);

  // 2. CURRENT AMOUNT (Green)
  createSummaryRow('CURRENT AMOUNT =', totalVat, COLOR_GREEN);

  // 3. TARGET AMOUNT (Yellow)
  createSummaryRow('TARGET AMOUNT =', targetAmount, COLOR_YELLOW);

  // 4. AMOUNT NEEDED (Orange)
  const needed = Math.max(0, targetAmount - totalAmount);
  createSummaryRow('AMOUNT NEEDED =', needed, COLOR_ORANGE);

  // 5. Footer Legend Note
  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  const legendCell = sheet.getCell(`A${currentRow}`);
  legendCell.value = 'Note: Column H = VAT, Column I = Non-VAT';
  legendCell.font = { name: 'Calibri', size: 10, italic: true };
  legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
  currentRow++;

};

export const generateExpensesReport = async (expenses = [], dateRange = {}, targetAmount = 12500000) => {
  const workbook = new ExcelJS.Workbook();
  await buildExpensesSheet(workbook, expenses, dateRange, targetAmount);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Expenses_Report_${dateRange.month || dateRange.quarter || 'all'}_${dateRange.year || new Date().getFullYear()}.xlsx`);
};