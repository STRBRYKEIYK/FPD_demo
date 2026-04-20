import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generate Excel template for importing petty cash vouchers
 * Template name: import_petty_cash.xlsx
 */
export async function generatePettyCashImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Petty Cash Import');

  // Set column widths
  worksheet.columns = [
    { key: 'voucher_date', width: 15 },
    { key: 'payee', width: 30 },
    { key: 'account_title', width: 25 },
    { key: 'amount_vat', width: 15 },
    { key: 'amount_non_vat', width: 15 },
    { key: 'status', width: 12 },
    { key: 'remarks', width: 30 }
  ];

  // INSTRUCTIONS SECTION (Rows 1-10)
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'PETTY CASH VOUCHER IMPORT TEMPLATE';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Instructions
  const instructions = [
    ['INSTRUCTIONS:', ''],
    ['1. DO NOT change the file name. It must remain "import_petty_cash.xlsx"', ''],
    ['2. DO NOT modify column headers or add/remove columns', ''],
    ['3. Fill in your data starting from row 12 (below the sample data)', ''],
    ['4. Required fields: voucher_date, payee, account_title, and at least one amount field', ''],
    ['5. Date format: DD-MM-YYYY (e.g., 06-02-2026)', ''],
    ['6. Status options: draft, pending, approved, cancelled', ''],
    ['7. Amount fields: Use numbers only (e.g., 1250.50)', ''],
    ['8. Payee: Company name or supplier (e.g., "Office Supplies Inc.")', ''],
    ['9. Account Title: Classification (e.g., "Office Supplies", "Transportation")', ''],
    ['10. The system will automatically skip duplicate entries and update changed data', '']
  ];

  instructions.forEach((instruction, index) => {
    const rowNum = index + 2;
    worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
    const cell = worksheet.getCell(`A${rowNum}`);
    cell.value = instruction[0];
    cell.font = { size: 10, bold: instruction[0].includes('INSTRUCTIONS') };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(rowNum).height = 20;
  });

  // HEADER ROW (Row 11)
  const headerRow = worksheet.getRow(11);
  headerRow.values = [
    'voucher_date',
    'payee',
    'account_title',
    'amount_vat',
    'amount_non_vat',
    'status',
    'remarks'
  ];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // SAMPLE DATA (Rows 12-14)
  const sampleData = [
    {
      voucher_date: '06-02-2026',
      payee: 'Office Supplies Inc.',
      account_title: 'Office Supplies',
      amount_vat: 450.00,
      amount_non_vat: 0,
      status: 'approved',
      remarks: 'Monthly office supplies'
    },
    {
      voucher_date: '06-02-2026',
      payee: 'Gasoline Station',
      account_title: 'Transportation',
      amount_vat: 0,
      amount_non_vat: 2500.00,
      status: 'approved',
      remarks: ''
    },
    {
      voucher_date: '06-02-2026',
      payee: 'Snack Shop',
      account_title: 'Representation',
      amount_vat: 320.00,
      amount_non_vat: 200.00,
      status: 'pending',
      remarks: 'Board meeting refreshments'
    }
  ];

  sampleData.forEach((data, index) => {
    const rowNum = 12 + index;
    const row = worksheet.getRow(rowNum);
    row.values = [
      data.voucher_date,
      data.payee,
      data.account_title,
      data.amount_vat,
      data.amount_non_vat,
      data.status,
      data.remarks
    ];
    
    // Style sample data
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
  });

  // Note about sample data
  worksheet.mergeCells('A15:H15');
  const noteCell = worksheet.getCell('A15');
  noteCell.value = 'NOTE: The 3 rows above are SAMPLE DATA. Delete them and add your actual data starting from row 16.';
  noteCell.font = { italic: true, color: { argb: 'FFDC2626' }, bold: true };
  noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
  noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(15).height = 25;

  // Add a few empty rows for user data
  for (let i = 16; i <= 25; i++) {
    const row = worksheet.getRow(i);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 7) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      }
    });
  }

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'import_petty_cash.xlsx');
}

/**
 * Parse uploaded Excel file and extract voucher data
 */
export async function parsePettyCashImportFile(file) {
  // Validate filename
  const expectedName = 'import_petty_cash.xlsx';
  if (file.name !== expectedName) {
    throw new Error(`Invalid file name. Expected "${expectedName}" but got "${file.name}"`);
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet('Petty Cash Import');
  if (!worksheet) {
    throw new Error('Invalid template. "Petty Cash Import" worksheet not found.');
  }

  const vouchers = [];
  const errors = [];

  // Start reading from row 12 (after header at row 11)
  // Skip sample data rows and read actual user data
  let dataStartRow = 16; // After sample data and note
  
  worksheet.eachRow((row, rowNumber) => {
    // Skip header, instructions, and sample data
    if (rowNumber < dataStartRow) return;

    const rowData = {
      voucher_date: row.getCell(1).value,
      payee: row.getCell(2).value,
      account_title: row.getCell(3).value,
      amount_vat: row.getCell(4).value,
      amount_non_vat: row.getCell(5).value,
      status: row.getCell(6).value,
      remarks: row.getCell(7).value
    };

    // Skip empty rows
    if (!rowData.voucher_date && !rowData.payee && !rowData.account_title) {
      return;
    }

    // Validate required fields
    const rowErrors = [];
    if (!rowData.voucher_date) rowErrors.push('voucher_date is required');
    if (!rowData.payee) rowErrors.push('payee is required');
    if (!rowData.account_title) rowErrors.push('account_title is required');
    if (!rowData.amount_vat && !rowData.amount_non_vat) {
      rowErrors.push('at least one amount field (VAT or Non-VAT) is required');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors, data: rowData });
      return;
    }

    // Parse and validate date
    let voucherDate;
    if (rowData.voucher_date instanceof Date) {
      voucherDate = rowData.voucher_date.toISOString().split('T')[0];
    } else if (typeof rowData.voucher_date === 'string') {
      voucherDate = rowData.voucher_date;
    } else {
      errors.push({ row: rowNumber, errors: ['Invalid date format'], data: rowData });
      return;
    }

    // Parse amounts
    const amountVat = parseFloat(rowData.amount_vat || 0);
    const amountNonVat = parseFloat(rowData.amount_non_vat || 0);

    if (isNaN(amountVat) || isNaN(amountNonVat)) {
      errors.push({ row: rowNumber, errors: ['Invalid amount format'], data: rowData });
      return;
    }

    // Validate status
    const validStatuses = ['draft', 'pending', 'approved', 'cancelled'];
    const status = (rowData.status || 'draft').toLowerCase();
    if (!validStatuses.includes(status)) {
      errors.push({ 
        row: rowNumber, 
        errors: [`Invalid status. Must be one of: ${validStatuses.join(', ')}`], 
        data: rowData 
      });
      return;
    }

    vouchers.push({
      voucher_date: voucherDate,
      payee: String(rowData.payee).trim(),
      particulars: String(rowData.particulars).trim(),
      account_title: String(rowData.account_title).trim(),
      amount_vat: amountVat,
      amount_non_vat: amountNonVat,
      status: status,
      remarks: rowData.remarks ? String(rowData.remarks).trim() : '',
      _rowNumber: rowNumber // For reference
    });
  });

  return { vouchers, errors };
}
