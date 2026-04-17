// Print Invoice Handler
export function handlePrintInvoice(invoice, formatCurrency, showSuccess) {
  const printWindow = window.open('', '_blank')

  const escapeHtml = (value) => {
    const raw = value == null ? '' : String(value);
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #${escapeHtml(invoice.invoice_number || '000000')}</title>
        <style>
          /* RESET & BASICS */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 11px;
            background: #555; 
            padding: 20px;
            -webkit-print-color-adjust: exact;
          }

          /* PAPER CONTAINER */
          .page {
            width: 8.5in;
            height: 11in;
            background: white;
            margin: 0 auto;
            padding: 0.5in;
            position: relative;
            display: flex;
            flex-direction: column;
          }

          /* HEADER */
          .header { text-align: center; margin-bottom: 20px; position: relative; }
          .company-name {
            font-family: "Arial Narrow", "Arial", sans-serif;
            font-size: 22px;
            font-weight: 900;
            color: #000;
            letter-spacing: -0.5px;
            transform: scaleY(1.1);
          }
          .company-address { font-size: 10px; line-height: 1.3; margin-top: 5px; }

          /* INVOICE TITLE & NUMBER */
          .invoice-meta-row { position: relative; height: 40px; margin-bottom: 10px; }
          .invoice-title {
            text-align: center;
            font-family: "Times New Roman", Times, serif;
            font-size: 18px;
            font-weight: bold;
            position: absolute;
            width: 100%;
            top: 5px;
          }
          .invoice-no {
            position: absolute;
            right: 0;
            top: 0;
            font-family: "Times New Roman", Times, serif;
            font-size: 20px;
            color: #d00000;
            font-weight: bold;
          }
          .no-label { font-size: 14px; margin-right: 5px; color: #d00000; }
          .sup { vertical-align: super; font-size: 9px; text-decoration: underline; }

          /* CUSTOMER INFO GRID */
          .info-grid { display: flex; flex-direction: column; gap: 4px; margin-bottom: 5px; font-size: 11px; }
          .row { display: flex; width: 100%; align-items: flex-end; }
          .field { display: flex; align-items: flex-end; }
          .label { white-space: nowrap; margin-right: 5px; font-weight: normal; }
          .input-line {
            flex-grow: 1;
            border-bottom: 1px solid #000;
            height: 16px;
            padding-left: 5px;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
          }
          
          .w-sold { flex: 0.7; }
          .w-date { flex: 0.3; margin-left: 20px; }
          .w-addr { flex: 0.7; }
          .w-term { flex: 0.3; margin-left: 20px; }
          .w-so { width: 22%; }
          .w-dr { width: 22%; margin-left: 10px; }
          .w-ptr { width: 22%; margin-left: 10px; }
          .w-sales { flex-grow: 1; margin-left: 10px; }
          .w-style { flex: 0.65; }
          .w-tin { flex: 0.35; margin-left: 10px; }

          /* MAIN ITEM TABLE */
          .table-container {
            border: 2px solid #000;
            margin-top: 5px;
            flex-grow: 1; 
            display: flex;
            flex-direction: column;
          }
          table { width: 100%; border-collapse: collapse; }
          th {
            border-bottom: 1px solid #000;
            border-right: 1px solid #000;
            padding: 4px;
            font-family: "Times New Roman", serif;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
          }
          th:last-child { border-right: none; }
          td { border-right: 1px solid #000; padding: 4px; font-size: 11px; vertical-align: top; }
          td:last-child { border-right: none; }
          .empty-row td { height: 400px; }

          /* SUMMARY SECTION */
          .summary-box {
            border: 2px solid #000;
            border-top: none;
            display: flex;
            font-size: 11px;
          }
          .summary-left {
            width: 35%;
            border-right: 1px solid #000;
            padding: 5px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            gap: 2px;
          }
          .summary-right { width: 65%; padding: 5px 10px; }
          .sum-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .sum-total { border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; font-weight: bold; }

          /* FOOTER LAYOUT */
          .footer {
            margin-top: 15px;
            font-size: 10px;
          }
          
          /* Footer Split: Left (Fine Print) vs Right (Signature) */
          .footer-split {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .footer-left {
            width: 60%;
          }

          .footer-right {
            width: 40%;
            display: flex;
            flex-direction: column;
            align-items: center;
            /* Padding top pushes content down to align "Received" with 2nd line of left text */
            padding-top: 12px; 
          }

          .fine-print {
            font-size: 8px;
            line-height: 1.4;
            font-family: Arial, sans-serif;
          }

          .received-text {
            text-align: center;
            font-size: 10px;
            margin-bottom: 40px; /* Space between text and signature line */
          }

          .signature-line {
            width: 220px;
            border-top: 1px solid #000;
            text-align: center;
            font-size: 10px;
            padding-top: 4px;
          }

          .validity {
            text-align: center;
            font-style: italic;
            font-weight: bold;
            font-size: 9px;
            margin-top: 20px;
          }

          @media print {
            body { background: none; padding: 0; }
            .page { width: 100%; height: 100%; margin: 0; padding: 0.2in 0.5in; box-shadow: none; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <button style="position:fixed; top:20px; right:20px; padding:10px;" onclick="window.print()">Print</button>
        
        <div class="page">
          <div class="header">
            <div class="company-name">JJC ENGINEERING WORKS & GENERAL SERVICES</div>
            <div class="company-address">
              Blk. 3 Lot 11-B & C South Carolina St., Joyous Hts. Subd., Sitio Hinapao, San Jose (Pob.) Antipolo City<br>
              JERRY B. CUETO - Prop. • VAT Reg. TIN: 106-612-798-000<br>
              Tel. No. (02) 8288-2686 / (02) 7964-0086
            </div>
          </div>

          <div class="invoice-meta-row">
            <div class="invoice-title">SALES INVOICE</div>
            <div class="invoice-no">
              <span class="no-label">N<span class="sup">o</span></span>${escapeHtml(invoice.invoice_number || '000000')}
            </div>
          </div>

          <div class="info-grid">
            <div class="row">
              <div class="field w-sold">
                <span class="label">SOLD TO:</span>
                <span class="input-line">${escapeHtml(invoice.customer_name || '')}</span>
              </div>
              <div class="field w-date">
                <span class="label">DATE:</span>
                <span class="input-line" style="text-align: center;">${escapeHtml(formatDate(invoice.invoice_date))}</span>
              </div>
            </div>
            <div class="row">
              <div class="field w-addr">
                <span class="label">ADDRESS:</span>
                <span class="input-line">${escapeHtml(invoice.customer_address || '')}</span>
              </div>
              <div class="field w-term">
                <span class="label">TERMS:</span>
                <span class="input-line" style="text-align: center;">${escapeHtml(invoice.payment_terms || '')}</span>
              </div>
            </div>
            <div class="row">
              <div class="field w-so">
                <span class="label">S.O. NO.</span>
                <span class="input-line">${escapeHtml(invoice.so_number || '')}</span>
              </div>
              <div class="field w-dr">
                <span class="label">D.R. NO.</span>
                <span class="input-line">${escapeHtml(invoice.dr_number || '')}</span>
              </div>
              <div class="field w-ptr">
                <span class="label">PTR/RC NO.</span>
                <span class="input-line">${escapeHtml(invoice.ptr_rc_number || '')}</span>
              </div>
              <div class="field w-sales">
                <span class="label">SALESMAN:</span>
                <span class="input-line">${escapeHtml(invoice.salesman || '')}</span>
              </div>
            </div>
            <div class="row">
              <div class="field w-style">
                <span class="label">BUSINESS STYLE:</span>
                <span class="input-line">${escapeHtml(invoice.business_style || '')}</span>
              </div>
              <div class="field w-tin">
                <span class="label">TIN:</span>
                <span class="input-line">${escapeHtml(invoice.customer_tin || '')}</span>
              </div>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">STOCK<br>CODE</th>
                  <th style="width: 7%;">Qty.</th>
                  <th style="width: 7%;">Unit</th>
                  <th style="width: 46%; letter-spacing: 3px;">D E S C R I P T I O N</th>
                  <th style="width: 15%;">Unit Price</th>
                  <th style="width: 15%;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                 ${invoice.items && invoice.items.length > 0 ? 
                  invoice.items.map(item => `
                    <tr>
                      <td style="text-align: center;">${escapeHtml(item.stock_code || '')}</td>
                      <td style="text-align: center;">${escapeHtml(item.quantity || '')}</td>
                      <td style="text-align: center;">${escapeHtml(item.unit || '')}</td>
                      <td>${escapeHtml(item.description || '')}</td>
                      <td style="text-align: right;">${item.unit_price ? escapeHtml(formatCurrency(item.unit_price)) : ''}</td>
                      <td style="text-align: right;">${item.amount ? escapeHtml(formatCurrency(item.amount)) : ''}</td>
                    </tr>
                  `).join('') : ''
                }
                <tr class="empty-row">
                  <td style="height: ${Math.max(300, 420 - ((invoice.items?.length || 0) * 20))}px"></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="summary-box">
            <div class="summary-left">
              <div>VATable Sales</div>
              <div>VAT-Exempt Sales</div>
              <div>Zero Rated Sales</div>
              <div>VAT Amount</div>
            </div>
            <div class="summary-right">
              <div class="sum-row">
                <span>Total Sales (VAT Inclusive)</span>
                <span>${invoice.total_amount ? escapeHtml(formatCurrency(invoice.total_amount)) : ''}</span>
              </div>
              <div class="sum-row">
                <span>Less: VAT</span>
                <span>${invoice.vat_amount ? escapeHtml(formatCurrency(invoice.vat_amount)) : ''}</span>
              </div>
              <div class="sum-row">
                <span>Amount Net of VAT</span>
                <span>${invoice.vatable_sales ? escapeHtml(formatCurrency(invoice.vatable_sales)) : ''}</span>
              </div>
              <div class="sum-row">
                <span>Less Withholding Tax</span>
                <span></span>
              </div>
              <div class="sum-row">
                <span>Amount Due</span>
                <span></span>
              </div>
              <div class="sum-row">
                <span>Add: VAT</span>
                <span>${invoice.vat_amount ? escapeHtml(formatCurrency(invoice.vat_amount)) : ''}</span>
              </div>
              <div class="sum-row sum-total">
                <span>Total Amount Due</span>
                <span>${invoice.total_amount ? escapeHtml(formatCurrency(invoice.total_amount)) : ''}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-split">
              
              <div class="footer-left">
                <div class="fine-print">
                  25 Bklts. (50X4) 000001-001250<br>
                  BIR Authority to Print No.: OCN045AU20220000005393<br>
                  Date Issued: 05/16/2022 &nbsp;&nbsp; Valid until: 05/15/2027<br>
                  Issued by: BCN888-A00-000-2020-0000000000-0000<br>
                  <strong>CADMARC Printing Services</strong><br>
                  167 San Jose St., San Isidro, Antipolo City (Tel. #: 7002597)<br>
                  VAT Reg. TIN: 154-885-263-000<br>
                  Printer's Accreditation No.: 045MP20190000000027<br>
                  Date of Accreditation: 01/29/2019 &nbsp;&nbsp; Valid until: 01/28/2024
                </div>
              </div>

              <div class="footer-right">
                <div class="received-text">
                  Received the above goods in order and condition.
                </div>
                <div class="signature-line">
                  Printed name and Signature
                </div>
              </div>

            </div>

            <div class="validity">
              THIS SALES INVOICE SHALL BE VALID FOR FIVE (5) YEARS FROM THE DATE OF ATP
            </div>
          </div>

        </div>
      </body>
    </html>
  `)
  printWindow.document.close()
  showSuccess('Print preview opened')
}

// Duplicate Invoice Handler
export function handleDuplicateInvoice(invoice, user, setEditingInvoice, setViewModalOpen, setShowInvoiceForm, showInfo, showError) {
  try {
    const duplicateData = {
      ...invoice,
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      created_by: user?.id
    };
    delete duplicateData.id;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;
    setEditingInvoice(duplicateData);
    setViewModalOpen(false);
    setShowInvoiceForm(true);
    if (showInfo) showInfo('Duplicating invoice - please set a new invoice number');
  } catch (error) {
    if (showError) showError('Failed to duplicate invoice');
  }
}

// Info Toast Handler
export function showInfo(message, showSuccess) {
  if (showSuccess) showSuccess(message);
}
// SalesInvoice-Handlers.js
// Handlers for SalesInvoiceSection (refactored from SalesInvoiceSection.jsx)

import apiService from "../../../utils/api/api-service";

export async function fetchInvoices(setLoading, setInvoices, filters = {}) {
  try {
    setLoading(true);
    const data = await apiService.finance.getInvoices(filters);
    setInvoices(data.invoices || []);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
  } finally {
    setLoading(false);
  }
}

export async function fetchCustomers(setCustomers) {
  try {
    const data = await apiService.finance.getCustomers();
    setCustomers(data.customers || []);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
  }
}

export async function handleSubmitInvoice({
  invoiceData,
  editingInvoice,
  user,
  showSuccess,
  showError,
  fetchInvoices,
  selectedQuarter,
  onDataChange,
  setShowInvoiceForm,
  setEditingInvoice
}) {
  try {
    const dataWithAudit = {
      ...invoiceData,
      created_by: user?.id || null
    };
    if (editingInvoice) {
      await apiService.finance.updateInvoice(editingInvoice.id, dataWithAudit);
      showSuccess('Invoice updated successfully!');
    } else {
      await apiService.finance.createInvoice(dataWithAudit);
      showSuccess('Invoice created successfully!');
    }
    await fetchInvoices(selectedQuarter ? { quarter: selectedQuarter } : {});
    if (onDataChange) await onDataChange();
    setShowInvoiceForm(false);
    setEditingInvoice(null);
  } catch (error) {
    console.error('Failed to save invoice:', error);
    showError(error.message || 'Failed to save invoice');
    throw error;
  }
}

export async function validateInvoiceNumber(invoiceNumber) {
  try {
    const data = await apiService.finance.getInvoices();
    const exists = data.invoices?.some(inv => inv.invoice_number === invoiceNumber);
    return !exists;
  } catch (error) {
    console.error('Failed to validate invoice number:', error);
    return false;
  }
}

// Add more handlers as needed (delete, duplicate, etc.)
