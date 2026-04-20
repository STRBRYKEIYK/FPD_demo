import ExcelJS from 'exceljs/dist/exceljs.bare.min.js';
import { saveAs } from 'file-saver';

/**
 * Generates a styled Excel report with Masterlist and Summary sheets
 * @param {Array} invoices - Array of invoice objects
 */
export const buildSalesInvoiceSheets = async (workbook, invoices) => {
  workbook.creator = workbook.creator || 'JJC Engineering Finance';

  // ==========================================
  // SHEET 1: MASTERLIST OF SALES INVOICE
  // ==========================================
  const masterSheet = workbook.addWorksheet('Masterlist 2026', {
    views: [{ showGridLines: false }]
  });

  // 1. Define Columns
  masterSheet.columns = [
    { header: 'DATE', key: 'date', width: 15 },
    { header: 'NAME OF CUSTOMER', key: 'customer', width: 40 },
    { header: 'SERVICE INVOICE', key: 'invoice_no', width: 15 },
    { header: 'ACCOUNT RECEIVABLES (DR)', key: 'ar', width: 25 },
    { header: 'VATABLE SALES (CR)', key: 'vatable', width: 20 },
    { header: 'VAT OUTPUT TAX (CR)', key: 'vat', width: 20 },
    { header: 'ZERO RATED SALES (CR)', key: 'zero_rated', width: 20 },
    { header: 'REMARKS', key: 'remarks', width: 30 },
    { header: 'INPUT QUARTER', key: 'quarter', width: 15 },
  ];

  // 2. Style the Header Row
  const headerRow = masterSheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' } // Light Green color from screenshot
    };
    cell.font = { name: 'Arial', bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // 3. Populate Data
  // Sort by Invoice Number or Date
  const sortedInvoices = [...invoices].sort((a, b) => 
    new Date(a.invoice_date) - new Date(b.invoice_date)
  );

  sortedInvoices.forEach(inv => {
    const row = masterSheet.addRow({
      date: new Date(inv.invoice_date),
      customer: inv.customer_name,
      invoice_no: inv.invoice_number,
      ar: parseFloat(inv.total_amount || 0),
      vatable: parseFloat(inv.vatable_sales || 0),
      vat: parseFloat(inv.vat_amount || 0),
      zero_rated: parseFloat(inv.zero_rated_sales || 0),
      remarks: inv.remarks || '',
      quarter: inv.quarter || ''
    });

    // Row Styling
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // Date Column
      if (colNumber === 1) cell.numFmt = 'mmmm d, yyyy';
      
      // Currency Columns (4, 5, 6, 7)
      if ([4, 5, 6, 7].includes(colNumber)) {
        cell.numFmt = '#,##0.00';
      }
      
      // Center Invoice No and Quarter
      if ([3, 9].includes(colNumber)) {
        cell.alignment = { horizontal: 'center' };
      }
    });
  });

  // ==========================================
  // SHEET 2: SALES INVOICE SUMMARY
  // ==========================================
  const summarySheet = workbook.addWorksheet('Summary Per Month', {
    views: [{ showGridLines: false }]
  });

  // 1. Calculate Monthly Data
  const monthlyData = {};
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Initialize months
  months.forEach(m => {
    monthlyData[m] = { ar: 0, vatable: 0, vat: 0, zero: 0, count: 0 };
  });

  invoices.forEach(inv => {
    const date = new Date(inv.invoice_date);
    const monthName = date.toLocaleString('default', { month: 'long' });
    
    if (monthlyData[monthName]) {
      monthlyData[monthName].ar += parseFloat(inv.total_amount || 0);
      monthlyData[monthName].vatable += parseFloat(inv.vatable_sales || 0);
      monthlyData[monthName].vat += parseFloat(inv.vat_amount || 0);
      monthlyData[monthName].zero += parseFloat(inv.zero_rated_sales || 0);
      monthlyData[monthName].count++;
    }
  });

  // 2. Add "AS OF DATE" Header
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  summarySheet.mergeCells('A1:E1');
  const titleRow = summarySheet.getCell('A1');
  titleRow.value = `AS OF DATE: ${today}`;
  titleRow.alignment = { horizontal: 'center' };
  titleRow.font = { bold: true, size: 12 };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

  summarySheet.mergeCells('A2:E2');
  const subTitleRow = summarySheet.getCell('A2');
  subTitleRow.value = `SALES INVOICE SUMMARY PER MONTH`;
  subTitleRow.alignment = { horizontal: 'center' };
  subTitleRow.font = { bold: true, size: 14 };

  // 3. Define Summary Headers
  summarySheet.getRow(3).values = [
    'MONTH', 
    'ACCOUNT RECEIVABLES (DR)', 
    'VATABLE SALES (CR)', 
    'VAT OUTPUT TAX (CR)', 
    'ZERO RATED SALES (CR)'
  ];

  const summaryHeader = summarySheet.getRow(3);
  summaryHeader.height = 25;
  summaryHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; // Light Grey
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Set Widths
  summarySheet.columns = [
    { key: 'month', width: 25 },
    { key: 'ar', width: 25 },
    { key: 'vatable', width: 20 },
    { key: 'vat', width: 20 },
    { key: 'zero', width: 20 },
  ];

  // 4. Populate Summary Rows
  let totalAR = 0, totalVatable = 0, totalVAT = 0, totalZero = 0;

  months.forEach((month, index) => {
    const data = monthlyData[month];
    totalAR += data.ar;
    totalVatable += data.vatable;
    totalVAT += data.vat;
    totalZero += data.zero;

    const row = summarySheet.addRow([
      month.toUpperCase(),
      data.ar,
      data.vatable,
      data.vat,
      data.zero
    ]);

    // Apply specific colors based on Quarter (mimicking screenshot)
    let rowColor = 'FFFFFFFF'; // White default
    if (index >= 0 && index <= 2) rowColor = 'FFEBCC'; // Q1 - Light Orange
    if (index >= 3 && index <= 5) rowColor = 'E2EFDA'; // Q2 - Light Green
    if (index >= 6 && index <= 8) rowColor = 'EAD1DC'; // Q3 - Light Pink/Purple
    if (index >= 9 && index <= 11) rowColor = 'FFFFFFFF'; // Q4 - White

    row.eachCell((cell, colNum) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.font = { name: 'Arial', size: 10 };
      
      // Color coding the Month Name column or the whole row? Screenshot implies whole row usually
      if (data.count === 0) {
        // Optional: Style empty months differently
        cell.font = { color: { argb: 'FF999999' } }; 
      }
      
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };

      if (colNum > 1) cell.numFmt = '#,##0.00';
    });
  });

  // 5. Total Row
  const totalRow = summarySheet.addRow([
    'TOTAL',
    totalAR,
    totalVatable,
    totalVAT,
    totalZero
  ]);

  totalRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; // Green Total
    cell.border = { top: { style: 'double' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    if (colNum > 1) cell.numFmt = '#,##0.00';
  });

};

export const generateBeautifulInvoiceReport = async (invoices) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JJC Engineering Finance';
  workbook.created = new Date();
  await buildSalesInvoiceSheets(workbook, invoices);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Sales_Invoice_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};