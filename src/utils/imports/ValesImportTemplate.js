import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function generateValesImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Vales Import');

  worksheet.columns = [
    { key: 'employee_id_number', width: 20 },
    { key: 'vale_type', width: 24 },
    { key: 'principal_amount', width: 18 },
    { key: 'installment_per_cutoff', width: 20 },
    { key: 'disbursement_date', width: 18 },
    { key: 'first_deduction_date', width: 18 },
    { key: 'terms_cutoffs', width: 14 },
    { key: 'status', width: 14 },
    { key: 'remarks', width: 30 },
  ];

  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'VALES IMPORT TEMPLATE';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  const instructions = [
    'INSTRUCTIONS:',
    '1. Keep filename as import_vales.xlsx',
    '2. Do not change headers or columns',
    '3. Fill actual data from row 16 onward',
    '4. Required: employee_id_number, vale_type, principal_amount, installment_per_cutoff, disbursement_date',
    '5. Date format: YYYY-MM-DD',
    '6. vale_type: regular_cash_advance, emergency_vale, salary_advance, calamity_loan, other',
    '7. status: pending, approved, released, active, fully_paid, defaulted, cancelled, rejected',
    '8. Numeric fields: principal_amount, installment_per_cutoff, terms_cutoffs',
    '9. Optional: first_deduction_date, terms_cutoffs, remarks',
    '10. Blank rows are ignored',
  ];

  instructions.forEach((text, index) => {
    const rowNum = index + 2;
    worksheet.mergeCells(`A${rowNum}:I${rowNum}`);
    const cell = worksheet.getCell(`A${rowNum}`);
    cell.value = text;
    cell.font = { size: 10, bold: text === 'INSTRUCTIONS:' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(rowNum).height = 20;
  });

  const headerRow = worksheet.getRow(11);
  headerRow.values = [
    'employee_id_number',
    'vale_type',
    'principal_amount',
    'installment_per_cutoff',
    'disbursement_date',
    'first_deduction_date',
    'terms_cutoffs',
    'status',
    'remarks',
  ];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  const sampleData = [
    {
      employee_id_number: '25064',
      vale_type: 'regular_cash_advance',
      principal_amount: 2500,
      installment_per_cutoff: 500,
      disbursement_date: '2026-02-06',
      first_deduction_date: '2026-02-15',
      terms_cutoffs: 5,
      status: 'pending',
      remarks: 'Tool allowance',
    },
    {
      employee_id_number: '25065',
      vale_type: 'emergency_vale',
      principal_amount: 5000,
      installment_per_cutoff: 1000,
      disbursement_date: '2026-02-08',
      first_deduction_date: '',
      terms_cutoffs: 5,
      status: 'approved',
      remarks: 'Medical emergency',
    },
    {
      employee_id_number: '25066',
      vale_type: 'salary_advance',
      principal_amount: 3000,
      installment_per_cutoff: 750,
      disbursement_date: '2026-02-10',
      first_deduction_date: '2026-02-28',
      terms_cutoffs: 4,
      status: 'released',
      remarks: '',
    },
  ];

  sampleData.forEach((data, index) => {
    const row = worksheet.getRow(12 + index);
    row.values = [
      data.employee_id_number,
      data.vale_type,
      data.principal_amount,
      data.installment_per_cutoff,
      data.disbursement_date,
      data.first_deduction_date,
      data.terms_cutoffs,
      data.status,
      data.remarks,
    ];
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  });

  worksheet.mergeCells('A15:I15');
  const noteCell = worksheet.getCell('A15');
  noteCell.value = 'NOTE: Rows 12-14 are sample data. Delete them and add your data from row 16.';
  noteCell.font = { italic: true, color: { argb: 'FFDC2626' }, bold: true };
  noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
  noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(15).height = 24;

  for (let i = 16; i <= 25; i += 1) {
    const row = worksheet.getRow(i);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 9) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'import_vales.xlsx');
}

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value.text) return String(value.text).trim();
  return String(value).trim();
};

const normalizeDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const text = normalizeText(value);
  if (!text) return '';
  return text;
};

export async function parseValesImportFile(file) {
  const expectedName = 'import_vales.xlsx';
  if (file.name !== expectedName) {
    throw new Error(`Invalid file name. Expected "${expectedName}" but got "${file.name}"`);
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet('Vales Import');
  if (!worksheet) {
    throw new Error('Invalid template. "Vales Import" worksheet not found.');
  }

  const vales = [];
  const errors = [];
  const validTypes = ['regular_cash_advance', 'emergency_vale', 'salary_advance', 'calamity_loan', 'other'];
  const validStatuses = ['pending', 'approved', 'released', 'active', 'fully_paid', 'defaulted', 'cancelled', 'rejected'];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 16) return;

    const rowData = {
      employee_id_number: row.getCell(1).value,
      vale_type: row.getCell(2).value,
      principal_amount: row.getCell(3).value,
      installment_per_cutoff: row.getCell(4).value,
      disbursement_date: row.getCell(5).value,
      first_deduction_date: row.getCell(6).value,
      terms_cutoffs: row.getCell(7).value,
      status: row.getCell(8).value,
      remarks: row.getCell(9).value,
    };

    if (!rowData.employee_id_number && !rowData.vale_type && !rowData.principal_amount && !rowData.disbursement_date) {
      return;
    }

    const rowErrors = [];
    const employeeIdNumber = normalizeText(rowData.employee_id_number);
    const principalAmount = Number(rowData.principal_amount);
    const installment = Number(rowData.installment_per_cutoff);
    const valeType = normalizeText(rowData.vale_type).toLowerCase();
    const status = (normalizeText(rowData.status).toLowerCase() || 'pending');
    const disbursementDate = normalizeDate(rowData.disbursement_date);
    const firstDeductionDate = normalizeDate(rowData.first_deduction_date);
    const termsCutoffs = normalizeText(rowData.terms_cutoffs) ? Number(rowData.terms_cutoffs) : null;

    if (!employeeIdNumber) rowErrors.push('employee_id_number is required');
    if (!valeType) rowErrors.push('vale_type is required');
    if (!validTypes.includes(valeType)) rowErrors.push(`vale_type must be one of: ${validTypes.join(', ')}`);
    if (!disbursementDate) rowErrors.push('disbursement_date is required');
    if (Number.isNaN(principalAmount) || principalAmount <= 0) rowErrors.push('principal_amount must be greater than 0');
    if (Number.isNaN(installment) || installment <= 0) rowErrors.push('installment_per_cutoff must be greater than 0');
    if (termsCutoffs !== null && (Number.isNaN(termsCutoffs) || termsCutoffs < 0)) rowErrors.push('terms_cutoffs must be a valid number');
    if (!validStatuses.includes(status)) rowErrors.push(`status must be one of: ${validStatuses.join(', ')}`);

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors, data: rowData });
      return;
    }

    vales.push({
      employee_id_number: employeeIdNumber,
      vale_type: valeType,
      principal_amount: principalAmount,
      installment_per_cutoff: installment,
      disbursement_date: disbursementDate,
      first_deduction_date: firstDeductionDate || null,
      terms_cutoffs: termsCutoffs,
      status,
      remarks: normalizeText(rowData.remarks) || null,
      _rowNumber: rowNumber,
    });
  });

  return { vales, errors };
}
