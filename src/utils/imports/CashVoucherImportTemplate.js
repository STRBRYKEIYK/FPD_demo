import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generate Excel template for importing cash vouchers
 * Template name: import_cash.xlsx
 */
export async function generateCashVoucherImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cash Voucher Import');

  // Set column widths
  worksheet.columns = [
    { key: 'voucher_date', width: 15 },
    { key: 'transaction_type', width: 18 },
    { key: 'company_payee_payor', width: 30 },
    { key: 'cash_source', width: 20 },
    { key: 'invoice_number', width: 18 },
    { key: 'po_number', width: 16 },
    { key: 'dr_amount', width: 15 },
    { key: 'cr_amount', width: 15 },
    { key: 'with_copy', width: 12 },
    { key: 'status', width: 12 },
    { key: 'remarks', width: 30 }
  ];

  // INSTRUCTIONS SECTION (Rows 1-10)
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CASH VOUCHER IMPORT TEMPLATE';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Instructions
  const instructions = [
    ['INSTRUCTIONS:', ''],
    ['1. DO NOT change the file name. It must remain "import_cash.xlsx"', ''],
    ['2. DO NOT modify column headers or add/remove columns', ''],
    ['3. Fill in your data starting from row 12 (below the sample data)', ''],
    ['4. Required fields: voucher_date, transaction_type, company_payee_payor, and amount', ''],
    ['5. Date format: DD-MM-YYYY (e.g., 06-02-2026)', ''],
    ['6. Transaction type options: debit, credit', ''],
    ['7. Amount rules: debit uses dr_amount, credit uses cr_amount', ''],
    ['8. Status options: pending, released, received, cancelled', ''],
    ['9. With_copy: YES or NO (optional)', ''],
    ['10. The system will automatically skip duplicate entries and update changed data', '']
  ];

  instructions.forEach((instruction, index) => {
    const rowNum = index + 2;
    worksheet.mergeCells(`A${rowNum}:K${rowNum}`);
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
    'transaction_type',
    'company_payee_payor',
    'cash_source',
    'invoice_number',
    'po_number',
    'dr_amount',
    'cr_amount',
    'with_copy',
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
      transaction_type: 'debit',
      company_payee_payor: 'Office Supplies Inc.',
      cash_source: 'Petty Cash',
      invoice_number: 'INV-1001',
      po_number: 'PO-2001',
      dr_amount: 1250.50,
      cr_amount: 0,
      with_copy: 'YES',
      status: 'pending',
      remarks: 'Monthly office supplies'
    },
    {
      voucher_date: '06-02-2026',
      transaction_type: 'credit',
      company_payee_payor: 'Client Refund',
      cash_source: 'Bank Transfer',
      invoice_number: 'INV-1002',
      po_number: '',
      dr_amount: 0,
      cr_amount: 3500.00,
      with_copy: 'NO',
      status: 'received',
      remarks: 'Refund from vendor'
    },
    {
      voucher_date: '06-02-2026',
      transaction_type: 'debit',
      company_payee_payor: 'Fuel Station',
      cash_source: '',
      invoice_number: 'INV-1003',
      po_number: 'PO-2002',
      dr_amount: 2200.00,
      cr_amount: 0,
      with_copy: 'YES',
      status: 'released',
      remarks: 'Vehicle fuel'
    }
  ];

  sampleData.forEach((data, index) => {
    const rowNum = 12 + index;
    const row = worksheet.getRow(rowNum);
    row.values = [
      data.voucher_date,
      data.transaction_type,
      data.company_payee_payor,
      data.cash_source,
      data.invoice_number,
      data.po_number,
      data.dr_amount,
      data.cr_amount,
      data.with_copy,
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
  worksheet.mergeCells('A15:K15');
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
      if (colNumber <= 11) {
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
  saveAs(blob, 'import_cash.xlsx');
}

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value.text) return value.text;
  return String(value).trim();
};

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value).toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(text)) return true;
  if (['no', 'n', 'false', '0'].includes(text)) return false;
  return false;
};

/**
 * Parse uploaded Excel file and extract cash voucher data
 */
export async function parseCashVoucherImportFile(file) {
  // Validate filename
  const expectedName = 'import_cash.xlsx';
  if (file.name !== expectedName) {
    throw new Error(`Invalid file name. Expected "${expectedName}" but got "${file.name}"`);
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet('Cash Voucher Import');
  if (!worksheet) {
    throw new Error('Invalid template. "Cash Voucher Import" worksheet not found.');
  }

  const vouchers = [];
  const errors = [];

  // Start reading from row 16 (after header and sample data)
  const dataStartRow = 16;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;

    const rowData = {
      voucher_date: row.getCell(1).value,
      transaction_type: row.getCell(2).value,
      company_payee_payor: row.getCell(3).value,
      cash_source: row.getCell(4).value,
      invoice_number: row.getCell(5).value,
      po_number: row.getCell(6).value,
      dr_amount: row.getCell(7).value,
      cr_amount: row.getCell(8).value,
      with_copy: row.getCell(9).value,
      status: row.getCell(10).value,
      remarks: row.getCell(11).value
    };

    if (!rowData.voucher_date && !rowData.company_payee_payor && !rowData.transaction_type) {
      return;
    }

    const rowErrors = [];
    if (!rowData.voucher_date) rowErrors.push('voucher_date is required');
    if (!rowData.transaction_type) rowErrors.push('transaction_type is required');
    if (!rowData.company_payee_payor) rowErrors.push('company_payee_payor is required');

    let voucherDate;
    if (rowData.voucher_date instanceof Date) {
      voucherDate = rowData.voucher_date.toISOString().split('T')[0];
    } else if (typeof rowData.voucher_date === 'string') {
      voucherDate = rowData.voucher_date;
    } else {
      rowErrors.push('Invalid date format');
    }

    const transactionType = normalizeText(rowData.transaction_type).toLowerCase();
    const validTransactionTypes = ['debit', 'credit'];
    if (!validTransactionTypes.includes(transactionType)) {
      rowErrors.push('Invalid transaction_type. Must be debit or credit');
    }

    const drAmount = parseFloat(rowData.dr_amount || 0);
    const crAmount = parseFloat(rowData.cr_amount || 0);
    if (Number.isNaN(drAmount) || Number.isNaN(crAmount)) {
      rowErrors.push('Invalid amount format');
    }

    if (transactionType === 'debit' && drAmount <= 0) {
      rowErrors.push('dr_amount must be greater than 0 for debit');
    }
    if (transactionType === 'credit' && crAmount <= 0) {
      rowErrors.push('cr_amount must be greater than 0 for credit');
    }

    const validStatuses = ['pending', 'released', 'received', 'cancelled'];
    const status = normalizeText(rowData.status || 'pending').toLowerCase();
    if (!validStatuses.includes(status)) {
      rowErrors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors, data: rowData });
      return;
    }

    const withCopy = normalizeBoolean(rowData.with_copy);
    const totalAmount = transactionType === 'debit' ? drAmount : crAmount;

    vouchers.push({
      voucher_date: voucherDate,
      transaction_type: transactionType,
      company_payee_payor: normalizeText(rowData.company_payee_payor),
      cash_source: normalizeText(rowData.cash_source),
      invoice_number: normalizeText(rowData.invoice_number),
      po_number: normalizeText(rowData.po_number),
      dr_amount: drAmount,
      cr_amount: crAmount,
      total_amount: totalAmount,
      with_copy: withCopy,
      status: status,
      remarks: normalizeText(rowData.remarks),
      _rowNumber: rowNumber
    });
  });

  return { vouchers, errors };
}
