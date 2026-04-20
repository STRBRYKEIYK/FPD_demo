import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generates the Check Voucher List Report matching the provided images.
 * Removes green/blue highlights while maintaining layout, cell sizes, and margins.
 */
export const buildCheckVoucherSheet = async (workbook, vouchers = [], dateRange = {}) => {
  const sheet = workbook.addWorksheet('Check Vouchers', {
    pageSetup: { 
        paperSize: 9, 
        orientation: 'landscape', 
        fitToPage: true,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
    },
    views: [{ showGridLines: false }] 
  });

  // =========================================================
  // 1. STYLE CONFIGURATION
  // =========================================================
  const STYLES = {
    font: 'Arial', // Matches Google Sheets default better
    headerFont: { name: 'Arial', size: 11, bold: true },
    titleFont: { name: 'Arial', size: 14, bold: true },
    dataFont: { name: 'Arial', size: 9 },
    
    colors: {
      releasedBg: 'FFFFC7CE', // Light Red
      releasedText: 'FF9C0006', // Dark Red 
      receivedBg: 'FFC6EFCE', // Light Green
      receivedText: 'FF006100', // Dark Green
    },
    
    borderThin: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    borderMedium: {
        top: { style: 'medium' },
        left: { style: 'medium' },
        bottom: { style: 'medium' },
        right: { style: 'medium' }
    },

    alignCenter: { horizontal: 'center', vertical: 'middle', wrapText: true },
    alignLeft: { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 },
    alignRight: { horizontal: 'right', vertical: 'middle', indent: 1 },
    numberFmt: '#,##0.00' 
  };

  // =========================================================
  // 2. COLUMN WIDTHS (Matching Image Proportions)
  // =========================================================
  sheet.columns = [
    { key: 'A', width: 14 },  // DATE
    { key: 'B', width: 45 },  // COMPANY
    { key: 'C', width: 12 },  // VOUCHER NO.
    { key: 'D', width: 25 },  // BANK / CHECK
    { key: 'E', width: 10 },  // BANK DEP
    { key: 'F', width: 12 },  // PO
    { key: 'G', width: 10 },  // SI
    { key: 'H', width: 10 },  // QI/QF/QS
    { key: 'I', width: 10 },  // DR #
    { key: 'J', width: 16 },  // DR. AMOUNT
    { key: 'K', width: 16 },  // CR. AMOUNT
    { key: 'L', width: 14 },  // STATUS
    { key: 'M', width: 22 },  // REMARKS
    { key: 'N', width: 8 },   // WITH COPY
  ];

  // =========================================================
  // 3. HEADER SECTION (Matches Rows 1-4)
  // =========================================================
  // Row 1 & 2: Titles
  sheet.mergeCells('A2:N2');
  const title1 = sheet.getCell('A2');
  title1.value = 'CHECK VOUCHER LIST';
  title1.font = STYLES.titleFont;
  title1.alignment = STYLES.alignCenter;

  const year = dateRange.start ? new Date(dateRange.start).getFullYear() : '2026';
  sheet.mergeCells('A3:N3');
  const title2 = sheet.getCell('A3');
  title2.value = `YEAR ${year}`;
  title2.font = STYLES.titleFont;
  title2.alignment = STYLES.alignCenter;

  // Row 5: Column Headers
  const headerRow = sheet.getRow(5);
  headerRow.height = 38; 

  const headers = [
    'DATE', 'COMPANY / PAYEE / PAYOR', 'CHECK\nVOUCHER\nNO.', 'BANK / CHECK NO.', 
    'BANK\nDEPOSITED', 'PO', 'SI', 'QI/QF/QS', 'DR #', 'DR. AMOUNT', 
    'CR. AMOUNT', 'STATUS', 'REMARKS', 'WITH\nCOPY'
  ];

  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = STYLES.headerFont;
    cell.alignment = STYLES.alignCenter;
    cell.border = STYLES.borderThin;
  });

  sheet.autoFilter = 'A5:N5';

  // =========================================================
  // 4. DATA POPULATION
  // =========================================================
  let rowIndex = 6;

  vouchers.forEach((voucher) => {
    const items = (voucher.line_items?.length > 0) ? voucher.line_items : [{}];

    items.forEach((item, itemIdx) => {
        const row = sheet.getRow(rowIndex);
        row.height = 20;

        // Populate Cells
        const vDate = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
        row.getCell(1).value = vDate ? vDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        row.getCell(2).value = itemIdx === 0 ? voucher.company_payee_payor : '';
        
        // Voucher Number formatting
        let vNum = voucher.voucher_number || '';
        const match = vNum.match(/(\d{2})-(\d+)/);
        row.getCell(3).value = match ? match[0] : vNum;
        
        row.getCell(4).value = itemIdx === 0 ? voucher.bank_check_no : '';
        row.getCell(5).value = itemIdx === 0 ? voucher.bank_deposited : '';
        
        // PO / SI / QI / DR (No Fills as requested)
        row.getCell(6).value = item.po_number || '';
        row.getCell(7).value = item.si_number || '';
        row.getCell(8).value = item.qi_qf_qs || '';
        row.getCell(9).value = item.dr_number || '';

        // Amounts (Accounting Format)
        if (itemIdx === 0) {
            const dr = parseFloat(voucher.dr_amount || 0);
            const cr = parseFloat(voucher.cr_amount || 0);
            row.getCell(10).value = dr > 0 ? dr : null;
            row.getCell(11).value = cr > 0 ? cr : null;
        }

        // Status Styling
        const statusCell = row.getCell(12);
        const statusText = (voucher.status || '').toUpperCase();
        statusCell.value = statusText;
        if (statusText === 'RELEASED') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.releasedBg } };
            statusCell.font = { ...STYLES.dataFont, color: { argb: STYLES.colors.releasedText }, bold: true };
        } else if (statusText === 'RECEIVED') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLES.colors.receivedBg } };
            statusCell.font = { ...STYLES.dataFont, color: { argb: STYLES.colors.receivedText }, bold: true };
        }

        row.getCell(13).value = itemIdx === 0 ? voucher.remarks : '';
        row.getCell(14).value = (item.with_copy || voucher.with_copy) ? '☑' : '☐';

        // Apply borders and alignment to all cells in row
        for (let c = 1; c <= 14; c++) {
            const cell = row.getCell(c);
            cell.border = STYLES.borderThin;
            if (!cell.font) cell.font = STYLES.dataFont;
            
            // Alignments
            if ([1, 2, 4, 13].includes(c)) cell.alignment = STYLES.alignLeft;
            else if ([10, 11].includes(c)) {
                cell.alignment = STYLES.alignRight;
                cell.numFmt = STYLES.numberFmt;
            }
            else cell.alignment = STYLES.alignCenter;
        }
        rowIndex++;
    });
  });

  // =========================================================
  // 5. TOTALS ROW (Matches Image 2)
  // =========================================================
  const totalRow = sheet.getRow(rowIndex);
  totalRow.height = 25;
  sheet.mergeCells(`A${rowIndex}:I${rowIndex}`);
  
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = 'TOTAL';
  totalLabel.font = STYLES.headerFont;
  totalLabel.alignment = STYLES.alignRight;

  const totalDr = vouchers.reduce((sum, v) => sum + parseFloat(v.dr_amount || 0), 0);
  const totalCr = vouchers.reduce((sum, v) => sum + parseFloat(v.cr_amount || 0), 0);

  const tDr = totalRow.getCell(10);
  tDr.value = totalDr;
  tDr.font = STYLES.headerFont;
  tDr.numFmt = STYLES.numberFmt;
  tDr.border = STYLES.borderThin;

  const tCr = totalRow.getCell(11);
  tCr.value = totalCr;
  tCr.font = STYLES.headerFont;
  tCr.numFmt = STYLES.numberFmt;
  tCr.border = STYLES.borderThin;

  // Finalize Borders for total row
  for(let c=1; c<=14; c++) totalRow.getCell(c).border = STYLES.borderThin;

};

export const generateCheckVoucherReport = async (vouchers = [], dateRange = {}) => {
  const workbook = new ExcelJS.Workbook();
  await buildCheckVoucherSheet(workbook, vouchers, dateRange);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Check_Voucher_List_${dateRange.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear()}.xlsx`);
};