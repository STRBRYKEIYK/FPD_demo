// PDF export (requires jsPDF)
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable';

/**
 * Export sales invoices to PDF format
 * @param {Array} invoices - Array of invoice objects
 * @param {string} filename - Name of the file to download
 */
export function exportInvoicesToPDF(invoices, filename = 'sales_invoices_export.pdf') {
  if (!invoices || invoices.length === 0) {
    throw new Error('No invoices to export');
  }
  const doc = new jsPDF();

  // Define columns to display in PDF (with separate breakdown columns)
  const columns = [
    'Invoice #',
    'Customer',
    'Date',
    'Quarter',
    'Type',
    'Vatable Sales',
    'VAT',
    'Zero-Rated Sales',
    'Exempt Sales',
    'Total amount'
  ];

  const rows = invoices.map(inv => {
    const total = parseFloat(inv.account_receivables) || 0;
    let vatableSales = '';
    let vat = '';
    let zeroRated = '';
    let exempt = '';
    if (inv.sale_type === 'vatable') {
      const vSales = total / 1.12;
      vatableSales = vSales.toLocaleString('en-PH', {minimumFractionDigits:2});
      vat = (vSales * 0.12).toLocaleString('en-PH', {minimumFractionDigits:2});
    } else if (inv.sale_type === 'zero-rated') {
      zeroRated = total.toLocaleString('en-PH', {minimumFractionDigits:2});
    } else if (inv.sale_type === 'exempt') {
      exempt = total.toLocaleString('en-PH', {minimumFractionDigits:2});
    }
    return [
      inv.invoice_number ?? '',
      inv.customer_name ?? '',
      inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '',
      inv.quarter ?? '',
      inv.sale_type ?? '',
      vatableSales,
      vat,
      zeroRated,
      exempt,
      inv.account_receivables ?? ''
    ];
  });

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: 14, right: 14 }
  });
  doc.save(filename);
}
// ============================================================================
// finance-import-export.js
// Utility functions for importing and exporting finance data (Sales Invoices)
// Supports CSV and Excel formats
// ============================================================================

import * as XLSX from 'xlsx'

// Standard columns for sales invoice export/import
export const SALES_INVOICE_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice Number', required: true },
  { key: 'customer_name', label: 'Customer Name', required: true },
  { key: 'invoice_date', label: 'Invoice Date', required: true },
  { key: 'sale_type', label: 'Sale Type', required: true }, // vatable, zero-rated, exempt
  { key: 'account_receivables', label: 'Total Amount', required: true },
  { key: 'tin', label: 'TIN', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'business_style', label: 'Business Style', required: false },
  { key: 'description', label: 'Description', required: false },
]

/**
 * Export sales invoices to CSV format
 * @param {Array} invoices - Array of invoice objects
 * @param {string} filename - Name of the file to download
 */
export function exportInvoicesToCSV(invoices, filename = 'sales_invoices_export.csv') {
  if (!invoices || invoices.length === 0) {
    throw new Error('No invoices to export')
  }

  // Create CSV header
  const headers = SALES_INVOICE_COLUMNS.map(col => col.label).join(',')
  
  // Create CSV rows
  const rows = invoices.map(invoice => {
    return SALES_INVOICE_COLUMNS.map(col => {
      let value = invoice[col.key] ?? ''
      
      // Format date if it's a date field
      if (col.key === 'invoice_date' && value) {
        value = new Date(value).toISOString().split('T')[0]
      }
      
      // Escape values that contain commas or quotes
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })

  // Combine header and rows
  const csv = [headers, ...rows].join('\n')

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

/**
 * Export sales invoices to Excel format
 * @param {Array} invoices - Array of invoice objects
 * @param {string} filename - Name of the file to download
 */
export function exportInvoicesToExcel(invoices, filename = 'sales_invoices_export.xlsx') {
  if (!invoices || invoices.length === 0) {
    throw new Error('No invoices to export')
  }

  // Prepare data with headers
  const headers = SALES_INVOICE_COLUMNS.map(col => col.label)
  const data = invoices.map(invoice => 
    SALES_INVOICE_COLUMNS.map(col => {
      let value = invoice[col.key] ?? ''
      
      // Format date
      if (col.key === 'invoice_date' && value) {
        value = new Date(value).toISOString().split('T')[0]
      }
      
      return value
    })
  )

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])

  // Set column widths
  ws['!cols'] = SALES_INVOICE_COLUMNS.map(col => ({ wch: 20 }))

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices')

  // Add instructions sheet
  const instructionsData = [
    ['Sales Invoice Import Template'],
    [''],
    ['Instructions:'],
    ['1. Fill in the required fields marked with *'],
    ['2. Invoice Number must be unique (will be auto-formatted to 6 digits)'],
    ['3. Invoice Date format: YYYY-MM-DD (e.g., 2026-01-09)'],
    ['4. Sale Type must be one of: vatable, zero-rated, or exempt'],
    ['5. Total Amount should be the final amount including all taxes'],
    [''],
    ['Required Fields:'],
    ...SALES_INVOICE_COLUMNS.filter(col => col.required).map(col => [col.label]),
    [''],
    ['Optional Fields:'],
    ...SALES_INVOICE_COLUMNS.filter(col => !col.required).map(col => [col.label]),
    [''],
    ['Sale Type Options:'],
    ['vatable - VATable sales (VAT will be calculated automatically)'],
    ['zero-rated - Zero-rated sales (no VAT)'],
    ['exempt - Exempt from VAT'],
  ]
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData)
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions')

  // Write file
  XLSX.writeFile(wb, filename)
}

/**
 * Parse uploaded CSV file
 * @param {File} file - The uploaded CSV file
 * @returns {Promise<Object>} Parsed invoices and any errors
 */
export async function parseInvoiceCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          reject(new Error('CSV file is empty or has no data rows'))
          return
        }

        // Parse header
        const headers = parseCSVLine(lines[0])
        const columnMap = createInvoiceColumnMapping(headers)

        // Parse data rows
        const invoices = []
        const errors = []

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i])
            if (values.every(v => !v || v.trim() === '')) continue // Skip empty rows
            
            const invoice = mapRowToInvoice(values, columnMap, i + 1)
            invoices.push(invoice)
          } catch (error) {
            errors.push({ row: i + 1, error: error.message })
          }
        }

        resolve({ invoices, errors })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Parse uploaded Excel file
 * @param {File} file - The uploaded Excel file
 * @returns {Promise<Object>} Parsed invoices and any errors
 */
export async function parseInvoiceExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Use first sheet or 'Sales Invoices' sheet
        const sheetName = workbook.SheetNames.includes('Sales Invoices') 
          ? 'Sales Invoices' 
          : workbook.SheetNames[0]
        
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length < 2) {
          reject(new Error('Excel file is empty or has no data rows'))
          return
        }

        // Parse header
        const headers = jsonData[0]
        const columnMap = createInvoiceColumnMapping(headers)

        // Parse data rows
        const invoices = []
        const errors = []

        for (let i = 1; i < jsonData.length; i++) {
          try {
            const values = jsonData[i]
            if (!values || values.every(v => !v || String(v).trim() === '')) continue
            
            const invoice = mapRowToInvoice(values, columnMap, i + 1)
            invoices.push(invoice)
          } catch (error) {
            errors.push({ row: i + 1, error: error.message })
          }
        }

        resolve({ invoices, errors })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Validate imported invoices
 * @param {Array} invoices - Array of invoices to validate
 * @returns {Object} Validation result with valid invoices and errors
 */
export function validateImportedInvoices(invoices) {
  const validInvoices = []
  const errors = []

  invoices.forEach((invoice, index) => {
    const rowErrors = []

    // Validate required fields
    if (!invoice.invoice_number || String(invoice.invoice_number).trim() === '') {
      rowErrors.push('Invoice Number is required')
    }
    if (!invoice.customer_name || String(invoice.customer_name).trim() === '') {
      rowErrors.push('Customer Name is required')
    }
    if (!invoice.invoice_date || String(invoice.invoice_date).trim() === '') {
      rowErrors.push('Invoice Date is required')
    }
    if (!invoice.sale_type || String(invoice.sale_type).trim() === '') {
      rowErrors.push('Sale Type is required')
    }
    if (!invoice.account_receivables || isNaN(parseFloat(invoice.account_receivables))) {
      rowErrors.push('Total Amount must be a valid number')
    }

    // Validate sale type
    const validSaleTypes = ['vatable', 'zero-rated', 'exempt']
    if (invoice.sale_type && !validSaleTypes.includes(invoice.sale_type.toLowerCase())) {
      rowErrors.push(`Sale Type must be one of: ${validSaleTypes.join(', ')}`)
    }

    // Validate date format
    if (invoice.invoice_date) {
      const dateObj = new Date(invoice.invoice_date)
      if (isNaN(dateObj.getTime())) {
        rowErrors.push('Invoice Date must be a valid date (YYYY-MM-DD format)')
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: index + 1,
        invoice,
        errors: rowErrors
      })
    } else {
      // Normalize data
      validInvoices.push({
        ...invoice,
        invoice_number: String(invoice.invoice_number).trim(),
        customer_name: String(invoice.customer_name).trim(),
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        sale_type: invoice.sale_type.toLowerCase(),
        account_receivables: parseFloat(invoice.account_receivables),
        tin: invoice.tin ? String(invoice.tin).trim() : '',
        address: invoice.address ? String(invoice.address).trim() : '',
        business_style: invoice.business_style ? String(invoice.business_style).trim() : '',
        description: invoice.description ? String(invoice.description).trim() : '',
      })
    }
  })

  return { validInvoices, errors }
}

/**
 * Generate a sample template for download
 * @param {string} format - 'csv' or 'excel'
 */
export function downloadInvoiceTemplate(format = 'csv') {
  const sampleData = [
    {
      invoice_number: '000501',
      customer_name: 'Sample Customer 1',
      invoice_date: '2026-01-01',
      sale_type: 'vatable',
      account_receivables: 112000.00,
      tin: '123-456-789-000',
      address: '123 Sample St, Sample City',
      business_style: 'Sample Business Inc.',
      description: 'Sample invoice for reference'
    },
    {
      invoice_number: '000502',
      customer_name: 'Sample Customer 2',
      invoice_date: '2026-01-05',
      sale_type: 'zero-rated',
      account_receivables: 50000.00,
      tin: '987-654-321-000',
      address: '456 Example Ave, Example Town',
      business_style: 'Example Corporation',
      description: 'Zero-rated sales example'
    }
  ]

  if (format === 'excel') {
    exportInvoicesToExcel(sampleData, 'sales_invoice_template.xlsx')
  } else {
    exportInvoicesToCSV(sampleData, 'sales_invoice_template.csv')
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && nextChar === '"' && inQuotes) {
      current += '"'
      i++ // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  values.push(current.trim())
  return values
}

/**
 * Create mapping between file headers and internal column keys
 */
function createInvoiceColumnMapping(headers) {
  const mapping = {}
  
  headers.forEach((header, index) => {
    const normalizedHeader = String(header).toLowerCase().trim()
    const column = SALES_INVOICE_COLUMNS.find(col => 
      col.label.toLowerCase() === normalizedHeader
    )
    
    if (column) {
      mapping[index] = column.key
    }
  })

  return mapping
}

/**
 * Map a row of values to an invoice object
 */
function mapRowToInvoice(values, columnMap, rowNum) {
  const invoice = {}
  
  Object.entries(columnMap).forEach(([index, key]) => {
    const value = values[parseInt(index)]
    if (value !== undefined && value !== null && value !== '') {
      invoice[key] = value
    }
  })

  // Validate required fields are present
  const missingFields = SALES_INVOICE_COLUMNS
    .filter(col => col.required && !invoice[col.key])
    .map(col => col.label)

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
  }

  return invoice
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
