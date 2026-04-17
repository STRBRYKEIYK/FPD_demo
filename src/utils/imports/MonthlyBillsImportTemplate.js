import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Generate Excel template for importing monthly bills
 * Template name: import_monthly_bills.xlsx
 */
export async function generateMonthlyBillsImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Monthly Bills Import');

  // Set column widths
  worksheet.columns = [
    { key: 'month', width: 12 },
    { key: 'year', width: 10 },
    { key: 'category', width: 20 },
    { key: 'provider_name', width: 25 },
    { key: 'service_address', width: 30 },
    { key: 'account_number', width: 20 },
    { key: 'amount', width: 15 },
    { key: 'due_date', width: 15 },
    { key: 'billing_period_start', width: 18 },
    { key: 'billing_period_end', width: 18 },
    { key: 'description', width: 30 },
    { key: 'status', width: 12 }
  ];

  // INSTRUCTIONS SECTION (Rows 1-10)
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'MONTHLY BILLS IMPORT TEMPLATE';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Instructions
  const instructions = [
    ['INSTRUCTIONS:', ''],
    ['1. DO NOT change the file name. It must remain "import_monthly_bills.xlsx"', ''],
    ['2. DO NOT modify column headers or add/remove columns', ''],
    ['3. Fill in your data starting from row 13 (below the sample data)', ''],
    ['4. Required fields: month, year, category, provider_name, amount', ''],
    ['5. Month: numeric value (1-12) where 1=January, 12=December', ''],
    ['6. Year: 4-digit year (e.g., 2026)', ''],
    ['7. Category options: electricity, water, communications, rental, payment_fees, other', ''],
    ['8. Date format: DD-MM-YYYY (e.g., 15-02-2026)', ''],
    ['9. Status options: draft, pending, paid, overdue', ''],
    ['10. Bills will be grouped by month/year automatically', ''],
    ['11. The system will create the main bill record and associate items to it', '']
  ];

  instructions.forEach((instruction, index) => {
    const rowNum = index + 2;
    worksheet.mergeCells(`A${rowNum}:L${rowNum}`);
    const cell = worksheet.getCell(`A${rowNum}`);
    cell.value = instruction[0];
    cell.font = { size: 10, bold: instruction[0].includes('INSTRUCTIONS') };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(rowNum).height = 20;
  });

  // HEADER ROW (Row 13)
  const headerRow = worksheet.getRow(13);
  headerRow.values = [
    'month',
    'year',
    'category',
    'provider_name',
    'service_address',
    'account_number',
    'amount',
    'due_date',
    'billing_period_start',
    'billing_period_end',
    'description',
    'status'
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

  // SAMPLE DATA (Rows 14-16)
  const sampleData = [
    {
      month: 2,
      year: 2026,
      category: 'electricity',
      provider_name: 'Power Electric Corp',
      service_address: '123 Main St, City',
      account_number: 'ELEC-12345',
      amount: 5500.00,
      due_date: '28-02-2026',
      billing_period_start: '01-01-2026',
      billing_period_end: '31-01-2026',
      description: 'January electricity consumption',
      status: 'pending'
    },
    {
      month: 2,
      year: 2026,
      category: 'water',
      provider_name: 'City Water Services',
      service_address: '123 Main St, City',
      account_number: 'WATER-67890',
      amount: 1200.50,
      due_date: '28-02-2026',
      billing_period_start: '01-01-2026',
      billing_period_end: '31-01-2026',
      description: 'January water bill',
      status: 'pending'
    },
    {
      month: 2,
      year: 2026,
      category: 'communications',
      provider_name: 'Telecom Plus',
      service_address: '123 Main St, City',
      account_number: 'TEL-11111',
      amount: 2800.00,
      due_date: '05-03-2026',
      billing_period_start: '01-02-2026',
      billing_period_end: '28-02-2026',
      description: 'Internet and phone service',
      status: 'pending'
    }
  ];

  sampleData.forEach((data) => {
    const row = worksheet.addRow(data);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Freeze header rows
  worksheet.views = [{ state: 'frozen', ySplit: 13 }];

  // Generate buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, 'import_monthly_bills.xlsx');
}

/**
 * Parse monthly bills import file
 * @param {File} file - The uploaded Excel file
 * @returns {Promise<{bills: Array, errors: Array}>}
 */
export async function parseMonthlyBillsImportFile(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.getWorksheet('Monthly Bills Import');
  if (!worksheet) {
    throw new Error('Invalid template: Could not find "Monthly Bills Import" worksheet');
  }

  const bills = [];
  const errors = [];
  const billItemsByPeriod = {};

  // Start from row 14 (after header and sample data)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 13) return; // Skip headers and instructions

    const rowData = {
      month: row.getCell(1).value,
      year: row.getCell(2).value,
      category: row.getCell(3).value,
      provider_name: row.getCell(4).value,
      service_address: row.getCell(5).value,
      account_number: row.getCell(6).value,
      amount: row.getCell(7).value,
      due_date: row.getCell(8).value,
      billing_period_start: row.getCell(9).value,
      billing_period_end: row.getCell(10).value,
      description: row.getCell(11).value,
      status: row.getCell(12).value
    };

    // Skip empty rows
    if (!rowData.month && !rowData.provider_name) return;

    // Validate required fields
    const rowErrors = [];
    if (!rowData.month || rowData.month < 1 || rowData.month > 12) {
      rowErrors.push('Invalid month (must be 1-12)');
    }
    if (!rowData.year || rowData.year < 2020 || rowData.year > 2100) {
      rowErrors.push('Invalid year');
    }
    if (!rowData.category) {
      rowErrors.push('Category is required');
    } else {
      const validCategories = ['electricity', 'water', 'communications', 'rental', 'payment_fees', 'other'];
      if (!validCategories.includes(rowData.category.toLowerCase())) {
        rowErrors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }
    if (!rowData.provider_name) {
      rowErrors.push('Provider name is required');
    }
    if (!rowData.amount || isNaN(parseFloat(rowData.amount))) {
      rowErrors.push('Valid amount is required');
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        errors: rowErrors,
        data: rowData
      });
      return;
    }

    // Format dates
    const formatDate = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      if (typeof dateValue === 'string') {
        // Parse DD-MM-YYYY format
        const parts = dateValue.split('-');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return null;
    };

    const billItem = {
      category: rowData.category.toLowerCase(),
      provider_name: rowData.provider_name?.toString() || '',
      service_address: rowData.service_address?.toString() || null,
      account_number: rowData.account_number?.toString() || null,
      amount: parseFloat(rowData.amount),
      due_date: formatDate(rowData.due_date),
      billing_period_start: formatDate(rowData.billing_period_start),
      billing_period_end: formatDate(rowData.billing_period_end),
      description: rowData.description?.toString() || null,
    };

    const periodKey = `${rowData.year}-${String(rowData.month).padStart(2, '0')}`;
    if (!billItemsByPeriod[periodKey]) {
      billItemsByPeriod[periodKey] = {
        month: parseInt(rowData.month),
        year: parseInt(rowData.year),
        status: (rowData.status?.toLowerCase()) || 'pending',
        items: []
      };
    }

    billItemsByPeriod[periodKey].items.push(billItem);
  });

  // Convert grouped items to bills array
  Object.values(billItemsByPeriod).forEach(bill => {
    bills.push(bill);
  });

  return { bills, errors };
}
