import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generates the Aesthetic JJC Engineering Cash Voucher List
 * @param {Array} vouchers - List of cash voucher objects
 * @param {Object} dateRange - { start, end }
 */
export const buildCashVoucherSheet = async (workbook, vouchers = [], dateRange = {}) => {
  const sheet = workbook.addWorksheet('Cash Vouchers', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }]
  });

  // =========================================================
  // 1. AESTHETIC CONFIGURATION
  // =========================================================
  const STYLES = {
    font: 'Calibri',
    headerFont: { name: 'Calibri', size: 14, bold: true },
    subHeaderFont: { name: 'Calibri', size: 12, bold: true },
    columnTitleFont: { name: 'Calibri', size: 10, bold: true },
    dataFont: { name: 'Calibri', size: 10 },
    
    // Colors based on the screenshot
    colors: {
      headerBg: 'FFFFFFFF', // White
      caFundsBg: 'FFDDEBF7', // Pastel Blue
      releasedBg: 'FFF4C7C3', // Pastel Red
      grayBg: 'FFF2F2F2',    // Light Gray (for empty/pending)
      borderColor: 'FF000000' // Black
    },
    
    // Borders
    borderAll: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    },

    // Alignment
    alignCenter: { horizontal: 'center', vertical: 'middle', wrapText: true },
    alignLeft: { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }, // Indent makes text look cleaner
    alignRight: { horizontal: 'right', vertical: 'middle', indent: 1 },
    
    // Number Formats
    currencyFmt: '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)' // Accounting format aligned
  };

  // =========================================================
  // 2. COLUMN SETUP
  // =========================================================
  // Adjusted widths to match the image proportions better
  sheet.columns = [
    { key: 'A', width: 2 },   // Spacer
    { key: 'B', width: 18 },  // DATE
    { key: 'C', width: 35 },  // COMPANY / PAYEE
    { key: 'D', width: 15 },  // VOUCHER NO.
    { key: 'E', width: 18 },  // CASH SOURCE
    { key: 'F', width: 15 },  // INVOICE NO.
    { key: 'G', width: 12 },  // PO #
    { key: 'H', width: 16 },  // DR_AMOUNT
    { key: 'I', width: 16 },  // CR_AMOUNT
    { key: 'J', width: 35 },  // REMARKS
    { key: 'K', width: 15 },  // STATUS
    { key: 'L', width: 8 },   // WITH COPY
  ];

  // =========================================================
  // 3. HEADER SECTION
  // =========================================================
  
  // -- Row 1: Company Name --
  sheet.mergeCells('B1:L1');
  const r1 = sheet.getCell('B1');
  r1.value = 'JJC ENGINEERING WORKS & GENERAL SERVICES';
  r1.font = STYLES.headerFont;
  r1.alignment = STYLES.alignCenter;
  r1.border = { top: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }; // Thicker outer border

  // -- Row 2: Report Title --
  sheet.mergeCells('B2:L2');
  const r2 = sheet.getCell('B2');
  r2.value = 'CASH VOUCHER LIST';
  r2.font = STYLES.headerFont;
  r2.alignment = STYLES.alignCenter;
  r2.border = { left: { style: 'medium' }, right: { style: 'medium' } };

  // -- Row 3: Year --
  const year = dateRange.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear();
  sheet.mergeCells('B3:L3');
  const r3 = sheet.getCell('B3');
  r3.value = `YEAR ${year}`;
  r3.font = STYLES.subHeaderFont;
  r3.alignment = STYLES.alignCenter;
  r3.border = { bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

  // Spacer Row
  sheet.getRow(4).height = 12;

  // -- Row 5: Column Headers --
  const headerRow = sheet.getRow(5);
  headerRow.height = 35; // Taller header for better aesthetic

  const headers = [
    { col: 2, text: 'DATE' },
    { col: 3, text: 'COMPANY / PAYEE / PAYOR' },
    { col: 4, text: 'CASH\nVOUCHER NO.' },
    { col: 5, text: 'CASH SOURCE' },
    { col: 6, text: 'INVOICE NO.' },
    { col: 7, text: 'PO #' },
    { col: 8, text: 'DR. AMOUNT' },
    { col: 9, text: 'CR. AMOUNT' },
    { col: 10, text: 'REMARKS' },
    { col: 11, text: 'STATUS' },
    { col: 12, text: 'WITH\nCOPY' }
  ];

  headers.forEach(h => {
    const cell = headerRow.getCell(h.col);
    cell.value = h.text;
    cell.font = STYLES.columnTitleFont;
    cell.alignment = STYLES.alignCenter;
    cell.border = STYLES.borderAll;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.headerBg } };
  });

  // =========================================================
  // 4. DATA POPULATION & STYLING
  // =========================================================
  
  // Sort by voucher number to match the list style
  const sortedVouchers = [...vouchers].sort((a, b) => 
    (a.voucher_number || '').localeCompare(b.voucher_number || '')
  );

  sortedVouchers.forEach((voucher, index) => {
    const rowIndex = 6 + index;
    const row = sheet.getRow(rowIndex);
    row.height = 24; // **AESTHETIC FIX:** Give rows breathing room (default is 15)

    // Format Date
    const vDate = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
    const dateStr = vDate 
      ? vDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) 
      : '';

    // -- Cells --
    
    // A: Spacer Border (Optional, usually left blank or bordered)
    row.getCell(1).border = { right: { style: 'thin' } };

    // B: Date
    const cellDate = row.getCell(2);
    cellDate.value = dateStr;
    cellDate.alignment = STYLES.alignLeft;

    // C: Company
    const cellComp = row.getCell(3);
    cellComp.value = voucher.company_payee_payor || '';
    cellComp.alignment = STYLES.alignLeft;
    cellComp.font = { ...STYLES.dataFont, bold: true }; // Make payee slightly bolder

    // D: Voucher No
    const cellVoucher = row.getCell(4);
    cellVoucher.value = voucher.voucher_number || '';
    cellVoucher.alignment = STYLES.alignCenter;

    // E: Cash Source (The Blue Pill)
    const cellSource = row.getCell(5);
    cellSource.value = voucher.cash_source || '';
    cellSource.alignment = STYLES.alignCenter;
    
    // Logic: If Source exists, color Blue. If empty, color Gray (like the template)
    if (voucher.cash_source) {
       cellSource.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.caFundsBg } };
       cellSource.font = { ...STYLES.dataFont, color: { argb: 'FF1F4E78' } }; // Dark blue text for contrast
    } else {
       cellSource.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.grayBg } };
    }

    // F & G: Invoice & PO
    row.getCell(6).value = voucher.invoice_number || '';
    row.getCell(6).alignment = STYLES.alignCenter;
    row.getCell(7).value = voucher.po_number || '';
    row.getCell(7).alignment = STYLES.alignCenter;

    // H: DR Amount
    const cellDr = row.getCell(8);
    const drVal = parseFloat(voucher.dr_amount || 0);
    cellDr.value = drVal || null; // Pass null to hide zeros if desired, or 0
    cellDr.numFmt = STYLES.currencyFmt;
    cellDr.alignment = STYLES.alignRight;

    // I: CR Amount
    const cellCr = row.getCell(9);
    const crVal = parseFloat(voucher.cr_amount || 0);
    cellCr.value = crVal || null; 
    cellCr.numFmt = STYLES.currencyFmt;
    cellCr.alignment = STYLES.alignRight;

    // J: Remarks
    const cellRm = row.getCell(10);
    cellRm.value = voucher.remarks || '';
    cellRm.alignment = STYLES.alignLeft;
    cellRm.font = { ...STYLES.dataFont, size: 9 }; // Slightly smaller for long text

    // K: Status (The Red/Gray Pill)
    const cellStatus = row.getCell(11);
    const statusText = (voucher.status || '').toUpperCase();
    cellStatus.value = statusText;
    cellStatus.alignment = STYLES.alignCenter;
    
    if (statusText === 'RELEASED') {
      cellStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.releasedBg } };
      cellStatus.font = { ...STYLES.dataFont, color: { argb: 'FF9C0006' } }; // Dark red text
    } else {
      // Empty/Pending style from Image 2
      cellStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.grayBg } };
    }

    // L: With Copy
    const cellCopy = row.getCell(12);
    cellCopy.value = '☐';
    cellCopy.alignment = STYLES.alignCenter;

    // Apply Borders to entire row (B to L)
    for (let c = 2; c <= 12; c++) {
      row.getCell(c).border = STYLES.borderAll;
      // Default font
      if (!row.getCell(c).font) row.getCell(c).font = STYLES.dataFont;
    }
  });

  // =========================================================
  // 5. TOTALS ROW
  // =========================================================
  const totalRowIdx = 6 + sortedVouchers.length;
  const totalRow = sheet.getRow(totalRowIdx);
  totalRow.height = 30; // Prominent total row

  // Calculate
  const totalDr = sortedVouchers.reduce((s, v) => s + parseFloat(v.dr_amount || 0), 0);
  const totalCr = sortedVouchers.reduce((s, v) => s + parseFloat(v.cr_amount || 0), 0);

  // Label "TOTAL"
  // Merging columns for the label to align nicely
  sheet.mergeCells(`B${totalRowIdx}:G${totalRowIdx}`); 
  const totalLabel = totalRow.getCell(2);
  totalLabel.value = 'TOTAL';
  totalLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  totalLabel.font = { ...STYLES.subHeaderFont, bold: true };
  totalLabel.border = STYLES.borderAll;

  // DR Total
  const tDrCell = totalRow.getCell(8);
  tDrCell.value = totalDr;
  tDrCell.numFmt = STYLES.currencyFmt; // Accounting format (P25,000.00)
  tDrCell.alignment = STYLES.alignRight;
  tDrCell.font = { ...STYLES.subHeaderFont, bold: true };
  tDrCell.border = STYLES.borderAll;

  // CR Total
  const tCrCell = totalRow.getCell(9);
  tCrCell.value = totalCr;
  tCrCell.numFmt = STYLES.currencyFmt;
  tCrCell.alignment = STYLES.alignRight;
  tCrCell.font = { ...STYLES.subHeaderFont, bold: true };
  tCrCell.border = STYLES.borderAll; // Double bottom border is standard for totals, but simple box is fine here

  // Fill remaining borders for aesthetic consistency
  [10, 11, 12].forEach(c => {
    totalRow.getCell(c).border = STYLES.borderAll;
  });

};

export const generateCashVoucherReport = async (vouchers = [], dateRange = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JJC Engineering Finance';
  workbook.created = new Date();
  await buildCashVoucherSheet(workbook, vouchers, dateRange);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `JJC_Vouchers_${dateRange.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear()}.xlsx`);
};