// ============================================================================
// services/payroll-service.js - COMPLETE VERSION WITH BULK DELETE
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"
import { getStoredToken } from "../../auth.js"

export class PayrollService extends BaseAPIService {
  /**
   * Get all payroll records with filtering and pagination
   * @param {Object} params - Query parameters
   * @returns {Promise} Payroll records with pagination
   */
async getPayrollRecords(params = {}) {
    try {
        const queryParams = new URLSearchParams({
            limit: params.limit || 50,
            offset: params.offset || 0,
            ...(params.period && { period: params.period }),
            ...(params.cutoff !== undefined && { cutoff: params.cutoff }),
            ...(params.employee_id && { employee_id: params.employee_id }),
            ...(params.department && { department: params.department }),
            ...(params.status && { status: params.status }),
            ...(params.to_approve !== undefined && { to_approve: params.to_approve }) // ✅ ADD THIS
        }).toString()

        return await this.request(`/api/hr-payroll?${queryParams}`, {
            method: 'GET'
        })
    } catch (error) {
        console.error('[PayrollService] Failed to fetch payroll records:', error)
        throw error
    }
}
  /**
   * Calculate payroll for a specific period and cutoff
   * @param {string} period - Period in format YYYY-MM
   * @param {number} employeeId - Optional specific employee ID
   * @param {number} cutoff - Cutoff (15 or 30)
   * @returns {Promise} Calculated payroll data
   */
  async calculatePayroll(period, employeeId = null, cutoff = 30) {
    try {
      const queryParams = new URLSearchParams({ 
        period,
        cutoff: cutoff.toString()
      })
      
      if (employeeId) {
        queryParams.append('employee_id', employeeId)
      }

      return await this.request(`/api/hr-payroll/calculate?${queryParams.toString()}`, {
        method: 'GET'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to calculate payroll:', error)
      throw error
    }
  }

  /**
   * Process payroll for a period (save to database)
   * @param {Object} data - Payroll processing data
   * @returns {Promise} Processing result
   */
  async processPayroll(data) {
    try {
      const { period, cutoff = 30, employee_ids } = data

      if (!period) {
        throw new Error('Period is required for payroll processing')
      }

      if (![15, 30].includes(cutoff)) {
        throw new Error('Cutoff must be either 15 or 30')
      }

      return await this.request('/api/hr-payroll/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          period,
          cutoff,
          ...(employee_ids && { employee_ids })
        })
      })
    } catch (error) {
      console.error('[PayrollService] Failed to process payroll:', error)
      throw error
    }
  }

  /**
   * Get payroll summary statistics
   * @param {string} period - Optional period filter
   * @param {number} cutoff - Optional cutoff filter (15 or 30)
   * @returns {Promise} Summary statistics
   */
  async getPayrollSummary(period = null, cutoff = null) {
    try {
      const params = new URLSearchParams()
      if (period) params.append('period', period)
      if (cutoff !== null) params.append('cutoff', cutoff.toString())
      
      const queryString = params.toString()
      return await this.request(`/api/hr-payroll/summary${queryString ? `?${queryString}` : ''}`, {
        method: 'GET'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to fetch payroll summary:', error)
      throw error
    }
  }

  /**
   * Get available payroll periods
   * @returns {Promise} List of periods with cutoffs
   */
  async getPayrollPeriods() {
    try {
      return await this.request('/api/hr-payroll/periods', {
        method: 'GET'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to fetch payroll periods:', error)
      throw error
    }
  }

  /**
   * Delete payroll record
   * @param {number} payrollId - Payroll record ID
   * @returns {Promise} Deletion confirmation
   */
  async deletePayrollRecord(payrollId) {
    try {
      if (!payrollId) {
        throw new Error('Payroll ID is required')
      }

      return await this.request(`/api/hr-payroll/${payrollId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to delete payroll record:', error)
      throw error
    }
  }

  /**
   * Bulk delete payroll records by period/cutoff or IDs
   * @param {Object} data - Deletion criteria { period, cutoff } or { ids: [] }
   * @returns {Promise} Deletion confirmation with count
   */
  async bulkDeletePayroll(data) {
    try {
      if (!data.period && !data.ids) {
        throw new Error('Either period or ids array is required for bulk deletion')
      }

      console.log('[PayrollService] Bulk deleting payroll records:', data)

      return await this.request('/api/hr-payroll/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    } catch (error) {
      console.error('[PayrollService] Failed to bulk delete payroll records:', error)
      throw error
    }
  }

  /**
   * Delete payroll records by period and cutoff (convenience method)
   * @param {string} period - Period in format YYYY-MM
   * @param {number} cutoff - Cutoff (15 or 30)
   * @returns {Promise} Deletion confirmation
   */
  async deletePayrollByPeriod(period, cutoff) {
    try {
      if (!period) {
        throw new Error('Period is required')
      }

      return await this.bulkDeletePayroll({ period, cutoff })
    } catch (error) {
      console.error('[PayrollService] Failed to delete payroll by period:', error)
      throw error
    }
  }

  // ============================================================================
  // PAYROLL SETTINGS METHODS
  // ============================================================================

  /**
   * Get all payroll settings for all employees
   * @returns {Promise} All employee payroll settings
   */
  async getPayrollSettings() {
    try {
      return await this.request('/api/hr-payroll/settings', {
        method: 'GET'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to fetch payroll settings:', error)
      throw error
    }
  }

  /**
   * Get payroll settings for a specific employee
   * @param {number} employeeId - Employee ID
   * @returns {Promise} Employee payroll settings
   */
  async getEmployeePayrollSettings(employeeId) {
    try {
      if (!employeeId) {
        throw new Error('Employee ID is required')
      }

      return await this.request(`/api/hr-payroll/settings/${employeeId}`, {
        method: 'GET'
      })
    } catch (error) {
      console.error('[PayrollService] Failed to fetch employee payroll settings:', error)
      throw error
    }
  }

  /**
   * Update payroll settings for an employee
   * @param {Object} settingsData - Settings data including employee_id
   * @returns {Promise} Updated settings confirmation
   */
  async updatePayrollSettings(settingsData) {
    try {
      if (!settingsData.employee_id) {
        throw new Error('Employee ID is required in settings data')
      }

      console.log('[PayrollService] Updating payroll settings:', settingsData)

      return await this.request('/api/hr-payroll/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      })
    } catch (error) {
      console.error('[PayrollService] Failed to update payroll settings:', error)
      throw error
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format currency for display
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0)
  }

  /**
   * Calculate net pay from gross pay and deductions
   * @param {number} grossPay - Gross pay amount
   * @param {number} totalDeductions - Total deductions
   * @returns {number} Net pay
   */
  calculateNetPay(grossPay, totalDeductions) {
    return Math.max(0, (grossPay || 0) - (totalDeductions || 0))
  }

  /**
   * Get deduction description based on cutoff
   * @param {number} cutoff - Cutoff (15 or 30)
   * @returns {string} Deduction description
   */
  getDeductionDescription(cutoff) {
    if (cutoff === 15) {
      return 'Pag-IBIG contribution (₱200)'
    } else {
      return 'SSS, PhilHealth contributions and withholding tax'
    }
  }

  /**
   * Get cutoff period label
   * @param {number} cutoff - Cutoff (15 or 30)
   * @returns {string} Cutoff period label
   */
  getCutoffLabel(cutoff) {
    return cutoff === 15 ? '30/31-14' : '15-29/30'
  }

  /**
 * Process payroll with custom date range and holiday detection
 * @param {Object} data - Payroll data with custom dates and holidays
 * @returns {Promise} Processing result
 */
async processPayrollWithCustomDates(data) {
  try {
    const { 
      period, 
      cutoff = 30, 
      employee_ids, 
      custom_dates,
      regular_holidays = [],
      special_holidays = []
    } = data

    if (!period) {
      throw new Error('Period is required for payroll processing')
    }

    if (![15, 30].includes(cutoff)) {
      throw new Error('Cutoff must be either 15 or 30')
    }

    if (!custom_dates || !Array.isArray(custom_dates) || custom_dates.length === 0) {
      throw new Error('Custom dates are required')
    }

    console.log('[PayrollService] Processing payroll with custom dates and holidays:', {
      period,
      cutoff,
      date_count: custom_dates.length,
      regular_holidays_count: regular_holidays.length,
      special_holidays_count: special_holidays.length,
      regular_holidays: regular_holidays,
      special_holidays: special_holidays
    })

    return await this.request('/api/hr-payroll/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        period,
        cutoff,
        custom_dates,
        regular_holidays,
        special_holidays,
        ...(employee_ids && { employee_ids })
      })
    })
  } catch (error) {
    console.error('[PayrollService] Failed to process payroll with custom dates:', error)
    throw error
  }
}

/**
 * Get holiday breakdown from date selection
 * @param {Array} selectedDates - Array of selected dates
 * @param {Array} regularHolidays - Array of regular holiday dates
 * @param {Array} specialHolidays - Array of special holiday dates
 * @returns {Object} Holiday statistics
 */
getHolidayBreakdown(selectedDates = [], regularHolidays = [], specialHolidays = []) {
  const totalDays = selectedDates.length
  const regularHolidayCount = regularHolidays.length
  const specialHolidayCount = specialHolidays.length
  const regularDaysCount = totalDays - regularHolidayCount - specialHolidayCount

  return {
    totalDays,
    regularDays: regularDaysCount,
    regularHolidays: regularHolidayCount,
    specialHolidays: specialHolidayCount,
    hasHolidays: regularHolidayCount > 0 || specialHolidayCount > 0,
    regularHolidayDates: [...regularHolidays],
    specialHolidayDates: [...specialHolidays]
  }
}

/**
 * Get holiday pay multiplier description
 * @param {string} type - Holiday type: 'regular', 'special', 'sunday', 'overtime'
 * @returns {Object} Description and multiplier
 */
getHolidayPayInfo(type) {
  const holidayInfo = {
    regular: {
      label: 'Regular Work Day',
      multiplier: 1.0,
      description: 'Standard hourly rate',
      emoji: '📅'
    },
    regular_holiday: {
      label: 'Regular Holiday',
      multiplier: 1.0,
      description: 'Same rate as regular hours (employee still gets paid for working)',
      emoji: '🎉'
    },
    special_holiday: {
      label: 'Special Non-Working Holiday',
      multiplier: 1.3,
      description: '30% premium pay',
      emoji: '🎊'
    },
    sunday: {
      label: 'Sunday Premium',
      multiplier: 1.3,
      description: '30% premium pay',
      emoji: '☀️'
    },
    overtime: {
      label: 'Overtime',
      multiplier: 1.25,
      description: '25% premium pay',
      emoji: '⏰'
    }
  }

  return holidayInfo[type] || holidayInfo.regular
}

/**
 * Approve payroll for a specific period and cutoff
 * @param {string} period - Period in format YYYY-MM
 * @param {number} cutoff - Cutoff (15 or 30)
 * @param {string} approvedBy - Name/ID of approver
 * @returns {Promise} Approval confirmation
 */
async approvePayroll(period, cutoff, approvedBy = null) {
  try {
    if (!period) {
      throw new Error('Period is required for payroll approval')
    }

    if (![15, 30].includes(cutoff)) {
      throw new Error('Cutoff must be either 15 or 30')
    }

    console.log('[PayrollService] Approving payroll:', {
      period,
      cutoff,
      approvedBy
    })

    return await this.request('/api/hr-payroll/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        period,
        cutoff,
        approved_by: approvedBy
      })
    })
  } catch (error) {
    console.error('[PayrollService] Failed to approve payroll:', error)
    throw error
  }
}

/**
 * Download all payslips as single Excel file
 */
async downloadBulkPayslips(period, cutoff) {
  try {
    if (!period) {
      throw new Error('Period is required for bulk payslip download')
    }

    if (![15, 30].includes(cutoff)) {
      throw new Error('Cutoff must be either 15 or 30')
    }

    console.log('[PayrollService] Downloading bulk payslips (Single Excel):', { period, cutoff })

    const queryParams = new URLSearchParams({ 
      period,
      cutoff: cutoff.toString()
    }).toString()

    const response = await fetch(`${this.baseURL}/api/hr-payroll/bulk-payslips?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download payslips')
    }

    const blob = await response.blob()
    const filename = `Payslips_${period}_Cutoff${cutoff}.xlsx`
    
    // Force download
    this.downloadBlobAsFile(blob, filename)
    
    return blob
  } catch (error) {
    console.error('[PayrollService] Failed to download bulk payslips:', error)
    throw error
  }
}

/**
 * Download batched payslips as Excel file
 * @param {string} period - Period in format YYYY-MM
 * @param {number} cutoff - Cutoff (15 or 30)
 * @param {number} batchSize - Number of employees per sheet (default: 10)
 * @returns {Promise<Blob>} Excel blob
 */
async downloadBatchedPayslips(period, cutoff, batchSize = 10) {
  try {
    if (!period) {
      throw new Error('Period is required for batched payslip download')
    }

    if (![15, 30].includes(cutoff)) {
      throw new Error('Cutoff must be either 15 or 30')
    }

    if (batchSize < 1 || batchSize > 50) {
      throw new Error('Batch size must be between 1 and 50')
    }

    console.log('[PayrollService] Downloading batched payslips (Excel):', { 
      period, 
      cutoff, 
      batchSize 
    })

    const queryParams = new URLSearchParams({ 
      period,
      cutoff: cutoff.toString(),
      batch_size: batchSize.toString()
    }).toString()

    const response = await fetch(`${this.baseURL}/api/hr-payroll/bulk-payslips?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download batched payslips')
    }

    const blob = await response.blob()
    
    // ✅ FIX: Generate filename with .xlsx extension and force download
    const filename = `Payslips_${period}_Cutoff${cutoff}_${batchSize}employees.xlsx`
    
    // Force download
    this.downloadBlobAsFile(blob, filename)
    
    return blob
  } catch (error) {
    console.error('[PayrollService] Failed to download batched payslips:', error)
    throw error
  }
}
/**
 * Download single payslip for an employee
 * @param {number} payrollId - Payroll record ID
 * @returns {Promise<Blob>} PDF blob
 */
async downloadPayslip(payrollId) {
  try {
    if (!payrollId) {
      throw new Error('Payroll ID is required')
    }

    console.log('[PayrollService] Downloading payslip for ID:', payrollId)

    const response = await fetch(`${this.baseURL}/api/hr-payroll/${payrollId}/payslip`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download payslip')
    }

    return await response.blob()
  } catch (error) {
    console.error('[PayrollService] Failed to download payslip:', error)
    throw error
  }
}

/**
 * Helper method to trigger browser download of blob
 * @param {Blob} blob - PDF blob
 * @param {string} filename - Filename for download
 */
downloadBlobAsFile(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Download payroll table as PDF (single cutoff)
 */
async downloadPayrollTablePDF(period, cutoff = null, department = null, status = 'all') {
  try {
    if (!period) {
      throw new Error('Period is required for table download')
    }

    console.log('[PayrollService] Downloading payroll table PDF:', { 
      period, cutoff, department, status 
    })

    const params = new URLSearchParams({ period })
    if (cutoff !== null) params.append('cutoff', cutoff.toString())
    if (department) params.append('department', department)
    if (status && status !== 'all') params.append('status', status)

    const response = await fetch(`${this.baseURL}/api/hr-payroll/table-pdf?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download table PDF')
    }

    return await response.blob()
  } catch (error) {
    console.error('[PayrollService] Failed to download table PDF:', error)
    throw error
  }
}

/**
 * Download whole month payroll table as PDF (15 + 30 combined)
 */
async downloadWholeMonthTablePDF(period, department = null, status = 'all') {
  try {
    if (!period) {
      throw new Error('Period is required for whole month download')
    }

    console.log('[PayrollService] Downloading whole month table PDF:', { 
      period, department, status 
    })

    const params = new URLSearchParams({ 
      period,
      whole_month: '1'
    })
    if (department) params.append('department', department)
    if (status && status !== 'all') params.append('status', status)

    const response = await fetch(`${this.baseURL}/api/hr-payroll/table-pdf?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download whole month PDF')
    }

    return await response.blob()
  } catch (error) {
    console.error('[PayrollService] Failed to download whole month PDF:', error)
    throw error
  }
}

/**
 * Download payroll table as Excel (single cutoff)
 */
async downloadPayrollTableExcel(period, cutoff = null, department = null, status = 'all') {
  try {
    if (!period) {
      throw new Error('Period is required for table download')
    }

    console.log('[PayrollService] Downloading payroll table Excel:', { 
      period, cutoff, department, status 
    })

    const params = new URLSearchParams({ period })
    if (cutoff !== null) params.append('cutoff', cutoff.toString())
    if (department) params.append('department', department)
    if (status && status !== 'all') params.append('status', status)

    const response = await fetch(`${this.baseURL}/api/hr-payroll/table-excel?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download table Excel')
    }

    return await response.blob()
  } catch (error) {
    console.error('[PayrollService] Failed to download table Excel:', error)
    throw error
  }
}

/**
 * Download whole month payroll table as Excel (15 + 30 combined)
 */
async downloadWholeMonthTableExcel(period, department = null, status = 'all') {
  try {
    if (!period) {
      throw new Error('Period is required for whole month download')
    }

    console.log('[PayrollService] Downloading whole month table Excel:', { 
      period, department, status 
    })

    const params = new URLSearchParams({ 
      period,
      whole_month: '1'
    })
    if (department) params.append('department', department)
    if (status && status !== 'all') params.append('status', status)

    const response = await fetch(`${this.baseURL}/api/hr-payroll/table-excel?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download whole month Excel')
    }

    return await response.blob()
  } catch (error) {
    console.error('[PayrollService] Failed to download whole month Excel:', error)
    throw error
  }
}

/**
 * Download batched payslips as ZIP file
 * @param {string} period - Period in format YYYY-MM
 * @param {number} cutoff - Cutoff (15 or 30)
 * @param {number} batchSize - Number of employees per PDF batch (default: 10)
 * @returns {Promise<Blob>} ZIP blob containing batch PDFs
 */
async downloadBatchedPayslips(period, cutoff, batchSize = 10) {
  try {
    if (!period) {
      throw new Error('Period is required for batched payslip download')
    }

    if (![15, 30].includes(cutoff)) {
      throw new Error('Cutoff must be either 15 or 30')
    }

    if (batchSize < 1 || batchSize > 50) {
      throw new Error('Batch size must be between 1 and 50')
    }

    console.log('[PayrollService] Downloading batched payslips as ZIP:', { 
      period, 
      cutoff, 
      batchSize 
    })

    const queryParams = new URLSearchParams({ 
      period,
      cutoff: cutoff.toString(),
      batch_size: batchSize.toString()
    }).toString()

    // Use raw fetch for blob response
    const response = await fetch(`${this.baseURL}/api/hr-payroll/bulk-payslips?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to download batched payslips')
    }

    const blob = await response.blob()
    
    // Verify it's a ZIP file
    if (blob.type !== 'application/zip' && !blob.type.includes('zip')) {
      console.warn('[PayrollService] Response is not a ZIP file:', blob.type)
    }

    return blob
  } catch (error) {
    console.error('[PayrollService] Failed to download batched payslips:', error)
    throw error
  }
}

/**
 * Download batched payslips and trigger browser download
 * @param {string} period - Period in format YYYY-MM
 * @param {number} cutoff - Cutoff (15 or 30)
 * @param {number} batchSize - Number of employees per sheet (default: 10)
 * @returns {Promise<void>}
 */
async downloadAndSaveBatchedPayslips(period, cutoff, batchSize = 10) {
  try {
    console.log('[PayrollService] Downloading and saving batched payslips (Excel)...')
    
    // ✅ Now this method just calls downloadBatchedPayslips which handles everything
    await this.downloadBatchedPayslips(period, cutoff, batchSize)
    
    console.log('[PayrollService] Batched payslips (Excel) downloaded successfully')
  } catch (error) {
    console.error('[PayrollService] Failed to download and save batched payslips:', error)
    throw error
  }
}

async getEmployeeLoans(employeeId) {
    try {
        return await this.request(`/api/hr-payroll/loans/${employeeId}`, {
            method: 'GET'
        });
    } catch (error) {
        console.error('[PayrollService] Failed to fetch employee loans:', error);
        throw error;
    }
}

async saveEmployeeLoan(loanData) {
    try {
        return await this.request('/api/hr-payroll/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loanData)
        });
    } catch (error) {
        console.error('[PayrollService] Failed to save employee loan:', error);
        throw error;
    }
}

async deleteEmployeeLoan(loanId) {
    try {
        return await this.request(`/api/hr-payroll/loans/${loanId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('[PayrollService] Failed to delete employee loan:', error);
        throw error;
    }
}
}