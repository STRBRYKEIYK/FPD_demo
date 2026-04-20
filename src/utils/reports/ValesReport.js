import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

export const buildValesSheet = async (workbook, vales = [], dateRange = {}) => {
  const sheet = workbook.addWorksheet('Vales', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }],
  });

  const styles = {
    headerFont: { name: 'Calibri', size: 14, bold: true },
    subHeaderFont: { name: 'Calibri', size: 11, bold: true },
    colHeaderFont: { name: 'Calibri', size: 10, bold: true },
    rowFont: { name: 'Calibri', size: 10 },
    borderAll: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    },
    center: { horizontal: 'center', vertical: 'middle', wrapText: true },
    left: { horizontal: 'left', vertical: 'middle', wrapText: true },
    right: { horizontal: 'right', vertical: 'middle' },
    moneyFmt: '_("₱"* #,##0.00_);_("₱"* (#,##0.00);_("₱"* "-"??_);_(@_)',
  };

  sheet.columns = [
    { key: 'A', width: 2 },
    { key: 'B', width: 16 },
    { key: 'C', width: 16 },
    { key: 'D', width: 28 },
    { key: 'E', width: 20 },
    { key: 'F', width: 14 },
    { key: 'G', width: 16 },
    { key: 'H', width: 16 },
    { key: 'I', width: 14 },
    { key: 'J', width: 36 },
  ];

  sheet.mergeCells('B1:J1');
  const companyCell = sheet.getCell('B1');
  companyCell.value = 'JJC ENGINEERING WORKS & GENERAL SERVICES';
  companyCell.font = styles.headerFont;
  companyCell.alignment = styles.center;

  sheet.mergeCells('B2:J2');
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'VALES REGISTER';
  titleCell.font = styles.headerFont;
  titleCell.alignment = styles.center;

  sheet.mergeCells('B3:J3');
  const periodCell = sheet.getCell('B3');
  if (dateRange?.start && dateRange?.end) {
    const start = new Date(dateRange.start).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = new Date(dateRange.end).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    periodCell.value = `PERIOD: ${start} to ${end}`;
  } else {
    periodCell.value = 'PERIOD: ALL RECORDS';
  }
  periodCell.font = styles.subHeaderFont;
  periodCell.alignment = styles.center;

  const headerRow = sheet.getRow(5);
  headerRow.height = 28;
  const headers = ['VALE #', 'DATE', 'EMPLOYEE', 'TYPE', 'STATUS', 'PRINCIPAL', 'INSTALLMENT', 'BALANCE', 'REMARKS'];
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 2);
    cell.value = header;
    cell.font = styles.colHeaderFont;
    cell.alignment = styles.center;
    cell.border = styles.borderAll;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  const sorted = [...vales].sort((a, b) => String(a.vale_number || a.valeId || '').localeCompare(String(b.vale_number || b.valeId || '')));

  let totalPrincipal = 0;
  let totalBalance = 0;

  sorted.forEach((vale, index) => {
    const row = sheet.getRow(6 + index);
    row.height = 22;
    row.font = styles.rowFont;

    const principal = Number(vale.principal_amount ?? vale.amount ?? 0);
    const installment = Number(vale.installment_per_cutoff ?? vale.installmentValue ?? 0);
    const balance = Number(vale.balance_amount ?? vale.balance ?? 0);

    totalPrincipal += principal;
    totalBalance += balance;

    row.getCell(2).value = vale.vale_number || vale.valeId || `VAL-${vale.id || index + 1}`;
    row.getCell(3).value = vale.disbursement_date
      ? new Date(vale.disbursement_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      : vale.disbursementDate || '';
    row.getCell(4).value = vale.employee_name || vale.employee || '';
    row.getCell(5).value = vale.vale_type || vale.type || '';
    row.getCell(6).value = vale.status || '';
    row.getCell(7).value = principal || null;
    row.getCell(8).value = installment || null;
    row.getCell(9).value = balance || null;
    row.getCell(10).value = vale.remarks || '';

    row.getCell(2).alignment = styles.center;
    row.getCell(3).alignment = styles.center;
    row.getCell(4).alignment = styles.left;
    row.getCell(5).alignment = styles.left;
    row.getCell(6).alignment = styles.center;
    row.getCell(7).alignment = styles.right;
    row.getCell(8).alignment = styles.right;
    row.getCell(9).alignment = styles.right;
    row.getCell(10).alignment = styles.left;

    row.getCell(7).numFmt = styles.moneyFmt;
    row.getCell(8).numFmt = styles.moneyFmt;
    row.getCell(9).numFmt = styles.moneyFmt;

    for (let col = 2; col <= 10; col += 1) {
      row.getCell(col).border = styles.borderAll;
    }
  });

  const totalRowIndex = Math.max(6 + sorted.length, 6);
  const totalRow = sheet.getRow(totalRowIndex);
  totalRow.getCell(2).value = 'TOTAL';
  totalRow.getCell(2).font = { ...styles.colHeaderFont, bold: true };
  sheet.mergeCells(`B${totalRowIndex}:F${totalRowIndex}`);

  totalRow.getCell(7).value = totalPrincipal;
  totalRow.getCell(8).value = null;
  totalRow.getCell(9).value = totalBalance;

  totalRow.getCell(7).numFmt = styles.moneyFmt;
  totalRow.getCell(9).numFmt = styles.moneyFmt;
  totalRow.getCell(7).font = { ...styles.colHeaderFont, bold: true };
  totalRow.getCell(9).font = { ...styles.colHeaderFont, bold: true };

  for (let col = 2; col <= 10; col += 1) {
    totalRow.getCell(col).alignment = col >= 7 ? styles.right : styles.center;
    totalRow.getCell(col).border = styles.borderAll;
    totalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  }
};

export const generateValesReport = async (vales = [], dateRange = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JJC Engineering Finance';
  workbook.created = new Date();
  await buildValesSheet(workbook, vales, dateRange);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `vales_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
