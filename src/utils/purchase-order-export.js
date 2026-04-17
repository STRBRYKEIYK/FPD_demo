// ============================================================================
// purchase-order-export.js - Engineering Standard Purchase Order
// Follows architectural/engineering drawing standards
// ============================================================================
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import companyLogo from "../assets/companyLogo.jpg"

// Company Information
const COMPANY_INFO = {
  name: "JJC ENGINEERING WORKS & GENERAL SERVICES",
  address: "B-3 L-11, South Carolina St., Joyous Hts, Subdivision",
  address2: "Sitio Hinapao, Brgy. San Jose, Antipolo City",
  phone: "Tel #: (632) 8288-2686 / (632) 7004-9842",
  email: "E-mail: jjcenggworks@yahoo.com",
  logo: companyLogo
}

/**
 * Engineering-Standard Purchase Order PDF Export
 * Follows architectural/technical drawing conventions:
 * - Title block format
 * - Technical line weights
 * - Grid-based layout
 * - Minimal decoration
 * - Professional typography
 */
export const exportPurchaseOrderToPDF = (poData) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  
  const isValidDataUrlImage = (s) => {
    return typeof s === 'string' && /^data:image\/(png|jpe?g);base64,/i.test(s.trim())
  }

  const pickImageData = (img) => {
    const candidate = (img && typeof img === 'object' && 'data' in img) ? img.data : img
    if (typeof candidate !== 'string') return null
    const trimmed = candidate.trim()
    // Some sources may include non-standard headers; only allow jpeg/png
    if (isValidDataUrlImage(trimmed)) return trimmed
    // If it's a data URL but unsupported (e.g., webp), skip it to avoid jsPDF UNKNOWN type
    if (/^data:image\//i.test(trimmed) && !/^data:image\/(png|jpe?g);base64,/i.test(trimmed)) return null
    // Not a data URL; skip
    return null
  }

  const normalizeAttachedImages = (images) => {
    let parsed = []

    if (Array.isArray(images)) parsed = images
    else if (typeof images === 'string' && images.trim()) {
      try {
        const maybeArray = JSON.parse(images)
        parsed = Array.isArray(maybeArray) ? maybeArray : []
      } catch {
        parsed = []
      }
    } else if (images && typeof images === 'object') parsed = [images]

    const seen = new Set()
    const uniqueImages = []

    parsed.forEach((img) => {
      const imgData = pickImageData(img)
      if (!imgData) return
      if (seen.has(imgData)) return
      seen.add(imgData)
      uniqueImages.push(img)
    })

    return uniqueImages
  }
  
  // Engineering drawing margins (standard A4)
  const margin = 10
  const rightMargin = 10
  const titleBlockHeight = 25
  const sectionSpacing = 6
  
  // Technical line weights (ISO standard)
  const LINE_WEIGHTS = {
  border: 0.5,
  divider: 0.3,
  grid: 0.1
  }

  // Standard font sizes
  const FONT_SIZES = {
    title: 14,
    header: 11,
    section: 9,
    body: 8,
    small: 7,
    tiny: 6,
    large: 12  // Added large font size for GRAND TOTAL emphasis
  }

  const getGeneratedTimestamp = () =>
    new Date().toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })

  const poStatus = String(poData?.status || poData?.order_status || "").toLowerCase()
  const isDraftPo = poStatus === "draft"
  const resolvedPoNumber = String(poData.po_number || poData.id || "").trim()
  const displayPoNumber = isDraftPo ? "DRAFT" : (resolvedPoNumber || "-")
  const footerPoLabel = isDraftPo
    ? "DRAFT"
    : (resolvedPoNumber ? `PO-${resolvedPoNumber}` : "PO")
  const drawPageFooter = () => {
    const pageFooterY = pageHeight - margin - 5
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.line(margin, pageFooterY, pageWidth - rightMargin, pageFooterY)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(FONT_SIZES.tiny)
    doc.text(`GENERATED: ${getGeneratedTimestamp()}`, margin + 1, pageFooterY + 2.5)
    doc.text(footerPoLabel, pageWidth / 2, pageFooterY + 2.5, { align: "center" })
  }

  let yPos = margin

  // Get items and calculate total
  const items = poData.items || poData.selectedItems || []
  const notesText = typeof poData.notes === 'string' ? poData.notes.trim() : ''
  const attachedImages = normalizeAttachedImages(poData.attached_images)

  // Helper to resolve unit price from various possible field names
  const resolveUnitPrice = (item) => {
    // Prefer explicit unit_price (DB), then price_per_unit (frontend), then unitPrice
    if (item == null) return 0
    const candidates = [item.unit_price, item.price_per_unit, item.unitPrice, item.unitPriceRaw]
    for (const v of candidates) {
      if (typeof v === 'number' && !isNaN(v)) return v
      if (typeof v === 'string' && v.trim() !== '') {
        const parsed = Number(v)
        if (!isNaN(parsed)) return parsed
      }
    }
    // If item.amount exists and quantity present, derive unit price
    if (item.amount && item.quantity) {
      const q = Number(item.quantity) || 0
      if (q > 0) return Number(item.amount) / q
    }
    return 0
  }

  const resolveAmount = (item) => {
    if (item == null) return 0
    if (typeof item.amount === 'number') return item.amount
    if (typeof item.amount === 'string' && item.amount.trim() !== '') {
      const parsed = Number(item.amount)
      if (!isNaN(parsed)) return parsed
    }
    const qty = Number(item.quantity) || 0
    const up = resolveUnitPrice(item)
    return qty * up
  }

  // Prefer total_value from the PO if present (server may precompute), otherwise compute from items
  const computedItemsTotal = items.reduce((sum, item) => sum + resolveAmount(item), 0)
  const totalAmount = (typeof poData.total_value === 'number' && !isNaN(poData.total_value)) ? poData.total_value : computedItemsTotal

  // Format currency - Remove "PHP" prefix and peso sign from unit price and amount
  const formatPeso = (amount) => {
    return amount.toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })
  }

  // Format currency with PHP prefix for totals
  const formatPesoWithPrefix = (amount) => {
    const formatted = amount.toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })
    return `PHP ${formatted}`
  }

  // Tax calculation
  const getTaxRate = () => {
    if (!poData.apply_tax) return 0 // No tax when apply_tax is false
    switch(poData.tax_type) {
      case 'goods': return 0.01 // 1%
      case 'services': return 0.02 // 2%
      case 'rental': return 0.05 // 5%
      default: return 0.01
    }
  }

  const calculateTaxBreakdown = () => {
    const totalBeforeWithholdingTax = totalAmount
    const subtotal = poData.apply_tax ? totalBeforeWithholdingTax / 1.12 : totalBeforeWithholdingTax // Remove 12% VAT only if tax is applied
    const taxRate = getTaxRate()
    const withholdingTax = subtotal * taxRate
    const totalAfterWithholdingTax = totalBeforeWithholdingTax - withholdingTax
    
    // Calculate discount based on type
    let discountAmount = 0
    if (poData.has_discount) {
      const discountType = poData.discount_type || "percentage" // Default to percentage for backward compatibility
      if (discountType === "percentage") {
        const discountValue = poData.discount_value || poData.discount_percentage || 0
        discountAmount = totalAfterWithholdingTax * (Number(discountValue) / 100)
      } else if (discountType === "fixed") {
        discountAmount = Number(poData.discount_value || 0)
      }
    }
    
    const grandTotal = totalAfterWithholdingTax - discountAmount

    return {
      totalBeforeWithholdingTax,
      subtotal,
      taxRate: taxRate * 100,
      withholdingTax,
      totalAfterWithholdingTax,
      discountType: poData.discount_type || "percentage",
      discountValue: poData.has_discount ? Number(poData.discount_value || poData.discount_percentage || 0) : 0,
      discountPercentage: poData.has_discount && (poData.discount_type === "percentage" || !poData.discount_type) 
        ? Number(poData.discount_value || poData.discount_percentage || 0) 
        : 0,
      discountAmount,
      grandTotal,
      applyTax: poData.apply_tax // Include flag for consistency
    }
  }

  const taxBreakdown = calculateTaxBreakdown()

  // ============================================================================
  // ITEMS TABLE PREPARATION
  // ============================================================================
  
  const tableColumns = [
    { header: "ITEM", dataKey: "item" },
    { header: "QTY", dataKey: "qty" },
    { header: "UNIT", dataKey: "unit" },
    { header: "DESCRIPTION", dataKey: "description" },
    { header: "UNIT PRICE", dataKey: "unitPrice" },
    { header: "AMOUNT", dataKey: "amount" }
  ]
  
  const compactDescription = (value) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim()
    return normalized
  }

  const formatDescriptionForTwoLines = (value, maxWidth, fontName, fontStyle, fontSize) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim()
    if (!normalized || maxWidth <= 1) return [normalized]

    doc.setFont(fontName || "helvetica", fontStyle || "normal")
    doc.setFontSize(fontSize || (FONT_SIZES.body + 0.8))

    const wrapped = doc.splitTextToSize(normalized, maxWidth)
    if (wrapped.length <= 2) return wrapped

    const ellipsis = "..."
    const firstLine = String(wrapped[0] || "").trimEnd()
    let secondLine = String(wrapped[1] || "").trimEnd()
    const ellipsisWidth = doc.getTextWidth(ellipsis)

    while (secondLine && doc.getTextWidth(secondLine) + ellipsisWidth > maxWidth) {
      secondLine = secondLine.slice(0, -1).trimEnd()
    }

    return [firstLine, `${secondLine || ""}${ellipsis}`]
  }

  const normalizeQuotationNo = (value) => {
    const digits = String(value || "").replace(/\D/g, "")
    return /^\d{6}$/.test(digits) ? digits : null
  }

  const itemsWithMeta = (items || []).map((item, originalIndex) => ({
    item,
    originalIndex,
    quotationNo: normalizeQuotationNo(item.supplier_specific || item.quotation_no)
  }))

  itemsWithMeta.sort((a, b) => {
    if (a.quotationNo && b.quotationNo) {
      if (a.quotationNo !== b.quotationNo) return a.quotationNo.localeCompare(b.quotationNo)
      return a.originalIndex - b.originalIndex
    }
    if (a.quotationNo && !b.quotationNo) return -1
    if (!a.quotationNo && b.quotationNo) return 1
    return a.originalIndex - b.originalIndex
  })

  const tableRows = []
  let currentQuotation = null
  let currentQuotationSubtotal = 0
  let itemCounter = 1

  const pushQuotationSubtotalRow = () => {
    if (!currentQuotation) return

    tableRows.push({
      item: "",
      qty: "",
      unit: "",
      description: `SUBTOTAL QUOTATION #${currentQuotation}`,
      unitPrice: "",
      amount: formatPeso(currentQuotationSubtotal),
      _isQuotationHeader: false,
      _isQuotationSubtotal: true
    })
  }

  itemsWithMeta.forEach(({ item, quotationNo }) => {
    if (quotationNo !== currentQuotation) {
      if (currentQuotation) {
        pushQuotationSubtotalRow()
      }

      currentQuotation = quotationNo || null
      currentQuotationSubtotal = 0

      if (currentQuotation) {
      tableRows.push({
        item: "",
        qty: "",
        unit: "",
        description: `QUOTATION #${currentQuotation}`,
        unitPrice: "",
        amount: "",
        _isQuotationHeader: true,
        _isQuotationSubtotal: false
      })
      }
    }

    const itemAmount = resolveAmount(item) || 0

    tableRows.push({
      item: String(itemCounter).padStart(2, '0'),
      qty: Number.isFinite(Number(item.quantity)) ? String(Math.trunc(Number(item.quantity))) : "0",
      unit: item.unit || "pcs",
      description: compactDescription(item.item_name || item.description || ""),
      unitPrice: formatPeso(resolveUnitPrice(item) || 0),
      amount: formatPeso(itemAmount),
      _isQuotationHeader: false,
      _isQuotationSubtotal: false
    })

    if (currentQuotation) {
      currentQuotationSubtotal += itemAmount
    }

    itemCounter += 1
  })

  if (currentQuotation) {
    pushQuotationSubtotalRow()
  }

  // ============================================================================
  // PAGINATED ITEMS TABLE (dynamic rows per page based on printable area)
  // ============================================================================
  
  const estimatedRowHeight = 6.0
  const tableTopY = margin + titleBlockHeight + 2 + 4 + 32 + sectionSpacing
  const regularTableBottomY = pageHeight - margin - 8
  const lastPageTableBottomY = pageHeight - margin - 35
  const availableRegularHeight = Math.max(35, regularTableBottomY - tableTopY)
  const availableLastHeight = Math.max(35, lastPageTableBottomY - tableTopY)
  const maxRowsRegular = Math.max(1, Math.floor((availableRegularHeight - 10) / estimatedRowHeight))
  const maxRowsLast = Math.max(1, Math.floor((availableLastHeight - 10) / estimatedRowHeight))

  const pageRowCounts = []
  if (tableRows.length === 0) {
    pageRowCounts.push(0)
  } else {
    let rowIndex = 0
    while (rowIndex < tableRows.length) {
      const remainingRows = tableRows.length - rowIndex
      const pageLimit = remainingRows <= maxRowsLast ? maxRowsLast : maxRowsRegular
      let rowsThisPage = Math.min(pageLimit, remainingRows)

      if (rowsThisPage > 1) {
        const pageEndIndex = rowIndex + rowsThisPage - 1
        const endRow = tableRows[pageEndIndex]
        const nextRow = tableRows[pageEndIndex + 1]

        // Keep quotation header with at least one detail row on same page.
        if (nextRow && endRow?._isQuotationHeader) {
          rowsThisPage -= 1
        }

        // Avoid starting a page with quotation subtotal row.
        const nextPageFirstRow = tableRows[rowIndex + rowsThisPage]
        if (nextPageFirstRow?._isQuotationSubtotal) {
          rowsThisPage -= 1
        }

        rowsThisPage = Math.max(1, rowsThisPage)
      }

      pageRowCounts.push(rowsThisPage)
      rowIndex += rowsThisPage
    }
  }

  const totalPages = pageRowCounts.length
  const TABLE_MIN_SINGLE_LINE_FONT_SIZE = FONT_SIZES.small
  let rowCursor = 0
  
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const rowsOnPage = pageRowCounts[pageIndex]
    const startIndex = rowCursor
    const endIndex = Math.min(startIndex + rowsOnPage, tableRows.length)
    const pageRows = tableRows.slice(startIndex, endIndex)
    rowCursor = endIndex
    
    if (pageIndex > 0) {
      doc.addPage()
    }
    
    yPos = margin

    // ============================================================================
    // TITLE BLOCK - ON EVERY PAGE
    // ============================================================================
    
    const titleBlockY = yPos
    const logoSize = 16
    const logoX = margin + 3
    
    // Company logo
    try {
      doc.setLineWidth(LINE_WEIGHTS.grid)
      doc.rect(logoX, titleBlockY, logoSize, logoSize)
      doc.addImage(COMPANY_INFO.logo, 'JPEG', logoX + 0.3, titleBlockY + 0.3, logoSize - 0.6, logoSize - 0.6)
    } catch (err) {
      console.warn("Logo not loaded:", err)
    }

    // Company information
    const companyX = logoX + logoSize + 4
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.header)
    doc.text(COMPANY_INFO.name, companyX, titleBlockY + 4)
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(FONT_SIZES.body)
    doc.text(COMPANY_INFO.address, companyX, titleBlockY + 8)
    doc.text(COMPANY_INFO.address2, companyX, titleBlockY + 11)
    doc.text(COMPANY_INFO.phone, companyX, titleBlockY + 14)
    doc.text(COMPANY_INFO.email, companyX, titleBlockY + 17)

    // Document title box
    const titleX = pageWidth - rightMargin - 52
    doc.setLineWidth(LINE_WEIGHTS.divider)
    doc.rect(titleX, titleBlockY, 52, titleBlockHeight)
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.title)
    doc.text("PURCHASE ORDER", titleX + 26, titleBlockY + 8, { align: "center" })
    
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.line(titleX, titleBlockY + 11, titleX + 52, titleBlockY + 11)
    
    // PO Number
    doc.setFontSize(FONT_SIZES.small)
    doc.setFont("helvetica", "normal")
    doc.text("P.O. # :", titleX + 5, titleBlockY + 16)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.header)
  // Prefer po_number but fallback to id for older saved POs
  doc.text(displayPoNumber, titleX + 26, titleBlockY + 22, { align: "center" })

    yPos = titleBlockY + titleBlockHeight + 2

    // Horizontal divider
    doc.setLineWidth(LINE_WEIGHTS.divider)
    doc.line(margin, yPos, pageWidth - rightMargin, yPos)

    yPos += 4

    // ============================================================================
    // INFORMATION GRID - ON EVERY PAGE
    // ============================================================================
    
    const gridStartY = yPos
    const gridHeight = 32
    const totalGridWidth = pageWidth - margin - rightMargin
    const col1Width = totalGridWidth / 2
    const col2Width = totalGridWidth / 2
    const col2X = margin + col1Width
    
    // Consistent header and row heights for both columns
    const headerHeight = 4.5
    const rowHeight = (gridHeight - headerHeight) / 2  // 13.75 units per row

    // ========== LEFT COLUMN - Supplier Information ==========
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.rect(margin, gridStartY, col1Width, gridHeight)
    
    // Header
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.section)
    doc.text("SUPPLIER'S NAME & ADDRESS", margin + 2, gridStartY + 3)
    
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.line(margin, gridStartY + headerHeight, margin + col1Width, gridStartY + headerHeight)
    
    // Row 1 - Supplier Name & Address
    const leftRow1Y = gridStartY + headerHeight
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.section)
    doc.text((poData.supplier_name || "").toUpperCase(), margin + 2, leftRow1Y + 4)
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(FONT_SIZES.body)
    const supplierAddr = poData.supplier_address || ""
    const addrLines = doc.splitTextToSize(supplierAddr, col1Width - 4)
    addrLines.slice(0, 2).forEach((line, idx) => {
      doc.text(line, margin + 2, leftRow1Y + 7.5 + (idx * 3))
    })
    
    // Row 2 - Attention
    if (poData.attention_person) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(FONT_SIZES.section)
      doc.text(`Attention : ${poData.attention_person}`, margin + 2, leftRow1Y + rowHeight + (rowHeight / 2) + 1)
    }

    // ========== RIGHT COLUMN - Order Details ==========
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.rect(col2X, gridStartY, col2Width, gridHeight)
    
    // Header
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.section)
    doc.text("ORDER INFORMATION", col2X + 2, gridStartY + 3)
    
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.line(col2X, gridStartY + headerHeight, col2X + col2Width, gridStartY + headerHeight)

    // Row 1 - DATE
    const rightRow1Y = gridStartY + headerHeight
    doc.setFont("helvetica", "normal")
    doc.setFontSize(FONT_SIZES.section)
    doc.text("DATE :", col2X + 2, rightRow1Y + (rowHeight / 2) + 1)
    doc.text(poData.po_date || "—", col2X + 20, rightRow1Y + (rowHeight / 2) + 1)
    
    // Divider between rows
    const rightRow2Y = rightRow1Y + rowHeight
    doc.setLineWidth(LINE_WEIGHTS.grid)
    doc.line(col2X, rightRow2Y, col2X + col2Width, rightRow2Y)
    
    // Row 2 - TERMS
    doc.text("TERMS :", col2X + 2, rightRow2Y + (rowHeight / 2) + 1)
    doc.text(poData.terms || "—", col2X + 20, rightRow2Y + (rowHeight / 2) + 1)

    yPos = gridStartY + gridHeight + 4

    // ============================================================================
    // SHEET NUMBER
    // ============================================================================
    
    const currentPageNum = pageIndex + 1
    const sheetText = `SHEET ${currentPageNum} OF ${totalPages}`
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FONT_SIZES.header)
    doc.text(sheetText, pageWidth / 2, yPos + 2, { align: "center" })

    yPos += 5
    
    // ============================================================================
    // ITEMS TABLE
    // ============================================================================
    
    autoTable(doc, {
      startY: yPos,
      columns: tableColumns,
      body: pageRows,
      theme: 'grid',
      tableWidth: 'auto',
      styles: {
        fontSize: FONT_SIZES.body + 0.8,
        cellPadding: 1.2,
        lineColor: [0, 0, 0],
        lineWidth: LINE_WEIGHTS.grid,
        textColor: [0, 0, 0],
        font: "helvetica",
        overflow: 'ellipsize',
        minCellHeight: 5.2
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: LINE_WEIGHTS.divider,
        lineColor: [0, 0, 0],
        minCellHeight: 5.8,
        cellPadding: 1.2,
        fontSize: FONT_SIZES.body + 0.8
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      columnStyles: {
        item: { cellWidth: 10, halign: 'center', fontStyle: 'normal', fontSize: FONT_SIZES.body + 0.8 },
        qty: { cellWidth: 10, halign: 'center', fontSize: FONT_SIZES.body + 0.8 },
        unit: { cellWidth: 12, halign: 'center', fontSize: FONT_SIZES.body + 0.8 },
        description: { halign: 'left', fontSize: FONT_SIZES.body + 0.8 },
        unitPrice: { cellWidth: 25, halign: 'right', fontStyle: 'normal', fontSize: FONT_SIZES.body + 0.8 },
        amount: { cellWidth: 25, halign: 'right', fontStyle: 'normal', fontSize: FONT_SIZES.body + 0.8 }
      },
      margin: { left: margin, right: rightMargin },
      pageBreak: 'avoid',
      rowPageBreak: 'avoid',
      didParseCell: function(data) {
        if (data.section !== 'head' && data.section !== 'body') return

        if (data.section === 'body' && data.row?.raw?._isQuotationHeader) {
          const isDescription = data.column?.dataKey === 'description'
          data.cell.styles.fillColor = [236, 236, 236]
          data.cell.styles.fontStyle = isDescription ? 'bold' : 'normal'
          data.cell.styles.halign = 'center'
          data.cell.styles.fontSize = FONT_SIZES.body
          data.cell.styles.minCellHeight = 4.8
          if (!isDescription) {
            data.cell.text = ['']
          }
          return
        }

        if (data.section === 'body' && data.row?.raw?._isQuotationSubtotal) {
          const columnKey = data.column?.dataKey
          const isDescription = columnKey === 'description'
          const isAmount = columnKey === 'amount'

          data.cell.styles.fillColor = [245, 245, 245]
          data.cell.styles.fontStyle = (isDescription || isAmount) ? 'bold' : 'normal'
          data.cell.styles.fontSize = FONT_SIZES.body
          data.cell.styles.minCellHeight = 4.8

          if (isDescription) {
            data.cell.styles.halign = 'left'
          } else if (isAmount) {
            data.cell.styles.halign = 'right'
          } else {
            data.cell.styles.halign = 'center'
            data.cell.text = ['']
          }
          return
        }

        const cell = data.cell
        const rawText = Array.isArray(cell.text)
          ? cell.text.join(' ')
          : String(cell.text ?? '')
        const normalizedText = rawText.replace(/\s+/g, ' ').trim()
        const displayText = normalizedText
        const isDescriptionCell = data.section === 'body' && data.column?.dataKey === 'description'

        const padding = cell.styles.cellPadding
        const horizontalPadding =
          typeof padding === 'number'
            ? padding * 2
            : ((padding && padding.left) || 0) + ((padding && padding.right) || 0)

        const availableWidth = Math.max(1, (cell.width || 0) - horizontalPadding - 0.8)
        const baseFontSize = Number(cell.styles.fontSize || (FONT_SIZES.body + 0.8))

        if (isDescriptionCell) {
          cell.styles.overflow = 'linebreak'
          cell.text = formatDescriptionForTwoLines(
            displayText,
            availableWidth,
            cell.styles.font || 'helvetica',
            cell.styles.fontStyle || 'normal',
            baseFontSize
          )
          if (cell.text.length > 1) {
            cell.styles.minCellHeight = Math.max(Number(cell.styles.minCellHeight || 0), 8.8)
          }
          return
        }

        cell.text = [displayText]
        cell.styles.overflow = 'ellipsize'
        let dynamicFontSize = baseFontSize

        if (!displayText || availableWidth <= 1) return

        doc.setFont(cell.styles.font || 'helvetica', cell.styles.fontStyle || 'normal')
        while (dynamicFontSize > TABLE_MIN_SINGLE_LINE_FONT_SIZE) {
          doc.setFontSize(dynamicFontSize)
          if (doc.getTextWidth(displayText) <= availableWidth) break
          dynamicFontSize = Number((dynamicFontSize - 0.2).toFixed(2))
        }

        cell.styles.fontSize = Math.max(TABLE_MIN_SINGLE_LINE_FONT_SIZE, dynamicFontSize)
      },
      didDrawPage: function(data) {
        drawPageFooter()
      }
    })
    
    yPos = doc.lastAutoTable.finalY + sectionSpacing
    
    // ============================================================================
    // TOTAL AMOUNT - ONLY ON LAST PAGE
    // ============================================================================
    
    if (pageIndex === totalPages - 1) {
      const totalBoxWidth = 75
      const totalBoxX = pageWidth - rightMargin - totalBoxWidth - 1
      
      // Fixed container dimensions for consistency
      const rowHeight = 5
      const topPadding = 3
      const bottomPadding = 2
      const dividerSpace = 1.5
      const grandTotalRowHeight = 8  // Increased from 5.5 to 8 for better GRAND TOTAL padding
      
      // Calculate rows dynamically
      let contentRows = 0
      if (poData.apply_tax) {
        contentRows = 3 // Gross Total, Subtotal, Withholding Tax
      } else {
        contentRows = 1 // Total Amount only
      }
      if (taxBreakdown.discountAmount > 0) {
        contentRows += 1 // Discount row
      }
      
      // Fixed total box height regardless of content
      const totalBoxHeight = topPadding + (contentRows * rowHeight) + dividerSpace + grandTotalRowHeight + bottomPadding
      
      doc.setLineWidth(LINE_WEIGHTS.divider)
      doc.rect(totalBoxX, yPos, totalBoxWidth, totalBoxHeight)
      
      let rowY = yPos + topPadding + 3.5
      
      if (poData.apply_tax) {
        // Gross Total (with VAT) - only show when tax is applied
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.small)
        doc.text("GROSS TOTAL (with 12% VAT) =", totalBoxX + 2, rowY)
        doc.setFontSize(FONT_SIZES.section)
        doc.text(formatPesoWithPrefix(taxBreakdown.totalBeforeWithholdingTax), totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })
        
        rowY += rowHeight
        
        // Subtotal (after VAT removal)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.tiny)
        doc.text("Subtotal (Gross ÷ 1.12) =", totalBoxX + 2, rowY)
        doc.setFontSize(FONT_SIZES.body)
        doc.text(formatPesoWithPrefix(taxBreakdown.subtotal), totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })
        
        rowY += rowHeight
        
        // Withholding Tax
        const taxTypeLabel = poData.tax_type ? poData.tax_type.charAt(0).toUpperCase() + poData.tax_type.slice(1) : 'Goods'
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.tiny)
        doc.text(`Less: Withholding Tax (${taxBreakdown.taxRate}% - ${taxTypeLabel}) =`, totalBoxX + 2, rowY)
        doc.setFontSize(FONT_SIZES.body)
        doc.text(`(${formatPesoWithPrefix(taxBreakdown.withholdingTax)})`, totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })
        
        rowY += rowHeight
      } else {
        // Simple Total Amount - when tax is not applied
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.small)
        doc.text("TOTAL AMOUNT =", totalBoxX + 2, rowY)
        doc.setFontSize(FONT_SIZES.section)
        doc.text(formatPesoWithPrefix(taxBreakdown.totalBeforeWithholdingTax), totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })
        
        rowY += rowHeight
      }
      
      // Discount if applicable
      if (taxBreakdown.discountAmount > 0) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.tiny)
        const discountLabel = taxBreakdown.discountType === "percentage" 
          ? `Less: Discount (${taxBreakdown.discountPercentage}%) =` 
          : "Less: Discount (Fixed Amount) ="
        doc.text(discountLabel, totalBoxX + 2, rowY)
        doc.setFontSize(FONT_SIZES.body)
        doc.text(`(${formatPesoWithPrefix(taxBreakdown.discountAmount)})`, totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })
        
        rowY += rowHeight
      }
      
      // Divider before Grand Total
      doc.setLineWidth(LINE_WEIGHTS.divider)
      doc.line(totalBoxX + 1, rowY + 0.5, totalBoxX + totalBoxWidth - 1, rowY + 0.5)
      
      rowY += dividerSpace + 3  // Increased spacing after divider for better GRAND TOTAL padding
      
      // Grand Total - Enhanced styling for better prominence
      doc.setFont("helvetica", "bold")
      doc.setFontSize(FONT_SIZES.body)  // Increased from small to body for better visibility
      doc.text("GRAND TOTAL =", totalBoxX + 2, rowY)
      
      doc.setFontSize(FONT_SIZES.large)  // Increased from section to large for emphasis
      doc.text(formatPesoWithPrefix(taxBreakdown.grandTotal), totalBoxX + totalBoxWidth - 2, rowY, { align: "right" })

      yPos += totalBoxHeight + sectionSpacing
    }
    
    // ============================================================================
    // APPROVAL SECTION
    // ============================================================================

    if (pageIndex !== totalPages - 1) {
    continue
    }

    const sigSectionY = yPos
    const sigWidth = (pageWidth - margin - rightMargin - 4) / 3
    const sigBoxHeight = 22

    const preparedByList = Array.isArray(poData.prepared_by)
      ? poData.prepared_by.map((p) => String(p || '').trim()).filter(Boolean)
      : poData.prepared_by
        ? poData.prepared_by.split(',').map((p) => p.trim()).filter(Boolean)
        : []

    const preparedBy = Array.from(new Set(preparedByList)).join(' / ')

    const signatures = [
      { label: "PREPARED BY", name: preparedBy, x: margin + 1 },
      { label: "VERIFIED BY", name: poData.verified_by || "", x: margin + sigWidth + 2 },
      { label: "APPROVED BY", name: poData.approved_by || "", x: margin + 2 * sigWidth + 3 }
    ]

    signatures.forEach((sig) => {
      doc.setLineWidth(LINE_WEIGHTS.grid)
      doc.rect(sig.x, sigSectionY, sigWidth, sigBoxHeight)

      // Label
      doc.setFont("helvetica", "bold")
      doc.setFontSize(FONT_SIZES.tiny)
      doc.text(sig.label, sig.x + sigWidth / 2, sigSectionY + 3, { align: 'center' })

      const displayName = String(sig.name || '').trim()
      if (displayName) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FONT_SIZES.small)
        doc.text(displayName.toUpperCase(), sig.x + sigWidth / 2, sigSectionY + 7, { align: 'center' })
      }

      doc.setLineWidth(LINE_WEIGHTS.grid)
      doc.line(sig.x + 3, sigSectionY + 10, sig.x + sigWidth - 3, sigSectionY + 10)
    })

    yPos = sigSectionY + sigBoxHeight + sectionSpacing

    // ============================================================================
    // NOTES SECTION - DYNAMIC HEIGHT WITH PAGINATION
    // ============================================================================
    
    if (notesText || attachedImages.length > 0) {
      const footerY = pageHeight - margin - 5
      const maxAvailableHeight = footerY - yPos - 8
      
      if (maxAvailableHeight > 15) {
        // Calculate required content height
        const hasImages = attachedImages.length > 0
        const headerHeight = hasImages ? 10 : 7
        let requiredContentHeight = 0
        let textHeight = 0
        let imagesHeight = 0
        let notesLineCount = 0
        
        // Calculate text height
        if (notesText) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(FONT_SIZES.body)
          const lineHeight = 4
          const notesLines = doc.splitTextToSize(notesText, pageWidth - margin - rightMargin - 8)
          notesLineCount = notesLines.length
          textHeight = notesLines.length * lineHeight + 4
        }
        
        // Calculate images height
        const imageArray = attachedImages
        if (imageArray.length > 0) {
            const availableWidth = pageWidth - margin - rightMargin - 8
            const imageSpacing = 4
            const imagesPerRow = Math.min(imageArray.length, 2)
            const maxImageWidth = (availableWidth - (imageSpacing * (imagesPerRow - 1))) / imagesPerRow
            const maxImageHeight = 80
            
            let totalRows = Math.ceil(imageArray.length / imagesPerRow)
            let currentRowHeight = 0
            let calculatedHeight = 0
            
            imageArray.forEach((img, idx) => {
              try {
                const imgData = pickImageData(img)
                if (!imgData) throw new Error('Unsupported or invalid image data')
                const imgProps = doc.getImageProperties(imgData)
                const aspectRatio = imgProps.width / imgProps.height
                
                let finalWidth = maxImageWidth
                let finalHeight = finalWidth / aspectRatio
                
                if (finalHeight > maxImageHeight) {
                  finalHeight = maxImageHeight
                  finalWidth = finalHeight * aspectRatio
                }
                
                if (finalWidth > maxImageWidth) {
                  finalWidth = maxImageWidth
                  finalHeight = finalWidth / aspectRatio
                }
                
                currentRowHeight = Math.max(currentRowHeight, finalHeight)
                
                // If row is complete or last image, add to total height
                if ((idx + 1) % imagesPerRow === 0 || idx === imageArray.length - 1) {
                  calculatedHeight += currentRowHeight
                  if (idx < imageArray.length - 1) {
                    calculatedHeight += imageSpacing
                  }
                  currentRowHeight = 0
                }
              } catch (err) {
                console.warn("Error calculating image dimensions:", err)
              }
            })
            
            imagesHeight = calculatedHeight + 4
        }
        
        requiredContentHeight = textHeight + imagesHeight
        const basePadding = hasImages ? 6 : 3
        const totalRequiredHeight = headerHeight + requiredContentHeight + basePadding
        
        // Check if content fits on current page
        if (totalRequiredHeight <= maxAvailableHeight) {
          // Content fits - draw with exact height needed
        const minNotesBoxHeight = hasImages ? 20 : 10
        const notesBoxHeight = Math.max(totalRequiredHeight, minNotesBoxHeight)
          
          doc.setLineWidth(LINE_WEIGHTS.grid)
          doc.rect(margin + 1, yPos, pageWidth - margin - rightMargin - 2, notesBoxHeight)
          
          doc.setFont("helvetica", "bold")
          doc.setFontSize(FONT_SIZES.body)
          doc.text("NOTES:", margin + 4, yPos + 5)
          
          doc.setLineWidth(LINE_WEIGHTS.grid)
          doc.line(margin + 1, yPos + 6.5, pageWidth - rightMargin - 1, yPos + 6.5)
          
          let contentY = yPos + 10
          
          // Display text notes
          if (notesText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(FONT_SIZES.body)
            const lineHeight = 4
            const notesLines = doc.splitTextToSize(notesText, pageWidth - margin - rightMargin - 8)
            doc.text(notesLines, margin + 4, contentY)
            contentY += notesLines.length * lineHeight + 4
          }
          
          // Display images
          if (imageArray.length > 0) {
            const availableWidth = pageWidth - margin - rightMargin - 8
            const imageSpacing = 4
            const imagesPerRow = Math.min(imageArray.length, 2)
            const maxImageWidth = (availableWidth - (imageSpacing * (imagesPerRow - 1))) / imagesPerRow
            const maxImageHeight = 80
            
            let imgX = margin + 4
            let imgY = contentY
            let currentRowHeight = 0
            
            imageArray.forEach((img, idx) => {
              if (idx > 0 && idx % imagesPerRow === 0) {
                imgX = margin + 4
                imgY += currentRowHeight + imageSpacing
                currentRowHeight = 0
              }
              
              try {
                const imgData = pickImageData(img)
                if (!imgData) throw new Error('Unsupported or invalid image data')
                const format = imgData.includes('image/png') ? 'PNG' : 'JPEG'
                
                const imgProps = doc.getImageProperties(imgData)
                const aspectRatio = imgProps.width / imgProps.height
                
                let finalWidth = maxImageWidth
                let finalHeight = finalWidth / aspectRatio
                
                if (finalHeight > maxImageHeight) {
                  finalHeight = maxImageHeight
                  finalWidth = finalHeight * aspectRatio
                }
                
                if (finalWidth > maxImageWidth) {
                  finalWidth = maxImageWidth
                  finalHeight = finalWidth / aspectRatio
                }
                
                const xOffset = (maxImageWidth - finalWidth) / 2
                doc.addImage(imgData, format, imgX + xOffset, imgY, finalWidth, finalHeight)
                currentRowHeight = Math.max(currentRowHeight, finalHeight)
              } catch (err) {
                console.warn("Error adding image to PDF:", err)
              }
              
              if ((idx + 1) % imagesPerRow !== 0) {
                imgX += maxImageWidth + imageSpacing
              }
            })
          }
        } else if (!hasImages && notesText && notesLineCount <= 2 && maxAvailableHeight >= 8) {
        // Compact fallback keeps short notes on same page to save paper.
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FONT_SIZES.tiny)
        doc.text("NOTES:", margin + 2, yPos + 3)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(FONT_SIZES.tiny)
        const compactLines = doc
          .splitTextToSize(notesText, pageWidth - margin - rightMargin - 14)
          .slice(0, 2)
        doc.text(compactLines, margin + 13, yPos + 3)
        } else {
          // Content doesn't fit - need new page
          doc.addPage()
          drawPageFooter()
          
          // Start notes on new page
          yPos = margin
          const newPageMaxHeight = pageHeight - margin - 15 // Leave space for footer
          
          doc.setLineWidth(LINE_WEIGHTS.grid)
          doc.rect(margin + 1, yPos, pageWidth - margin - rightMargin - 2, newPageMaxHeight)
          
          doc.setFont("helvetica", "bold")
          doc.setFontSize(FONT_SIZES.body)
          doc.text("NOTES (CONTINUED):", margin + 4, yPos + 5)
          
          doc.setLineWidth(LINE_WEIGHTS.grid)
          doc.line(margin + 1, yPos + 6.5, pageWidth - rightMargin - 1, yPos + 6.5)
          
          let contentY = yPos + 10
          
          // Display text notes
          if (notesText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(FONT_SIZES.body)
            const lineHeight = 4
            const notesLines = doc.splitTextToSize(notesText, pageWidth - margin - rightMargin - 8)
            doc.text(notesLines, margin + 4, contentY)
            contentY += notesLines.length * lineHeight + 4
          }
          
          // Display images
          if (imageArray.length > 0) {
            const availableWidth = pageWidth - margin - rightMargin - 8
            const imageSpacing = 4
            const imagesPerRow = Math.min(imageArray.length, 2)
            const maxImageWidth = (availableWidth - (imageSpacing * (imagesPerRow - 1))) / imagesPerRow
            const maxImageHeight = 80
            
            let imgX = margin + 4
            let imgY = contentY
            let currentRowHeight = 0
            
            imageArray.forEach((img, idx) => {
              if (idx > 0 && idx % imagesPerRow === 0) {
                imgX = margin + 4
                imgY += currentRowHeight + imageSpacing
                currentRowHeight = 0
              }
              
              try {
                const imgData = pickImageData(img)
                if (!imgData) throw new Error('Unsupported or invalid image data')
                const format = imgData.includes('image/png') ? 'PNG' : 'JPEG'
                const imgProps = doc.getImageProperties(imgData)
                const aspectRatio = imgProps.width / imgProps.height
                
                let finalWidth = maxImageWidth
                let finalHeight = finalWidth / aspectRatio
                
                if (finalHeight > maxImageHeight) {
                  finalHeight = maxImageHeight
                  finalWidth = finalHeight * aspectRatio
                }
                
                if (finalWidth > maxImageWidth) {
                  finalWidth = maxImageWidth
                  finalHeight = finalWidth / aspectRatio
                }
                
                const xOffset = (maxImageWidth - finalWidth) / 2
                
                // Check if image fits on current page
                if (imgY + finalHeight > pageHeight - margin - 10) {
                  // Add footer to current page
                  drawPageFooter()
                  
                  // Add new page for remaining images
                  doc.addPage()
                  imgY = margin + 10
                  imgX = margin + 4
                  
                  // Draw header on new page
                  doc.setLineWidth(LINE_WEIGHTS.grid)
                  doc.rect(margin + 1, margin, pageWidth - margin - rightMargin - 2, pageHeight - margin - 15)
                  doc.setFont("helvetica", "bold")
                  doc.setFontSize(FONT_SIZES.body)
                  doc.text("NOTES (CONTINUED):", margin + 4, margin + 5)
                  doc.setLineWidth(LINE_WEIGHTS.grid)
                  doc.line(margin + 1, margin + 6.5, pageWidth - rightMargin - 1, margin + 6.5)
                }
                
                doc.addImage(imgData, format, imgX + xOffset, imgY, finalWidth, finalHeight)
                currentRowHeight = Math.max(currentRowHeight, finalHeight)
              } catch (err) {
                console.warn("Error adding image to PDF:", err)
              }
              
              if ((idx + 1) % imagesPerRow !== 0) {
                imgX += maxImageWidth + imageSpacing
              }
            })
          }
        }
      }
    }
  }

  const fileName = `PO_${poData.po_number || poData.id || 'PO'}_${poData.supplier_name || 'Supplier'}.pdf`
  doc.save(fileName)
}



