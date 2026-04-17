// ============================================================================
  // services/finance-service.js
  // Finance & Payroll API Service
  // ============================================================================
import { BaseAPIService } from '../core/base-api.js'
import { API_ENDPOINTS } from '../config/api-config.js'

export class FinanceService extends BaseAPIService {
  constructor() {
    super()
  }

  /**
   * Upload a proof document for finance records.
   * Returns uploaded metadata including reference URL that can be stored in proof_documents_json.
   */
  async uploadProofDocument(file, options = {}) {
    if (!file) {
      throw new Error('File is required')
    }

    const formData = new FormData()
    formData.append('document', file)

    if (options.module) {
      formData.append('module', String(options.module))
    }

    if (options.record_id !== undefined && options.record_id !== null) {
      formData.append('record_id', String(options.record_id))
    }

    return this.request(`/api/${API_ENDPOINTS.FINANCE}/proof-documents/upload`, {
      method: 'POST',
      headers: {},
      body: formData,
      addSync: false,
    })
  }

  // ========================================================================
  // DASHBOARD
  // ========================================================================

  /**
   * Get dashboard data shaped for FinancePayrollDepartment.jsx.
   *
   * The component calls:
   *   response.salesInvoices  → { total, totalAmount, totalVatableSales, totalVat, totalZeroRated, chart }
   *   response.expenses       → { total, monthly, count, chart }
   *   response.vouchers       → { total, approved, pending, rejected, totalAmount, chart }
   *   response.vales          → { total, pending, approved, ... }
   *   response.monthlyBills   → { total, paid, pending, totalAmount, paidAmount, pendingAmount }
   *
   * Strategy: call /dashboard/summary (single round-trip) then reshape.
   * Falls back to getFinanceDashboardAll() (parallel individual requests) if that fails.
   */
  async getDashboardData() {
    const currentYear  = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    let d = null

    // ── Primary: single aggregated endpoint ───────────────────────────────
    try {
      const res = await this.request(
        `/api/${API_ENDPOINTS.FINANCE}/dashboard/summary?year=${currentYear}&month=${currentMonth}`
      )
      d = res?.data ?? null
    } catch (e) {
      console.warn('[FinanceService] /dashboard/summary failed, using parallel fallback:', e?.message)
    }

    // ── Fallback: parallel individual requests ────────────────────────────
    if (!d) {
      try {
        const all = await this.getFinanceDashboardAll()
        // Normalise the parallel result into the same "d" shape so we only
        // need one reshape block below.
        const inv = all.invoiceSummary ?? {}
        const mb  = all.monthlyBills  ?? {}
        const cv  = all.voucherDashboard?.cashVouchers  ?? {}
        const chv = all.voucherDashboard?.checkVouchers ?? {}
        const pcv = all.voucherDashboard?.pettyCashVouchers ?? {}
        d = {
          invoices: {
            total:       inv.total        ?? 0,
            totalAmount: inv.totalAmount  ?? 0,
            vatableSales:inv.vatableSales ?? 0,
            vatAmount:   inv.vatAmount    ?? 0,
            zeroRated:   inv.zeroRated    ?? 0,
            monthlyTrend: inv.monthlyTrend ?? [],
          },
          monthlyBills: {
            total:         mb.bills?.length ?? 0,
            paid:          mb.bills?.filter(b => b.status === 'paid').length ?? 0,
            pending:       mb.bills?.filter(b => b.status !== 'paid').length ?? 0,
            totalAmount:   0,
            paidAmount:    0,
            pendingAmount: 0,
          },
          cashVouchers:      cv,
          checkVouchers:     chv,
          pettyCashVouchers: pcv,
          pettyCashBudget:   all.pettyCashBudget?.data ?? {},
        }
      } catch (fallbackErr) {
        console.error('[FinanceService] Both dashboard fetch strategies failed:', fallbackErr?.message)
        // Return safe empty shell so the component never crashes
        return {
          dashboardSummary: {},
          salesInvoices: { total:0, totalAmount:0, totalVatableSales:0, totalVat:0, totalZeroRated:0, chart:[] },
          expenses:      { total:0, monthly:0, count:0, chart:[] },
          vouchers:      { total:0, approved:0, pending:0, rejected:0, totalAmount:0, chart:[] },
          vales:         { total:0, pending:0, approved:0, active:0, fullyPaid:0, defaulted:0, totalAmount:0, totalOutstanding:0, activeBalance:0 },
          monthlyBills:  { total:0, paid:0, pending:0, totalAmount:0, paidAmount:0, pendingAmount:0 },
        }
      }
    }

    // ── Reshape "d" → the flat shape FinancePayrollDepartment.jsx expects ─
    const inv = d.invoices          ?? {}
    const mb  = d.monthlyBills      ?? {}
    const cv  = d.cashVouchers      ?? {}
    const chv = d.checkVouchers     ?? {}
    const pcv = d.pettyCashVouchers ?? {}
    const vales = d.vales           ?? {}

    // Combined voucher stats (cash + check)
    const voucherTotal    = (cv.total    ?? 0) + (chv.total    ?? 0)
    const voucherApproved = (cv.approved ?? 0) + (chv.approved ?? 0)
    const voucherPending  = (cv.pending  ?? 0) + (chv.pending  ?? 0)
    const voucherRejected = (cv.rejected ?? 0) + (chv.rejected ?? 0)
    const voucherAmount   = (cv.totalDr  ?? 0) + (chv.totalDr  ?? 0)

    return {
      dashboardSummary: d,
      salesInvoices: {
        total:             inv.total        ?? 0,
        totalAmount:       inv.totalAmount  ?? 0,
        totalVatableSales: inv.vatableSales ?? 0,
        totalVat:          inv.vatAmount    ?? 0,
        totalZeroRated:    inv.zeroRated    ?? 0,
        chart:             inv.monthlyTrend ?? [],
      },
      expenses: {
        total:   (pcv.totalExpenses ?? 0),
        monthly: (pcv.totalExpenses ?? 0),
        count:   (pcv.total ?? 0),
        chart:   [],
      },
      vouchers: {
        total:       voucherTotal,
        approved:    voucherApproved,
        pending:     voucherPending,
        rejected:    voucherRejected,
        totalAmount: voucherAmount,
        chart:       chv.monthlyTrend ?? [],
      },
      vales: {
        total:            vales.total ?? 0,
        pending:          vales.pending ?? 0,
        approved:         vales.approved ?? 0,
        active:           vales.active ?? 0,
        fullyPaid:        vales.fullyPaid ?? 0,
        defaulted:        vales.defaulted ?? 0,
        totalAmount:      vales.totalAmount ?? 0,
        totalOutstanding: vales.totalOutstanding ?? 0,
        activeBalance:    vales.activeBalance ?? 0,
      },
      monthlyBills: {
        total:         mb.total         ?? 0,
        paid:          mb.paid          ?? 0,
        pending:       mb.pending       ?? 0,
        totalAmount:   mb.totalAmount   ?? 0,
        paidAmount:    mb.paidAmount    ?? 0,
        pendingAmount: mb.pendingAmount ?? 0,
      },
    }
  }

  /**
   * Get the full aggregated Finance Dashboard dataset.
   * Fires all sub-requests in parallel and returns a single resolved object.
   * Safe to call — individual failures are swallowed and return empty defaults.
   *
   * @returns {Promise<{
   *   invoices:       { invoices: Array },
   *   invoiceSummary: { byQuarter: Array, byType: Array, topCustomers: Array },
   *   customers:      { customers: Array },
   *   monthlyBills:   { bills: Array },
   *   cashVouchers:   { vouchers: Array },
   *   checkVouchers:  { vouchers: Array },
   *   pettyCashVouchers: { vouchers: Array },
   *   pettyCashBudget:   { data: Object },
   *   voucherDashboard:  { cashVouchers, checkVouchers, pettyCashVouchers, trends }
   * }>}
   */
  async getFinanceDashboardAll() {
    const currentYear  = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const [
      invoicesRes,
      invoiceSummaryRes,
      customersRes,
      monthlyBillsRes,
      cashVouchersRes,
      checkVouchersRes,
      pettyCashVouchersRes,
      pettyCashBudgetRes,
      voucherDashboardRes
    ] = await Promise.allSettled([
      this.getInvoices(),
      this.getInvoiceSummary(),
      this.getCustomers(),
      this.getMonthlyBills({ year: currentYear }),
      this.getCashVouchers(),
      this.getCheckVouchers(),
      this.getPettyCashVouchers({ month: currentMonth, year: currentYear }),
      this.getPettyCashBudget(),
      this.getVoucherDashboard()
    ])

    const safe = (result, fallback = {}) =>
      result.status === 'fulfilled' ? (result.value ?? fallback) : fallback

    return {
      invoices:          safe(invoicesRes,          { invoices: [] }),
      invoiceSummary:    safe(invoiceSummaryRes,    { byQuarter: [], byType: [], topCustomers: [] }),
      customers:         safe(customersRes,         { customers: [] }),
      monthlyBills:      safe(monthlyBillsRes,      { bills: [] }),
      cashVouchers:      safe(cashVouchersRes,      { vouchers: [] }),
      checkVouchers:     safe(checkVouchersRes,     { vouchers: [] }),
      pettyCashVouchers: safe(pettyCashVouchersRes, { vouchers: [] }),
      pettyCashBudget:   safe(pettyCashBudgetRes,   { data: {} }),
      voucherDashboard:  safe(voucherDashboardRes,  {
        cashVouchers: {}, checkVouchers: {}, pettyCashVouchers: {}, trends: []
      })
    }
  }
    // ========================================================================
    // CUSTOMERS
    // ========================================================================
    
    /**
     * Get all customers
     */
    async getCustomers() {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/customers`)
    }

    /**
     * Get a specific customer by ID
     */
    async getCustomer(customerId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/customers/${customerId}`)
    }

    /**
     * Create a new customer
     */
    async createCustomer(customerData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/customers`, {
        method: 'POST',
        body: JSON.stringify(customerData)
      })
    }

    /**
     * Update a customer
     */
    async updateCustomer(customerId, customerData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(customerData)
      })
    }

    /**
     * Delete a customer
     */
    async deleteCustomer(customerId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/customers/${customerId}`, {
        method: 'DELETE'
      })
    }

    // ========================================================================
    // SALES INVOICES
    // ========================================================================
    
    /**
     * Get all invoices
     */
    async getInvoices(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get a specific invoice by ID
     */
    async getInvoice(invoiceId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices/${invoiceId}`)
    }

    /**
     * Create a new invoice
     */
    async createInvoice(invoiceData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices`, {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      })
    }

    /**
     * Update an invoice
     */
    async updateInvoice(invoiceId, invoiceData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(invoiceData)
      })
    }

    /**
     * Delete an invoice
     */
    async deleteInvoice(invoiceId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices/${invoiceId}`, {
        method: 'DELETE'
      })
    }

    /**
     * Get invoice summary/analytics
     */
    async getInvoiceSummary(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices/summary${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Export invoices to CSV
     * @returns {string} URL to trigger CSV download
     */
    getExportInvoicesCsvUrl() {
      return `${this.baseURL}/api/${API_ENDPOINTS.FINANCE}/invoices/export/csv`
    }

    /**
     * Export invoice template
     * @returns {string} URL to download template
     */
    getExportInvoiceTemplateUrl() {
      return `${this.baseURL}/api/${API_ENDPOINTS.FINANCE}/invoices/export/template`
    }

    /**
     * Trigger CSV export download in browser
     */
    async exportAndDownloadInvoicesCsv() {
      try {
        const url = this.getExportInvoicesCsvUrl()
        const link = document.createElement('a')
        link.href = url
        link.download = `sales_invoices_export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (error) {
        console.error('Error downloading invoice export:', error)
        throw error
      }
    }

    /**
     * Trigger template download in browser
     */
    async downloadInvoiceTemplate() {
      try {
        const url = this.getExportInvoiceTemplateUrl()
        const link = document.createElement('a')
        link.href = url
        link.download = `sales_invoice_template_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (error) {
        console.error('Error downloading template:', error)
        throw error
      }
    }

    /**
     * Bulk import invoices
     * @param {Array} invoices - Array of invoice objects to import
     * @param {string} mode - Import mode: 'add', 'update', or 'replace'
     * @param {number} createdBy - User ID of who is importing
     */
    async importInvoices(invoices, mode = 'add', createdBy = null) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/invoices/import`, {
        method: 'POST',
        body: JSON.stringify({
          invoices,
          mode,
          created_by: createdBy
        })
      })
    }

// ========================================================================
// EXPENSES
// ========================================================================

/**
 * Get all expenses
 */
async getExpenses(params = {}) {
  const queryString = new URLSearchParams(params).toString()
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses${queryString ? '?' + queryString : ''}`)
}

/**
 * Get aggregated expense line items from Check and Petty Cash vouchers
 * @param {Object} params - Query parameters
 * @param {number|string} params.month - Month (1-12 or 'all')
 * @param {number|string} params.year - Year (e.g., 2024 or 'all')
 * @returns {Promise<Object>} Response containing line_items array and summary object
 * @example
 * const result = await financeService.getExpenseLineItems({ 
 *   month: 11, 
 *   year: 2024 
 * });
 * // Returns: { line_items: [...], summary: {...} }
 */
async getExpenseLineItems(params = {}) {
  const queryString = new URLSearchParams(params).toString()
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses/line-items${queryString ? '?' + queryString : ''}`)
}

/**
 * Get expense audit timeline by record ID
 */
async getExpenseTimeline(expenseId) {
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses/${expenseId}/timeline`)
}

/**
 * Create a new expense
 */
async createExpense(expenseData) {
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses`, {
    method: 'POST',
    body: JSON.stringify(expenseData)
  })
}

/**
 * Update an expense
 */
async updateExpense(expenseId, expenseData) {
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(expenseData)
  })
}

/**
 * Delete an expense
 */
async deleteExpense(expenseId) {
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses/${expenseId}`, {
    method: 'DELETE'
  })
}

/**
 * Bulk create expenses
 * @param {Array} expenses
 */
async createExpensesBulk(expenses) {
  return this.request(`/api/${API_ENDPOINTS.FINANCE}/expenses/bulk`, {
    method: 'POST',
    body: JSON.stringify({ expenses })
  })
}

    // ========================================================================
    // VOUCHERS - Cash, Check, and Petty Cash
    // ========================================================================

    // ---------------- CASH VOUCHERS ----------------
    
    /**
     * Get all cash vouchers
     */
    async getCashVouchers(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get single cash voucher with line items
     */
    async getCashVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}`)
    }

    /**
     * Get cash voucher audit timeline
     */
    async getCashVoucherTimeline(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}/timeline`)
    }

    /**
     * Create new cash voucher
     */
    async createCashVoucher(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    /**
     * Update cash voucher
     */
    async updateCashVoucher(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    /**
     * Delete cash voucher
     */
    async deleteCashVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}`, {
        method: 'DELETE'
      })
    }

    /**
     * Approve cash voucher
     */
    async approveCashVoucher(id, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { approved_by: approvedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    /**
     * Cancel cash voucher
     */
    async cancelCashVoucher(id, reasonOrPayload, cancelledBy = null) {
      const payload = typeof reasonOrPayload === 'object'
        ? reasonOrPayload
        : { reason: reasonOrPayload, cancelled_by: cancelledBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    // ---------------- CHECK VOUCHERS ----------------
    
    /**
     * Get all check vouchers
     */
    async getCheckVouchers(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Backwards-compatible wrapper used by UI to fetch vouchers by type
     * Accepts 'cash' | 'check' | 'petty_cash' | 'all'
     */
    async getVouchers(voucherType = 'cash', params = {}) {
      switch (voucherType) {
        case 'cash':
          return this.getCashVouchers(params)
        case 'check':
          return this.getCheckVouchers(params)
        case 'petty_cash':
          return this.getPettyCashVouchers(params)
        case 'all':
          return this.getAllVouchers('all', params)
        default:
          throw new Error(`Invalid voucher type: ${voucherType}`)
      }
    }

    /**
     * Get single check voucher with line items
     */
    async getCheckVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}`)
    }

    /**
     * Get check voucher audit timeline
     */
    async getCheckVoucherTimeline(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}/timeline`)
    }

    /**
     * Create new check voucher
     */
    async createCheckVoucher(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    /**
     * Update check voucher
     */
    async updateCheckVoucher(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    /**
     * Delete check voucher
     */
    async deleteCheckVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}`, {
        method: 'DELETE'
      })
    }

    /**
     * Get next cash voucher number
     */
    async getNextCashVoucherNumber() {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-vouchers/next-number`)
    }

    /**
     * Get next check voucher number
     */
    async getNextCheckVoucherNumber() {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/next-number`)
    }

    /**
     * Bulk create check vouchers
     */
    async createCheckVouchersBulk(vouchers) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/bulk`, {
        method: 'POST',
        body: JSON.stringify({ vouchers })
      })
    }

    /**
     * Approve check voucher
     */
    async approveCheckVoucher(id, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { approved_by: approvedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    /**
     * Cancel check voucher
     */
    async cancelCheckVoucher(id, reasonOrPayload, cancelledBy = null) {
      const payload = typeof reasonOrPayload === 'object'
        ? reasonOrPayload
        : { reason: reasonOrPayload, cancelled_by: cancelledBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/check-vouchers/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    // ---------------- PETTY CASH VOUCHERS ----------------
    
    /**
     * Get all petty cash vouchers
     */
    async getPettyCashVouchers(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get single petty cash voucher with line items
     */
    async getPettyCashVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}`)
    }

    /**
     * Get petty cash voucher audit timeline
     */
    async getPettyCashVoucherTimeline(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}/timeline`)
    }

    /**
     * Create new petty cash voucher
     */
    async createPettyCashVoucher(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    /**
     * Update petty cash voucher
     */
    async updatePettyCashVoucher(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    /**
     * Delete petty cash voucher
     */
    async deletePettyCashVoucher(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}`, {
        method: 'DELETE'
      })
    }

    /**
     * Approve petty cash voucher
     */
    async approvePettyCashVoucher(id, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { approved_by: approvedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    /**
     * Cancel petty cash voucher
     */
    async cancelPettyCashVoucher(id, reasonOrPayload, cancelledBy = null) {
      const payload = typeof reasonOrPayload === 'object'
        ? reasonOrPayload
        : { reason: reasonOrPayload, cancelled_by: cancelledBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-vouchers/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    /**
     * Get petty cash budget information
     */
    async getPettyCashBudget() {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-budget`)
    }

    /**
     * Replenish petty cash budget
     */
    async replenishPettyCash(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/petty-cash-budget`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    // ---------------- CHART OF ACCOUNTS ----------------
    
    /**
     * Get all accounts from chart of accounts
     */
    async getChartOfAccounts(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/chart-of-accounts${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get single account
     */
    async getAccount(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/chart-of-accounts/${id}`)
    }

    /**
     * Create new account
     */
    async createAccount(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/chart-of-accounts`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    /**
     * Update account
     */
    async updateAccount(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/chart-of-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    /**
     * Delete account
     */
    async deleteAccount(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/chart-of-accounts/${id}`, {
        method: 'DELETE'
      })
    }

    // ---------------- VOUCHER LINE ITEMS ----------------
    
    /**
     * Get line items for a voucher
     */
    async getVoucherLineItems(voucherType, voucherId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/${voucherId}/line-items`)
    }

    /**
     * Create line item
     */
    async createLineItem(voucherType, voucherId, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/${voucherId}/line-items`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    /**
     * Update line item
     */
    async updateLineItem(voucherType, voucherId, lineItemId, data) {
      return this.request(
        `/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/${voucherId}/line-items/${lineItemId}`,
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      )
    }

    /**
     * Delete line item
     */
    async deleteLineItem(voucherType, voucherId, lineItemId) {
      return this.request(
        `/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/${voucherId}/line-items/${lineItemId}`,
        {
          method: 'DELETE'
        }
      )
    }

    // ---------------- BULK OPERATIONS ----------------
    
    /**
     * Bulk approve vouchers
     */
    async bulkApproveVouchers(voucherType, voucherIds, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { approved_by: approvedBy, actor_id: approvedBy }

      return this.request(`/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/bulk-approve`, {
        method: 'POST',
        body: JSON.stringify({
          voucher_ids: voucherIds,
          ...payload
        })
      })
    }

    /**
     * Bulk delete vouchers
     */
    async bulkDeleteVouchers(voucherType, voucherIds) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ voucher_ids: voucherIds })
      })
    }

    // ---------------- REPORTS & EXPORTS ----------------
    
    /**
     * Export vouchers to CSV
     */
    async exportVouchers(voucherType, params = {}) {
      const queryString = new URLSearchParams(params).toString()
      const url = `/api/${API_ENDPOINTS.FINANCE}/${voucherType}-vouchers/export/csv${
        queryString ? `?${queryString}` : ""
      }`
      window.open(url, "_blank")
    }

    /**
     * Search vouchers across all types
     */
    async searchVouchers(searchTerm, params = {}) {
      const queryString = new URLSearchParams({ q: searchTerm, ...params }).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vouchers/search${queryString ? `?${queryString}` : ''}`)
    }

    /**
     * Get voucher dashboard statistics
     */
    async getVoucherDashboard(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vouchers/dashboard${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get account expenses summary
     */
    async getAccountExpensesSummary(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vouchers/expenses-summary${queryString ? '?' + queryString : ''}`)
    }

    // ---------------- UTILITY METHOD ----------------
    
    /**
     * Get all vouchers of a specific type
     * Helper method that routes to the correct method
     */
    async getAllVouchers(voucherType, params = {}) {
      switch (voucherType) {
        case "cash":
          return this.getCashVouchers(params)
        case "check":
          return this.getCheckVouchers(params)
        case "petty_cash":
          return this.getPettyCashVouchers(params)
        case "all":
          // Get all types and merge
          const [cash, check, pettyCash] = await Promise.all([
            this.getCashVouchers(params),
            this.getCheckVouchers(params),
            this.getPettyCashVouchers(params)
          ])
          return {
            vouchers: [
              ...(cash.vouchers || []).map(v => ({ ...v, voucher_type: "cash" })),
              ...(check.vouchers || []).map(v => ({
                ...v,
                voucher_type: "check"
              })),
              ...(pettyCash.vouchers || []).map(v => ({
                ...v,
                voucher_type: "petty_cash"
              }))
            ]
          }
        default:
          throw new Error(`Invalid voucher type: ${voucherType}`)
      }
    }

    // ========================================================================
    // VALES (Employee Cash Advances / Salary Loans)
    // ========================================================================
    
    /**
     * Get all vales
     */
    async getVales(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get a single vale with payment history
     */
    async getVale(valeId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales/${valeId}`)
    }

    /**
     * Get vale audit timeline
     */
    async getValeTimeline(valeId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales/${valeId}/timeline`)
    }

    /**
     * Create a new vale
     */
    async createVale(valeData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales`, {
        method: 'POST',
        body: JSON.stringify(valeData)
      })
    }

    /**
     * Update a vale
     */
    async updateVale(valeId, valeData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales/${valeId}`, {
        method: 'PUT',
        body: JSON.stringify(valeData)
      })
    }

    /**
     * Delete a vale
     */
    async deleteVale(valeId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales/${valeId}`, {
        method: 'DELETE'
      })
    }

    /**
     * Record a vale payment
     */
    async recordValePayment(valeId, paymentData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/vales/${valeId}/payment`, {
        method: 'POST',
        body: JSON.stringify(paymentData)
      })
    }

    // ========================================================================
    // MONTHLY BILLS
    // ========================================================================
    
    /**
     * Get all monthly bills
     */
    async getMonthlyBills(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get monthly bill audit timeline
     */
    async getMonthlyBillTimeline(billId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills/${billId}/timeline`)
    }

    /**
     * Create a new monthly bill
     */
    async createMonthlyBill(billData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills`, {
        method: 'POST',
        body: JSON.stringify(billData)
      })
    }

    /**
     * Update a monthly bill
     */
    async updateMonthlyBill(billId, billData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills/${billId}`, {
        method: 'PUT',
        body: JSON.stringify(billData)
      })
    }

    /**
     * Delete a monthly bill
     */
    async deleteMonthlyBill(billId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills/${billId}`, {
        method: 'DELETE'
      })
    }

    /**
     * Mark a bill as paid
     */
    async markBillAsPaid(billId, paymentData) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/monthly-bills/${billId}/pay`, {
        method: 'POST',
        body: JSON.stringify(paymentData)
      })
    }

    // ========================================================================
    // PAYROLL CHECKING
    // ========================================================================

    async getPayrollCheckingRecords(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking${queryString ? '?' + queryString : ''}`)
    }

    async getPayrollCheckingRecord(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}`)
    }

    /**
     * Get payroll checking audit timeline
     */
    async getPayrollCheckingTimeline(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/timeline`)
    }

    async createPayrollCheckingRecord(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    async updatePayrollCheckingRecord(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    async deletePayrollCheckingRecord(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}`, {
        method: 'DELETE'
      })
    }

    async lockPayrollCheckingRecord(id, actorId) {
      const payload = typeof actorId === 'object'
        ? actorId
        : { actor_id: actorId }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/lock`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async approvePayrollCheckingRecord(id, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { approved_by: approvedBy, actor_id: approvedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async revertPayrollCheckingToDraft(id, revertedBy) {
      const payload = typeof revertedBy === 'object'
        ? revertedBy
        : { reverted_by: revertedBy, actor_id: revertedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/revert-to-draft`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async getPayrollCheckingLineItems(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/line-items`)
    }

    async createPayrollCheckingLineItem(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/line-items`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    async updatePayrollCheckingLineItem(id, lineItemId, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    async deletePayrollCheckingLineItem(id, lineItemId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/payroll-checking/${id}/line-items/${lineItemId}`, {
        method: 'DELETE'
      })
    }

    // ========================================================================
    // CASH REQUEST
    // ========================================================================

    async getCashRequests(params = {}) {
      const queryString = new URLSearchParams(params).toString()
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request${queryString ? '?' + queryString : ''}`)
    }

    async getCashRequest(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}`)
    }

    async createCashRequest(data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    async updateCashRequest(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    async deleteCashRequest(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}`, {
        method: 'DELETE'
      })
    }

    async submitCashRequest(id, actorId) {
      const payload = typeof actorId === 'object'
        ? actorId
        : { actor_id: actorId, submitted_by: actorId }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async approveCashRequest(id, approvedBy) {
      const payload = typeof approvedBy === 'object'
        ? approvedBy
        : { actor_id: approvedBy, approved_by: approvedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async releaseCashRequest(id, releasedBy) {
      const payload = typeof releasedBy === 'object'
        ? releasedBy
        : { actor_id: releasedBy, released_by: releasedBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/release`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async cancelCashRequest(id, reasonOrPayload, cancelledBy = null) {
      const payload = typeof reasonOrPayload === 'object'
        ? reasonOrPayload
        : { reason: reasonOrPayload, actor_id: cancelledBy, cancelled_by: cancelledBy }
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    async getCashRequestLineItems(id) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/line-items`)
    }

    async createCashRequestLineItem(id, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/line-items`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }

    async updateCashRequestLineItem(id, lineItemId, data) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }

    async deleteCashRequestLineItem(id, lineItemId) {
      return this.request(`/api/${API_ENDPOINTS.FINANCE}/cash-request/${id}/line-items/${lineItemId}`, {
        method: 'DELETE'
      })
    }
  }