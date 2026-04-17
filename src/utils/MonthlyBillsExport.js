import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Generates a formatted Excel report for Monthly Bills
 */
export const generateMonthlyBillsReport = async (bills, selectedBillDetails) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Finance System';
  workbook.created = new Date();

  // ==========================================
  // SHEET 1: MONTHLY BILLS (SUMMARY)
  // ==========================================
  const sheet1 = workbook.addWorksheet('Monthly Bills');

  sheet1.columns = [
    { header: 'Month', key: 'period', width: 20 },
    { header: 'Total Amount', key: 'net_total', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Electricity', key: 'elec', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Water', key: 'water', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Comm/Internet', key: 'internet', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Payment Fees', key: 'fees', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Other Fees', key: 'other', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Payment Date', key: 'pay_date', width: 15 },
    { header: 'Notes/Status', key: 'status', width: 15 },
  ];

  const headerRow = sheet1.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium' } };
  });

  bills.forEach((bill) => {
    const row = sheet1.addRow({
      period: bill.period_display,
      net_total: parseFloat(bill.net_total || 0),
      elec: parseFloat(bill.total_electricity || 0),
      water: parseFloat(bill.total_water || 0),
      internet: parseFloat(bill.total_internet || 0),
      fees: parseFloat(bill.total_payment_fees || 0),
      other: parseFloat(bill.total_other || 0),
      pay_date: bill.payment_date || '-',
      status: bill.status.toUpperCase(),
    });

    const statusCell = row.getCell('status');
    if (bill.status === 'paid') {
      statusCell.font = { color: { argb: 'FF006100' }, bold: true };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    } else if (bill.status === 'pending') {
      statusCell.font = { color: { argb: 'FF9C0006' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    }
  });

  // ==========================================
  // SHEET 2: MONTHLY BILLS BREAKDOWN
  // ==========================================
  if (selectedBillDetails && selectedBillDetails.items) {
    const sheet2 = workbook.addWorksheet('Monthly Bills Breakdown');
    const items = selectedBillDetails.items;

    // --- Header Section ---
    sheet2.mergeCells('A1:F1');
    const titleCell = sheet2.getCell('A1');
    titleCell.value = `${selectedBillDetails.period_display} BILLS BREAKDOWN`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };
    titleCell.alignment = { horizontal: 'center' };
    
    sheet2.mergeCells('A2:F2');
    sheet2.getCell('A2').value = `Bill ID: #${selectedBillDetails.id}  |  Created: ${new Date(selectedBillDetails.created_at).toLocaleDateString()}`;
    sheet2.getCell('A2').alignment = { horizontal: 'center' };
    sheet2.getCell('A2').font = { italic: true };

    let currentRow = 4;

    // --- Helper: Categorization Logic ---
    const getCategory = (item) => {
      if (!item.category) return 'other';
      const cat = item.category.toLowerCase().trim();
      
      if (cat.includes('communication') || cat.includes('internet') || cat.includes('globe') || cat.includes('smart')) return 'communications';
      if (cat === 'electricity' || cat.includes('meralco')) return 'electricity';
      if (cat === 'water' || cat.includes('manila water') || cat.includes('maynilad')) return 'water';
      return 'other'; 
    };

    // --- Helper: Format Date Range ---
    const getFormattedDateRange = (item) => {
      const start = item.billing_period_start || item.date_range_start;
      const end = item.billing_period_end || item.date_range_end;
      
      if (start && end) return `${start} - ${end}`;
      if (start) return `${start}`;
      return '-';
    };

    // --- Helper: Create Section Header ---
    const createSectionHeader = (title, colorHex) => {
      sheet2.mergeCells(`A${currentRow}:F${currentRow}`);
      const cell = sheet2.getCell(`A${currentRow}`);
      cell.value = title;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      currentRow++;
      
      const headers = ['Service Provider', 'Location/Property', 'Account Number', 'SOA/Ref', 'Date Range', 'Amount'];
      const headerRow = sheet2.getRow(currentRow);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10 };
        cell.border = { bottom: { style: 'thin' } };
      });
      currentRow++;
    };

    // --- Helper: Add Item Rows (Modified for conditional columns) ---
    // options: { hideSOA: bool, hideDate: bool, simpleLayout: bool }
    const addItemRows = (categoryItems, options = {}) => {
      if (categoryItems.length === 0) return 0;

      let subtotal = 0;
      categoryItems.forEach(item => {
        const amount = parseFloat(item.amount || 0);
        subtotal += amount;
        
        const row = sheet2.getRow(currentRow);

        if (options.simpleLayout) {
          // GROUP D (Misc): Merged Description
          sheet2.mergeCells(`A${currentRow}:E${currentRow}`);
          row.getCell(1).value = item.description || item.fee_name || item.provider_name || 'Miscellaneous Fee';
          row.getCell(1).alignment = { horizontal: 'left', indent: 1 };
          row.getCell(6).value = amount;
        } else {
          // Standard Logic
          row.getCell(1).value = item.provider_name || item.fee_name || '-';
          row.getCell(2).value = item.location || '-';
          row.getCell(3).value = item.account_number || '-';
          
          // Logic for Col 4 (SOA): Blank if hideSOA is true
          row.getCell(4).value = options.hideSOA 
            ? '' 
            : (item.soa_number || item.reference_number || '-');
          
          // Logic for Col 5 (Date): Blank if hideDate is true
          row.getCell(5).value = options.hideDate 
            ? '' 
            : getFormattedDateRange(item);

          row.getCell(6).value = amount;
        }

        row.getCell(6).numFmt = '#,##0.00';
        currentRow++;
      });

      // --- Subtotal Styling ---
      const subRow = sheet2.getRow(currentRow);
      subRow.getCell(5).value = 'Subtotal:';
      subRow.getCell(5).font = { bold: true, italic: true };
      subRow.getCell(5).alignment = { horizontal: 'right' };
      
      const amountCell = subRow.getCell(6);
      amountCell.value = subtotal;
      amountCell.numFmt = '#,##0.00';
      amountCell.font = { bold: true };
      amountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; 
      amountCell.border = { top: { style: 'double' }, bottom: { style: 'thin' } };
      
      currentRow += 2;
      return subtotal;
    };

    // --- Filtering Items ---
    const commsItems = items.filter(i => getCategory(i) === 'communications');
    const elecItems = items.filter(i => getCategory(i) === 'electricity');
    const waterItems = items.filter(i => getCategory(i) === 'water');
    const miscItems = items.filter(i => getCategory(i) === 'other');

    // --- GROUP A: Communications ---
    // NO Date Range
    if (commsItems.length > 0) {
      createSectionHeader('Group A: Communications / Internet Category', 'FF6B23');
      addItemRows(commsItems, { hideDate: true }); 
    }

    // --- GROUP B: Electricity ---
    // Has Date Range, Has SOA
    if (elecItems.length > 0) {
      createSectionHeader('Group B: Electricity Category', 'FFCC00');
      addItemRows(elecItems);
    }

    // --- GROUP C: Water ---
    // NO SOA, Has Date Range
    if (waterItems.length > 0) {
      createSectionHeader('Group C: Water / Utilities Category', '0070C0');
      addItemRows(waterItems, { hideSOA: true });
    }

    // --- GROUP D: Miscellaneous ---
    if (miscItems.length > 0) {
      sheet2.mergeCells(`A${currentRow}:F${currentRow}`);
      const cell = sheet2.getCell(`A${currentRow}`);
      cell.value = 'Group D: Miscellaneous - Other Fees / Payment Fees';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7030A0' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      currentRow++;

      const headerRow = sheet2.getRow(currentRow);
      sheet2.mergeCells(`A${currentRow}:E${currentRow}`);
      headerRow.getCell(1).value = 'Name of the Fee / Description';
      headerRow.getCell(1).font = { bold: true };
      headerRow.getCell(1).border = { bottom: { style: 'thin' } };
      
      headerRow.getCell(6).value = 'Amount';
      headerRow.getCell(6).font = { bold: true };
      headerRow.getCell(6).border = { bottom: { style: 'thin' } };
      currentRow++;

      addItemRows(miscItems, { simpleLayout: true });
    }

    // --- Footer: Grand Total ---
    sheet2.mergeCells(`A${currentRow}:E${currentRow}`);
    const footerLabel = sheet2.getCell(`A${currentRow}`);
    footerLabel.value = 'Total Accumulated Amount:';
    footerLabel.font = { bold: true, size: 14 };
    footerLabel.alignment = { horizontal: 'right' };

    const footerTotal = sheet2.getCell(`F${currentRow}`);
    footerTotal.value = parseFloat(selectedBillDetails.net_total || 0);
    footerTotal.numFmt = '₱#,##0.00';
    footerTotal.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
    footerTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    footerTotal.border = { top: { style: 'double' }, bottom: { style: 'double' } };

    // Set Column Widths
    sheet2.getColumn(1).width = 25;
    sheet2.getColumn(2).width = 20;
    sheet2.getColumn(3).width = 20;
    sheet2.getColumn(4).width = 20;
    sheet2.getColumn(5).width = 25;
    sheet2.getColumn(6).width = 18;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = selectedBillDetails 
    ? `Monthly_Bill_Report_${selectedBillDetails.period}.xlsx`
    : `Monthly_Bills_Summary_${new Date().getFullYear()}.xlsx`;
    
  saveAs(new Blob([buffer]), fileName);
};