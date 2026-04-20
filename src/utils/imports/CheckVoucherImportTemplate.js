import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generate Excel template for importing check vouchers
 * Template name: import_check.xlsx
 */
export async function generateCheckVoucherImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Check Voucher Import');

  // Set column widths
  worksheet.columns = [
    { key: 'voucher_date', width: 15 },
    { key: 'transaction_type', width: 18 },
    { key: 'company_payee_payor', width: 30 },
    { key: 'bank_check_no', width: 18 },
    { key: 'bank_deposited', width: 20 },
    { key: 'po_number', width: 16 },
    { key: 'si_number', width: 16 },
    { key: 'cgr_number', width: 16 },
    { key: 'qi_qf_qs', width: 16 },
    { key: 'dr_number', width: 16 },
    { key: 'dr_amount', width: 15 },
    { key: 'cr_amount', width: 15 },
    { key: 'cleared_date', width: 15 },
    { key: 'with_copy', width: 12 },
    { key: 'remarks', width: 30 }
  ];

  // INSTRUCTIONS SECTION (Rows 1-10)
  worksheet.mergeCells('A1:O1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CHECK VOUCHER IMPORT TEMPLATE';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Instructions
  const instructions = [
    ['INSTRUCTIONS:', ''],
    ['1. DO NOT change the file name. It must remain "import_check.xlsx"', ''],
    ['2. DO NOT modify column headers or add/remove columns', ''],
    ['3. Fill in your data starting from row 12 (below the sample data)', ''],
    ['4. Required fields: voucher_date, company_payee_payor, and at least one amount', ''],
    ['5. Date formats: DD/MM/YYYY or Month D, YYYY (e.g., 06/02/2026, January 7, 2026)', ''],
    ['6. Transaction type options: debit, credit', ''],
    ['7. Amount rules: fill dr_amount and/or cr_amount (at least one)', ''],
    ['8. Multiple reference numbers: separate values with commas (e.g., 69010, 69011)', ''],
    ['9. You can add extra rows with same bank_check_no and empty amounts to add more SI/PO/CGR/QI', ''],
    ['10. With_copy: YES or NO (optional). The system will skip duplicates and update changes', '']
  ];

  instructions.forEach((instruction, index) => {
    const rowNum = index + 2;
    worksheet.mergeCells(`A${rowNum}:O${rowNum}`);
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
    'bank_check_no',
    'bank_deposited',
    'po_number',
    'si_number',
    'cgr_number',
    'qi_qf_qs',
    'dr_number',
    'dr_amount',
    'cr_amount',
    'cleared_date',
    'with_copy',
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
      company_payee_payor: 'Contractor Services',
      bank_check_no: 'CHK-10001',
      bank_deposited: 'BDO Main',
      po_number: 'PO-3001',
      si_number: 'SI-4001, SI-4002',
      cgr_number: '',
      qi_qf_qs: '',
      dr_number: 'DR-7001',
      dr_amount: 5800.00,
      cr_amount: 0,
      cleared_date: '08-02-2026',
      with_copy: 'YES',
      remarks: 'Progress billing'
    },
    {
      voucher_date: '06-02-2026',
      transaction_type: 'credit',
      company_payee_payor: 'Supplier Refund',
      bank_check_no: 'CHK-10002',
      bank_deposited: 'BPI Branch',
      po_number: '',
      si_number: 'SI-4003',
      cgr_number: '',
      qi_qf_qs: '',
      dr_number: '',
      dr_amount: 0,
      cr_amount: 1250.00,
      cleared_date: '',
      with_copy: 'NO',
      remarks: 'Refund for overpayment'
    },
    {
      voucher_date: '06-02-2026',
      transaction_type: 'debit',
      company_payee_payor: 'Materials Supply Co.',
      bank_check_no: 'CHK-10003',
      bank_deposited: 'Metrobank',
      po_number: 'PO-3002',
      si_number: 'SI-4002',
      cgr_number: 'CGR-5001, CGR-5002',
      qi_qf_qs: 'QI-6001, QF-6002',
      dr_number: 'DR-7002',
      dr_amount: 9800.00,
      cr_amount: 0,
      cleared_date: '',
      with_copy: 'YES',
      remarks: ''
    }
  ];

  sampleData.forEach((data, index) => {
    const rowNum = 12 + index;
    const row = worksheet.getRow(rowNum);
    row.values = [
      data.voucher_date,
      data.transaction_type,
      data.company_payee_payor,
      data.bank_check_no,
      data.bank_deposited,
      data.po_number,
      data.si_number,
      data.cgr_number,
      data.qi_qf_qs,
      data.dr_number,
      data.dr_amount,
      data.cr_amount,
      data.cleared_date,
      data.with_copy,
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
  worksheet.mergeCells('A15:O15');
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
      if (colNumber <= 15) {
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
  saveAs(blob, 'import_check.xlsx');
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

const parseVoucherDate = (value) => {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  if (!text) return null;

  const dmyMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

const splitReferenceList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item !== '');
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(/[;,\n]/)
    .map((item) => normalizeText(item))
    .filter((item) => item !== '');
};

const buildMergeKey = (voucherDate, company, bankCheckNo) => {
  return [voucherDate, company, bankCheckNo]
    .map((value) => normalizeText(value).toLowerCase())
    .join('|');
};

/**
 * Parse uploaded Excel file and extract check voucher data
 */
export async function parseCheckVoucherImportFile(file) {
  // Validate filename
  const expectedName = 'import_check.xlsx';
  if (file.name !== expectedName) {
    throw new Error(`Invalid file name. Expected "${expectedName}" but got "${file.name}"`);
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet('Check Voucher Import');
  if (!worksheet) {
    throw new Error('Invalid template. "Check Voucher Import" worksheet not found.');
  }

  const vouchers = [];
  const errors = [];
  const referenceRows = [];

  // Start reading from row 16 (after header and sample data)
  const dataStartRow = 16;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;

    const rowData = {
      voucher_date: row.getCell(1).value,
      transaction_type: row.getCell(2).value,
      company_payee_payor: row.getCell(3).value,
      bank_check_no: row.getCell(4).value,
      bank_deposited: row.getCell(5).value,
      po_number: row.getCell(6).value,
      si_number: row.getCell(7).value,
      cgr_number: row.getCell(8).value,
      qi_qf_qs: row.getCell(9).value,
      dr_number: row.getCell(10).value,
      dr_amount: row.getCell(11).value,
      cr_amount: row.getCell(12).value,
      cleared_date: row.getCell(13).value,
      with_copy: row.getCell(14).value,
      remarks: row.getCell(15).value
    };

    if (!rowData.voucher_date && !rowData.company_payee_payor && !rowData.transaction_type) {
      return;
    }

    const rowErrors = [];
    if (!rowData.voucher_date) rowErrors.push('voucher_date is required');
    if (!rowData.company_payee_payor) rowErrors.push('company_payee_payor is required');

    const voucherDate = parseVoucherDate(rowData.voucher_date);
    if (!voucherDate) {
      rowErrors.push('Invalid voucher_date format');
    }

    const clearedDate = parseVoucherDate(rowData.cleared_date) || null;

    const drAmount = parseFloat(rowData.dr_amount || 0);
    const crAmount = parseFloat(rowData.cr_amount || 0);
    if (Number.isNaN(drAmount) || Number.isNaN(crAmount)) {
      rowErrors.push('Invalid amount format');
    }


    const poNumbers = splitReferenceList(rowData.po_number);
    const siNumbers = splitReferenceList(rowData.si_number);
    const cgrNumbers = splitReferenceList(rowData.cgr_number);
    const qiNumbers = splitReferenceList(rowData.qi_qf_qs);

    const hasAmounts = drAmount > 0 || crAmount > 0;
    const hasReferences =
      poNumbers.length > 0 ||
      siNumbers.length > 0 ||
      cgrNumbers.length > 0 ||
      qiNumbers.length > 0;

    if (!hasAmounts && !hasReferences) {
      rowErrors.push('Amounts or reference numbers are required');
    }

    let transactionType = normalizeText(rowData.transaction_type).toLowerCase();
    const validTransactionTypes = ['debit', 'credit'];

    if (drAmount > 0 && crAmount <= 0) {
      transactionType = 'debit';
    } else if (crAmount > 0 && drAmount <= 0) {
      transactionType = 'credit';
    } else if (!transactionType && hasAmounts) {
      transactionType = 'debit';
    }

    if (transactionType && !validTransactionTypes.includes(transactionType)) {
      rowErrors.push('Invalid transaction_type. Must be debit or credit');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors, data: rowData });
      return;
    }

    const withCopy = normalizeBoolean(rowData.with_copy);
    const totalAmount = transactionType === 'debit' ? drAmount : crAmount;

    const companyPayee = normalizeText(rowData.company_payee_payor);
    const bankCheckNo = normalizeText(rowData.bank_check_no);
    const mergeKey = buildMergeKey(voucherDate, companyPayee, bankCheckNo);

    if (!hasAmounts && hasReferences) {
      referenceRows.push({
        mergeKey,
        voucher_date: voucherDate,
        company_payee_payor: companyPayee,
        bank_check_no: bankCheckNo,
        po_numbers_array: poNumbers,
        si_numbers_array: siNumbers,
        cgr_numbers_array: cgrNumbers,
        qi_numbers_array: qiNumbers,
        _rowNumber: rowNumber
      });
      return;
    }

    vouchers.push({
      voucher_date: voucherDate,
      transaction_type: transactionType || 'debit',
      company_payee_payor: companyPayee,
      bank_check_no: bankCheckNo,
      bank_deposited: normalizeText(rowData.bank_deposited),
      po_number: poNumbers.join(', '),
      si_number: siNumbers.join(', '),
      cgr_number: cgrNumbers.join(', '),
      qi_qf_qs: qiNumbers.join(', '),
      po_numbers_array: poNumbers,
      si_numbers_array: siNumbers,
      cgr_numbers_array: cgrNumbers,
      qi_numbers_array: qiNumbers,
      dr_number: normalizeText(rowData.dr_number),
      dr_amount: drAmount,
      cr_amount: crAmount,
      total_amount: totalAmount,
      cleared_date: clearedDate,
      with_copy: withCopy,
      remarks: normalizeText(rowData.remarks),
      _rowNumber: rowNumber,
      _mergeKey: mergeKey
    });
  });

  if (referenceRows.length > 0) {
    const voucherMap = new Map(vouchers.map((voucher) => [voucher._mergeKey, voucher]));

    referenceRows.forEach((row) => {
      const target = voucherMap.get(row.mergeKey);
      if (!target) {
        errors.push({
          row: row._rowNumber,
          errors: ['No matching voucher row found for reference-only entry'],
          data: row
        });
        return;
      }

      const mergeArray = (existing, incoming) => {
        const combined = [...existing, ...incoming];
        return Array.from(new Set(combined)).filter((item) => item !== '');
      };

      target.po_numbers_array = mergeArray(target.po_numbers_array, row.po_numbers_array);
      target.si_numbers_array = mergeArray(target.si_numbers_array, row.si_numbers_array);
      target.cgr_numbers_array = mergeArray(target.cgr_numbers_array, row.cgr_numbers_array);
      target.qi_numbers_array = mergeArray(target.qi_numbers_array, row.qi_numbers_array);

      target.po_number = target.po_numbers_array.join(', ');
      target.si_number = target.si_numbers_array.join(', ');
      target.cgr_number = target.cgr_numbers_array.join(', ');
      target.qi_qf_qs = target.qi_numbers_array.join(', ');
    });
  }

  vouchers.forEach((voucher) => {
    delete voucher._mergeKey;
  });

  return { vouchers, errors };
}
