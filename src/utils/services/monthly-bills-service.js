// ============================================================================
// services/monthly-bills-service.js
// Monthly Bills Management API Service
// Uses unified finance-payroll endpoint
// ============================================================================
import { BaseAPIService } from '../core/base-api.js'

export class MonthlyBillsService extends BaseAPIService {
  constructor() {
    super()
    this.endpoint = 'finance-payroll' // Unified endpoint
  }

  // ========================================================================
  // CORE FUNCTIONS - Monthly Bills Management
  // ========================================================================
  
  /**
   * Get all monthly bills with optional filters
   * @param {Object} filters - { year, status }
   * @returns {Promise<Array>} List of monthly bills
   */
  async getMonthlyBills(filters = {}) {
    try {
      const params = new URLSearchParams()
      if (filters.year) params.append('year', filters.year)
      if (filters.status) params.append('status', filters.status)
      
      const queryString = params.toString()
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills${queryString ? '?' + queryString : ''}`
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch monthly bills')
      }
      
      return response.bills || []
    } catch (error) {
      console.error('Error fetching monthly bills:', error)
      throw error
    }
  }

  /**
   * Create a new bill item
   * @param {number} billId - Monthly bill ID
   * @param {Object} itemData - Item details
   * @returns {Promise<Object>} Created item
   */
  async createBillItem(billId, itemData) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      if (!itemData.category) throw new Error('Category is required')
      if (!itemData.amount) throw new Error('Amount is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}/items`,
        {
          method: 'POST',
          body: JSON.stringify(itemData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create bill item')
      }
      
      return response
    } catch (error) {
      console.error('Error creating bill item:', error)
      throw error
    }
  }

  /**
   * Update an existing bill item
   * @param {number} billId - Monthly bill ID
   * @param {number} itemId - Bill item ID
   * @param {Object} itemData - Updated item details
   * @returns {Promise<Object>} Updated item
   */
  async updateBillItem(billId, itemId, itemData) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      if (!itemId) throw new Error('Item ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}/items/${itemId}`,
        {
          method: 'PUT',
          body: JSON.stringify(itemData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update bill item')
      }
      
      return response
    } catch (error) {
      console.error('Error updating bill item:', error)
      throw error
    }
  }

  /**
   * Delete a bill item
   * @param {number} billId - Monthly bill ID
   * @param {number} itemId - Bill item ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteBillItem(billId, itemId) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      if (!itemId) throw new Error('Item ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}/items/${itemId}`,
        {
          method: 'DELETE'
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete bill item')
      }
      
      return response.data
    } catch (error) {
      console.error('Error deleting bill item:', error)
      throw error
    }
  }

  /**
   * Mark a bill as paid
   * @param {number} billId - Monthly bill ID
   * @param {Object} paymentData - { payment_method, payment_date, paid_by }
   * @returns {Promise<Object>} Updated bill
   */
  async markAsPaid(billId, paymentData = {}) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      
      const updateData = {
        status: 'paid',
        payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
        payment_method: paymentData.payment_method || null,
        paid_by: paymentData.paid_by || null
      }
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to mark bill as paid')
      }
      
      return response
    } catch (error) {
      console.error('Error marking bill as paid:', error)
      throw error
    }
  }

  // ========================================================================
  // ADDITIONAL BILL OPERATIONS
  // ========================================================================
  
  /**
   * Create a new monthly bill
   * @param {Object} billData - { month, year, prepared_by, status }
   * @returns {Promise<Object>} Created bill
   */
  async createMonthlyBill(billData) {
    try {
      if (!billData.month) throw new Error('Month is required')
      if (!billData.year) throw new Error('Year is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills`,
        {
          method: 'POST',
          body: JSON.stringify(billData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create monthly bill')
      }
      
      return response
    } catch (error) {
      console.error('Error creating monthly bill:', error)
      throw error
    }
  }

/**
 * Get single monthly bill with items
 * @param {number} billId - Monthly bill ID
 * @returns {Promise<Object>} Bill details
 */
async getBill(billId) {
  try {
    if (!billId) throw new Error('Bill ID is required')
    
    console.log('[Service] Fetching bill ID:', billId);
    console.log('[Service] Using URL:', `/api/${this.endpoint}/monthly-bills/${billId}`);
    
    const response = await this.request(
      `/api/${this.endpoint}/monthly-bills/${billId}`
    )
    
    console.log('[Service] Raw response:', response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch bill')
    }
    
    // IMPORTANT: The response structure is { success: true, bill: {...} }
    // NOT { success: true, data: { bill: {...} } }
    const bill = response.bill;
    
    if (!bill) {
      console.error('[Service] No bill in response:', response);
      throw new Error('No bill data in response')
    }
    
    console.log('[Service] Extracted bill:', bill);
    console.log('[Service] Items count:', bill.items?.length || 0);
    
    return bill
  } catch (error) {
    console.error('[Service] Error fetching bill:', error);
    throw error
  }
}

/**
 * Get monthly bill audit timeline
 * @param {number} billId - Monthly bill ID
 * @returns {Promise<Array>} Timeline entries
 */
async getBillTimeline(billId) {
  try {
    if (!billId) throw new Error('Bill ID is required')

    const response = await this.request(
      `/api/${this.endpoint}/monthly-bills/${billId}/timeline`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch bill timeline')
    }

    return response.timeline || []
  } catch (error) {
    console.error('[Service] Error fetching bill timeline:', error)
    throw error
  }
}

/**
 * Get bill breakdown with items grouped by category
 * @param {number} billId - Monthly bill ID
 * @returns {Promise<Object>} Bill with items breakdown
 */
async getBillBreakdown(billId) {
  try {
    if (!billId) throw new Error('Bill ID is required')
    
    console.log('[Service] Fetching bill breakdown for ID:', billId);
    
    const response = await this.request(
      `/api/${this.endpoint}/monthly-bills/${billId}`
    )
    
    console.log('[Service] Breakdown raw response:', response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch bill breakdown')
    }
    
    // IMPORTANT: response.bill, not response.data.bill
    const bill = response.bill;
    
    if (!bill) {
      console.error('[Service] No bill in breakdown response:', response);
      throw new Error('No bill data in response')
    }
    
    console.log('[Service] Bill items:', bill.items);
    
    // Group items by category for breakdown
    const breakdown = {
      ...bill,
      categoryBreakdown: this._groupItemsByCategory(bill.items || []),
      totals: {
        electricity: parseFloat(bill.electricity_subtotal) || 0,
        water: parseFloat(bill.water_subtotal) || 0,
        communications: parseFloat(bill.communications_subtotal) || 0,
        rental: parseFloat(bill.rental_subtotal) || 0,
        payment_fees: parseFloat(bill.payment_fees_subtotal) || 0,
        other: parseFloat(bill.other_subtotal) || 0,
        net_total: parseFloat(bill.net_total) || 0
      }
    }
    
    console.log('[Service] Returning breakdown with', breakdown.items?.length, 'items');
    
    return breakdown
  } catch (error) {
    console.error('[Service] Error fetching bill breakdown:', error);
    throw error
  }
}

  /**
   * Get category summary for a bill
   * @param {number} billId - Monthly bill ID
   * @returns {Promise<Array>} Category summary
   */
  async getBillSummary(billId) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}/summary`
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch bill summary')
      }
      
      return response.summary || []
    } catch (error) {
      console.error('Error fetching bill summary:', error)
      throw error
    }
  }

  /**
   * Update monthly bill
   * @param {number} billId - Monthly bill ID
   * @param {Object} billData - Updated bill data
   * @returns {Promise<Object>} Updated bill
   */
  async updateBill(billId, billData) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}`,
        {
          method: 'PUT',
          body: JSON.stringify(billData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update bill')
      }
      
      return response
    } catch (error) {
      console.error('Error updating bill:', error)
      throw error
    }
  }

  /**
   * Delete monthly bill
   * @param {number} billId - Monthly bill ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteBill(billId) {
    try {
      if (!billId) throw new Error('Bill ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/monthly-bills/${billId}`,
        {
          method: 'DELETE'
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete bill')
      }
      
      return response
    } catch (error) {
      console.error('Error deleting bill:', error)
      throw error
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================
  
  /**
   * Group bill items by category
   * @private
   */
  _groupItemsByCategory(items) {
    const categories = {
      electricity: [],
      water: [],
      communications: [],
      payment_fees: [],
      other: []
    }
    
    items.forEach(item => {
      const category = item.category || 'other'
      if (categories[category]) {
        categories[category].push(item)
      } else {
        categories.other.push(item)
      }
    })
    
    return categories
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================
  
  /**
   * Format currency to Philippine Peso
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0)
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  /**
   * Format billing period
   */
  formatPeriod(startDate, endDate) {
    if (!startDate && !endDate) return '-'
    const start = startDate ? new Date(startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''
    const end = endDate ? new Date(endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''
    if (start && end) return `${start} - ${end}`
    return start || end
  }

  /**
   * Format month/year display
   */
  formatPeriodDisplay(month, year) {
    if (!month || !year) return '-'
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long'
    })
  }

  /**
   * Get current year
   */
  getCurrentYear() {
    return new Date().getFullYear()
  }

  /**
   * Get current month (1-12)
   */
  getCurrentMonth() {
    return new Date().getMonth() + 1
  }

  /**
   * Validate bill item data
   */
  validateBillItem(itemData) {
    const errors = []
    
    if (!itemData.category) {
      errors.push('Category is required')
    }
    
    if (!itemData.amount || itemData.amount <= 0) {
      errors.push('Amount must be greater than 0')
    }
    
    if (itemData.category && !['electricity', 'water', 'communications', 'payment_fees', 'other'].includes(itemData.category)) {
      errors.push('Invalid category')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate totals from items
   */
  calculateTotals(items) {
    const totals = {
      electricity: 0,
      water: 0,
      communications: 0,
      payment_fees: 0,
      other: 0,
      net_total: 0
    }
    
    items.forEach(item => {
      const amount = parseFloat(item.amount) || 0
      const category = item.category || 'other'
      
      if (totals.hasOwnProperty(category)) {
        totals[category] += amount
      } else {
        totals.other += amount
      }
      
      totals.net_total += amount
    })
    
    return totals
  }

  // ========================================================================
  // SERVICE PROVIDERS MANAGEMENT
  // ========================================================================
  
  /**
   * Get all service providers with optional filters
   * @param {Object} filters - { category, active_only }
   * @returns {Promise<Array>} List of providers
   */
  async getProviders(filters = {}) {
    try {
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.active_only !== undefined) params.append('active_only', filters.active_only)
      
      const queryString = params.toString()
      const endpoint = `/api/${this.endpoint}/providers${queryString ? '?' + queryString : ''}`
      console.log('[MonthlyBillsService] Fetching providers from:', endpoint)
      
      const response = await this.request(endpoint)
      
      console.log('[MonthlyBillsService] Providers response:', response)
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch providers')
      }
      
      // Response has providers at root level, not nested under data
      return response.providers || []
    } catch (error) {
      console.error('Error fetching providers:', error)
      throw error
    }
  }

  /**
   * Get single provider by ID
   * @param {number} providerId - Provider ID
   * @returns {Promise<Object>} Provider details
   */
  async getProvider(providerId) {
    try {
      if (!providerId) throw new Error('Provider ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/providers/${providerId}`
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch provider')
      }
      
      // Response has provider at root level, not nested under data
      return response.provider || {}
    } catch (error) {
      console.error('Error fetching provider:', error)
      throw error
    }
  }

  /**
   * Create a new provider
   * @param {Object} providerData - Provider details
   * @returns {Promise<Object>} Created provider
   */
  async createProvider(providerData) {
    try {
      if (!providerData.provider_name) throw new Error('Provider name is required')
      if (!providerData.category) throw new Error('Category is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/providers`,
        {
          method: 'POST',
          body: JSON.stringify(providerData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create provider')
      }
      
      return response
    } catch (error) {
      console.error('Error creating provider:', error)
      throw error
    }
  }

  /**
   * Update an existing provider
   * @param {number} providerId - Provider ID
   * @param {Object} providerData - Updated provider details
   * @returns {Promise<Object>} Update response
   */
  async updateProvider(providerId, providerData) {
    try {
      if (!providerId) throw new Error('Provider ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/providers/${providerId}`,
        {
          method: 'PUT',
          body: JSON.stringify(providerData)
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update provider')
      }
      
      return response
    } catch (error) {
      console.error('Error updating provider:', error)
      throw error
    }
  }

  /**
   * Delete a provider
   * @param {number} providerId - Provider ID
   * @returns {Promise<Object>} Delete response
   */
  async deleteProvider(providerId) {
    try {
      if (!providerId) throw new Error('Provider ID is required')
      
      const response = await this.request(
        `/api/${this.endpoint}/providers/${providerId}`,
        {
          method: 'DELETE'
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete provider')
      }
      
      return response
    } catch (error) {
      console.error('Error deleting provider:', error)
      throw error
    }
  }
}
