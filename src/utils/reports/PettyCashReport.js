import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Generates the JJC Engineering Petty Cash Report
 * Exactly matching the provided Excel template layout
 * @param {Array} vouchers - List of voucher objects
 * @param {Object} dateRange - { start, end }
 * @param {Object} summaryMetrics - { beginningBalance, replenishment, totalBudget, totalExpenses, remainingBalance }
 */
export const buildPettyCashSheet = async (workbook, vouchers = [], dateRange = {}, summaryMetrics = {}) => {
  const sheet = workbook.addWorksheet('Petty Cash', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // =========================================================
  // CONSTANTS
  // =========================================================
  const FONT = 'Calibri';
  const CURRENCY_FMT = '#,##0.00';
  const CENTER = { horizontal: 'center', vertical: 'middle' };
  const LEFT = { horizontal: 'left', vertical: 'middle' };
  const RIGHT = { horizontal: 'right', vertical: 'middle' };
  const BORDER_THIN = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDER_ALL = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };

  // Category Colors (matching the image exactly)
  const CATEGORY_COLORS = {
    'WATER': 'FF87CEEB',           // Light Blue
    'MISCELLANEOUS': 'FF9966CC',   // Purple
    'OFFICE SUPPLIES': 'FFFFFF00', // Yellow
    'MAINTENANCE': 'FFFFA500',     // Orange
    'FOOD': 'FFFF69B4',            // Pink
    'ALLOWANCE': 'FFFFCC00',       // Gold/Orange
    'MATERIALS': 'FF4169E1',       // Royal Blue
    'CONSUMABLES': 'FF20B2AA',     // Teal
    'OFFICE EQUIPMENT': 'FF800080', // Dark Purple
    'FUEL & TRASPORTATION': 'FF98FB98', // Pale Green
    'COMMUNICATION': 'FFFFD700',   // Gold
    'DONATIONS': 'FFFF6347',       // Tomato
    'EQUIPMENT': 'FF708090',       // Slate Gray
    'MEDICAL': 'FFDC143C',         // Crimson
    'OTHER SERVICES': 'FF8FBC8F',  // Dark Sea Green
    'REPRESENTATION': 'FFDDA0DD',  // Plum
    'UTILITIES': 'FFB0C4DE',       // Light Steel Blue
  };

  // Fixed expense account order (matching image)
  const EXPENSE_ACCOUNTS = [
    'ALLOWANCE', 'COMMUNICATION', 'CONSUMABLES', 'DONATIONS', 'EQUIPMENT',
    'FOOD', 'FUEL & TRASPORTATION', 'MAINTENANCE', 'MATERIALS', 'MEDICAL',
    'MISCELLANEOUS', 'OFFICE EQUIPMENT', 'OFFICE SUPPLIES', 'OTHER SERVICES',
    'REPRESENTATION', 'UTILITIES', 'WATER'
  ];

  // =========================================================
  // COLUMN SETUP
  // =========================================================
  sheet.columns = [
    { key: 'A', width: 2 },   // Spacer
    { key: 'B', width: 12 },  // DATE
    { key: 'C', width: 12 },  // PARTICULARS (Voucher #)
    { key: 'D', width: 18 },  // PARTICULARS (Category) - with color
    { key: 'E', width: 30 },  // COMPANY/SUPPLIER
    { key: 'F', width: 12 },  // AMOUNT VAT
    { key: 'G', width: 12 },  // AMOUNT NON-VAT
    { key: 'H', width: 30 },  // PURPOSE
    { key: 'I', width: 20 },  // REMARKS
    { key: 'J', width: 3 },   // Spacer
    { key: 'K', width: 22 },  // ACCOUNT
    { key: 'L', width: 12 },  // VAT
    { key: 'M', width: 12 },  // NON-VAT
  ];

  // =========================================================
  // DATA PREPARATION
  // =========================================================
  const accountSummaries = {};
  EXPENSE_ACCOUNTS.forEach(acc => accountSummaries[acc] = { vat: 0, nonVat: 0 });

  let grandTotalVat = 0;
  let grandTotalNonVat = 0;

  vouchers.forEach(v => {
    const vat = parseFloat(v.amount_vat || 0);
    const nonVat = parseFloat(v.amount_non_vat || 0);

    // Normalize category
    let category = (v.account_classification || v.particulars || 'MISCELLANEOUS').trim().toUpperCase();
    if (!EXPENSE_ACCOUNTS.includes(category)) category = 'MISCELLANEOUS';

    if (accountSummaries[category]) {
      accountSummaries[category].vat += vat;
      accountSummaries[category].nonVat += nonVat;
    }

    grandTotalVat += vat;
    grandTotalNonVat += nonVat;
  });

  const sortedVouchers = [...vouchers].sort((a, b) => new Date(a.voucher_date) - new Date(b.voucher_date));

  const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

  const getReportPeriod = () => {
    if (dateRange?.label) {
      return { type: 'custom', label: dateRange.label, fileLabel: dateRange.label };
    }

    if (dateRange?.allTime) {
      return { type: 'all-time', label: 'ALL-TIME REPORT', fileLabel: 'All-Time_Report' };
    }

    if (dateRange?.year && dateRange?.month === 'all') {
      return { type: 'year', label: `${dateRange.year}`, fileLabel: `${dateRange.year}` };
    }

    if (dateRange?.year === 'all' && typeof dateRange?.month === 'number') {
      const monthLabel = new Date(2000, dateRange.month - 1, 1)
        .toLocaleDateString('en-US', { month: 'long' })
        .toUpperCase();
      return { type: 'month-all-years', label: `ALL YEARS - ${monthLabel}`, fileLabel: `All-Years_${monthLabel}` };
    }

    if (isValidDate(dateRange?.start)) {
      const label = new Date(dateRange.start)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        .toUpperCase();
      return { type: 'month', label, fileLabel: label.replace(/ /g, '_') };
    }

    return { type: 'all-time', label: 'ALL-TIME REPORT', fileLabel: 'All-Time_Report' };
  };

  const reportPeriod = getReportPeriod();

  // =========================================================
  // ROW 1: COMPANY NAME
  // =========================================================
  sheet.mergeCells('B1:M1');
  const titleCell = sheet.getCell('B1');
  titleCell.value = 'JJC ENGINEERING WORKS AND GENERAL SERVICES';
  titleCell.font = { name: FONT, size: 14, bold: true };
  titleCell.alignment = CENTER;

  // =========================================================
  // ROW 2: REPORT TITLE
  // =========================================================
  sheet.mergeCells('B2:I2');
  const subtitleCell = sheet.getCell('B2');
  if (reportPeriod.type === 'year') {
    subtitleCell.value = `SUMMARY OF EXPENSES FOR THE YEAR OF ${reportPeriod.label} (Report 1)`;
  } else if (reportPeriod.type === 'all-time') {
    subtitleCell.value = 'SUMMARY OF EXPENSES - ALL-TIME REPORT (Report 1)';
  } else if (reportPeriod.type === 'month-all-years') {
    subtitleCell.value = `SUMMARY OF EXPENSES FOR ${reportPeriod.label} (Report 1)`;
  } else {
    subtitleCell.value = `SUMMARY OF EXPENSES FOR THE MONTH OF ${reportPeriod.label} (Report 1)`;
  }
  subtitleCell.font = { name: FONT, size: 11, bold: true };
  subtitleCell.alignment = CENTER;

  // =========================================================
  // ROW 3: COLUMN HEADERS (Main table + Account summary table)
  // =========================================================
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  const headerFont = { name: FONT, size: 10, bold: true };

  // Main table headers - Row 3
  const mainHeaders = [
    { col: 'B', text: 'DATE' },
    { col: 'C', text: 'PARTICULARS', mergeWith: 'D' },
    { col: 'E', text: 'COMPANY/SUPPLIER' },
    { col: 'F', text: 'AMOUNT', mergeWith: 'G' },
    { col: 'H', text: 'PURPOSE' },
    { col: 'I', text: 'REMARKS' },
  ];

  mainHeaders.forEach(h => {
    const cell = sheet.getCell(`${h.col}3`);
    cell.value = h.text;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = CENTER;
    cell.border = BORDER_ALL;

    if (h.mergeWith) {
      sheet.mergeCells(`${h.col}3:${h.mergeWith}3`);
    }
  });

  // Side table headers - Row 3
  const sideHeaders = [
    { col: 'K', text: 'ACCOUNT' },
    { col: 'L', text: 'VAT' },
    { col: 'M', text: 'NON-VAT' },
  ];

  sideHeaders.forEach(h => {
    const cell = sheet.getCell(`${h.col}3`);
    cell.value = h.text;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = CENTER;
    cell.border = BORDER_ALL;
  });

  // =========================================================
  // ROW 4: SUB-HEADERS (VAT / NON-VAT under AMOUNT)
  // =========================================================
  const subHeaderRow = sheet.getRow(4);
  
  // VAT sub-header
  const vatSubHeader = subHeaderRow.getCell(6); // F
  vatSubHeader.value = 'VAT';
  vatSubHeader.fill = headerFill;
  vatSubHeader.font = headerFont;
  vatSubHeader.alignment = CENTER;
  vatSubHeader.border = BORDER_ALL;

  // NON-VAT sub-header
  const nonVatSubHeader = subHeaderRow.getCell(7); // G
  nonVatSubHeader.value = 'NON - VAT';
  nonVatSubHeader.fill = headerFill;
  nonVatSubHeader.font = headerFont;
  nonVatSubHeader.alignment = CENTER;
  nonVatSubHeader.border = BORDER_ALL;

  // =========================================================
  // DATA ROWS (Starting from Row 5)
  // =========================================================
  const dataStartRow = 5;
  const numDataRows = Math.max(sortedVouchers.length, EXPENSE_ACCOUNTS.length);

  for (let i = 0; i < numDataRows; i++) {
    const rowIdx = dataStartRow + i;
    const row = sheet.getRow(rowIdx);
    row.font = { name: FONT, size: 10 };

    // === LEFT SIDE: VOUCHER REGISTER ===
    if (i < sortedVouchers.length) {
      const v = sortedVouchers[i];
      const vat = parseFloat(v.amount_vat || 0);
      const nonVat = parseFloat(v.amount_non_vat || 0);
      const category = (v.account_classification || v.particulars || 'MISCELLANEOUS').trim().toUpperCase();

      // DATE (Column B)
      const dateCell = row.getCell(2);
      if (v.voucher_date) {
        dateCell.value = new Date(v.voucher_date);
        dateCell.numFmt = 'm/d/yyyy';
      }
      dateCell.border = BORDER_ALL;

      // VOUCHER NUMBER (Column C)
      const voucherCell = row.getCell(3);
      voucherCell.value = v.voucher_number || '';
      voucherCell.border = BORDER_ALL;

      // CATEGORY with COLOR (Column D)
      const categoryCell = row.getCell(4);
      categoryCell.value = category;
      categoryCell.alignment = CENTER;
      categoryCell.border = BORDER_ALL;
      if (CATEGORY_COLORS[category]) {
        categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CATEGORY_COLORS[category] } };
        categoryCell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }

      // COMPANY/SUPPLIER (Column E)
      const companyCell = row.getCell(5);
      companyCell.value = v.company_supplier || v.payee || '';
      companyCell.border = BORDER_ALL;

      // VAT AMOUNT (Column F)
      const vatCell = row.getCell(6);
      if (vat > 0) {
        vatCell.value = vat;
        vatCell.numFmt = CURRENCY_FMT;
      }
      vatCell.border = BORDER_ALL;

      // NON-VAT AMOUNT (Column G)
      const nonVatCell = row.getCell(7);
      if (nonVat > 0) {
        nonVatCell.value = nonVat;
        nonVatCell.numFmt = CURRENCY_FMT;
      }
      nonVatCell.border = BORDER_ALL;

      // PURPOSE (Column H)
      const purposeCell = row.getCell(8);
      purposeCell.value = v.purpose || '';
      purposeCell.border = BORDER_ALL;

      // REMARKS (Column I)
      const remarksCell = row.getCell(9);
      remarksCell.value = v.remarks || '';
      remarksCell.border = BORDER_ALL;
      // Color the remarks cell if it has special text (like LUCENA, KUYA DONDON)
      if (v.remarks) {
        remarksCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
        remarksCell.font = { name: FONT, size: 10, color: { argb: 'FFFF6600' } };
      }
    }

    // === RIGHT SIDE: ACCOUNT SUMMARY ===
    // Account summary starts at row 4 (first account in row 4, after header in row 3)
    if (i < EXPENSE_ACCOUNTS.length) {
      const accName = EXPENSE_ACCOUNTS[i];
      const stats = accountSummaries[accName];

      // Use row 4 + i for account summary (so it starts at row 4)
      const accRowIdx = 4 + i;
      const accRow = sheet.getRow(accRowIdx);

      // ACCOUNT NAME (Column K)
      const accCell = accRow.getCell(11);
      accCell.value = accName;
      accCell.border = BORDER_ALL;
      if (CATEGORY_COLORS[accName]) {
        accCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CATEGORY_COLORS[accName] } };
        accCell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }

      // VAT TOTAL (Column L)
      const accVatCell = accRow.getCell(12);
      accVatCell.value = stats.vat || 0;
      accVatCell.numFmt = CURRENCY_FMT;
      accVatCell.border = BORDER_ALL;

      // NON-VAT TOTAL (Column M)
      const accNonVatCell = accRow.getCell(13);
      accNonVatCell.value = stats.nonVat || 0;
      accNonVatCell.numFmt = CURRENCY_FMT;
      accNonVatCell.border = BORDER_ALL;
    }
  }

  // =========================================================
  // ACCOUNT SUMMARY TOTAL ROW (after all accounts)
  // =========================================================
  const accountTotalRowIdx = 4 + EXPENSE_ACCOUNTS.length; // Row after last account
  const accountTotalRow = sheet.getRow(accountTotalRowIdx);

  const accTotalLabel = accountTotalRow.getCell(11);
  accTotalLabel.value = 'TOTAL';
  accTotalLabel.font = { name: FONT, size: 11, bold: true };
  accTotalLabel.alignment = CENTER;
  accTotalLabel.border = BORDER_ALL;
  accTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

  const accTotalVat = accountTotalRow.getCell(12);
  accTotalVat.value = grandTotalVat;
  accTotalVat.numFmt = CURRENCY_FMT;
  accTotalVat.font = { name: FONT, size: 11, bold: true };
  accTotalVat.border = BORDER_ALL;
  accTotalVat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

  const accTotalNonVat = accountTotalRow.getCell(13);
  accTotalNonVat.value = grandTotalNonVat;
  accTotalNonVat.numFmt = CURRENCY_FMT;
  accTotalNonVat.font = { name: FONT, size: 11, bold: true };
  accTotalNonVat.border = BORDER_ALL;
  accTotalNonVat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

  // =========================================================
  // TOTALS SECTION (After voucher data rows)
  // =========================================================
  const totalsStartRow = dataStartRow + sortedVouchers.length + 1;

  // --- TOTAL VAT / TOTAL NON-VAT headers ---
  const totalVatLabelRow = sheet.getRow(totalsStartRow);
  
  const totalVatHeaderCell = totalVatLabelRow.getCell(6);
  totalVatHeaderCell.value = 'TOTAL\nVAT';
  totalVatHeaderCell.font = { name: FONT, size: 10, bold: true };
  totalVatHeaderCell.alignment = CENTER;
  totalVatHeaderCell.border = BORDER_ALL;
  totalVatHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

  const totalNonVatHeaderCell = totalVatLabelRow.getCell(7);
  totalNonVatHeaderCell.value = 'TOTAL\nNON-VAT';
  totalNonVatHeaderCell.font = { name: FONT, size: 10, bold: true };
  totalNonVatHeaderCell.alignment = CENTER;
  totalNonVatHeaderCell.border = BORDER_ALL;
  totalNonVatHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

  // Values row
  const totalValuesRow = sheet.getRow(totalsStartRow + 1);
  
  const totalVatValue = totalValuesRow.getCell(6);
  totalVatValue.value = grandTotalVat;
  totalVatValue.numFmt = CURRENCY_FMT;
  totalVatValue.border = BORDER_ALL;
  totalVatValue.font = { name: FONT, size: 10, bold: true };

  const totalNonVatValue = totalValuesRow.getCell(7);
  totalNonVatValue.value = grandTotalNonVat;
  totalNonVatValue.numFmt = CURRENCY_FMT;
  totalNonVatValue.border = BORDER_ALL;
  totalNonVatValue.font = { name: FONT, size: 10, bold: true };

  // GRAND TOTAL label
  const grandTotalLabelCell = totalValuesRow.getCell(8);
  grandTotalLabelCell.value = 'GRAND TOTAL';
  grandTotalLabelCell.font = { name: FONT, size: 12, bold: true };
  grandTotalLabelCell.alignment = CENTER;
  grandTotalLabelCell.border = BORDER_ALL;

  // GRAND TOTAL value
  const grandTotalValueCell = totalValuesRow.getCell(9);
  grandTotalValueCell.value = grandTotalVat + grandTotalNonVat;
  grandTotalValueCell.numFmt = CURRENCY_FMT;
  grandTotalValueCell.font = { name: FONT, size: 14, bold: true };
  grandTotalValueCell.border = BORDER_ALL;
  grandTotalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

  // Grand total sum shown to the right (as in image: 38,060.00)
  const grandTotalSumCell = totalValuesRow.getCell(13);
  grandTotalSumCell.value = grandTotalVat + grandTotalNonVat;
  grandTotalSumCell.numFmt = CURRENCY_FMT;
  grandTotalSumCell.font = { name: FONT, size: 11 };
  grandTotalSumCell.border = BORDER_ALL;

  // =========================================================
  // REMAINING BALANCE ROW
  // =========================================================
  const remainingRow = sheet.getRow(totalsStartRow + 3);
  
  sheet.mergeCells(`F${totalsStartRow + 3}:H${totalsStartRow + 3}`);
  const remainingLabel = remainingRow.getCell(6);
  remainingLabel.value = 'REMAINING BALANCE';
  remainingLabel.font = { name: FONT, size: 12, bold: true };
  remainingLabel.alignment = CENTER;
  remainingLabel.border = BORDER_ALL;

  const remainingValue = remainingRow.getCell(9);
  remainingValue.value = summaryMetrics.remainingBalance || ((summaryMetrics.totalBudget || 0) - (grandTotalVat + grandTotalNonVat));
  remainingValue.numFmt = CURRENCY_FMT;
  remainingValue.font = { name: FONT, size: 14, bold: true, color: { argb: 'FF008000' } };
  remainingValue.border = BORDER_ALL;
  remainingValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

  // =========================================================
  // SUMMARY BOX (Bottom Section)
  // =========================================================
  const summaryStartRow = totalsStartRow + 5;
  const summaryFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  const summaryOrangeFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  const summaryRedFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

  // SUMMARY Header
  sheet.mergeCells(`G${summaryStartRow}:I${summaryStartRow}`);
  const summaryHeader = sheet.getCell(`G${summaryStartRow}`);
  summaryHeader.value = 'SUMMARY';
  summaryHeader.font = { name: FONT, size: 11, bold: true };
  summaryHeader.alignment = CENTER;
  summaryHeader.border = BORDER_ALL;
  summaryHeader.fill = summaryFill;

  // Calculate previous balance date
  const prevBalanceDate = isValidDate(dateRange?.start)
    ? new Date(new Date(dateRange.start).setDate(new Date(dateRange.start).getDate() - 1))
        .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : 'N/A';

  // Summary Items
  const summaryItems = [
    { 
      label: `PETTY CASH BALANCE (${prevBalanceDate})`, 
      value: summaryMetrics.beginningBalance || 0,
      labelFill: null,
      valueFill: null
    },
    { 
      label: 'PETTY CASH REPLENISHMENT', 
      value: summaryMetrics.replenishment || 0,
      labelFill: null,
      valueFill: null
    },
    { 
      label: 'TOTAL PETTY CASH', 
      value: summaryMetrics.totalBudget || 0,
      labelFill: summaryOrangeFill,
      valueFill: summaryOrangeFill
    },
    { 
      label: 'TOTAL EXPENSES FOR THE PERIOD', 
      value: grandTotalVat + grandTotalNonVat,
      labelFill: summaryRedFill,
      valueFill: null,
      labelColor: 'FFFFFFFF'
    },
    { 
      label: 'REMAINING BALANCE AS OF TODAY', 
      value: summaryMetrics.remainingBalance || ((summaryMetrics.totalBudget || 0) - (grandTotalVat + grandTotalNonVat)),
      labelFill: summaryRedFill,
      valueFill: null,
      labelColor: 'FFFFFFFF',
      valueColor: 'FFFF0000',
      valueBold: true,
      valueSize: 14
    },
  ];

  summaryItems.forEach((item, idx) => {
    const rowNum = summaryStartRow + 1 + idx;
    const row = sheet.getRow(rowNum);

    // Merge label cells
    sheet.mergeCells(`G${rowNum}:H${rowNum}`);
    const labelCell = row.getCell(7);
    labelCell.value = item.label;
    labelCell.font = { 
      name: FONT, 
      size: 10, 
      bold: true,
      color: item.labelColor ? { argb: item.labelColor } : undefined
    };
    labelCell.alignment = LEFT;
    labelCell.border = BORDER_ALL;
    if (item.labelFill) labelCell.fill = item.labelFill;

    // Value cell
    const valueCell = row.getCell(9);
    valueCell.value = item.value;
    valueCell.numFmt = CURRENCY_FMT;
    valueCell.font = { 
      name: FONT, 
      size: item.valueSize || 10, 
      bold: item.valueBold || false,
      color: item.valueColor ? { argb: item.valueColor } : undefined
    };
    valueCell.alignment = RIGHT;
    valueCell.border = BORDER_ALL;
    if (item.valueFill) valueCell.fill = item.valueFill;
  });

};

export const generatePettyCashReport = async (vouchers = [], dateRange = {}, summaryMetrics = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JJC Engineering Finance';
  workbook.created = new Date();
  await buildPettyCashSheet(workbook, vouchers, dateRange, summaryMetrics);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `PettyCash_Report_${dateRange.start || new Date().getFullYear()}.xlsx`);
};
