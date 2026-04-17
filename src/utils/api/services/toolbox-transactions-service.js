// ============================================================================
// services/toolbox-transactions-service.js
// Toolbox Transactions/Employee Logs API Service
// Handles transaction logs and employee activity tracking for Toolbox
// ============================================================================
import { BaseAPIService } from '../core/base-api.js'

export class ToolboxTransactionsService extends BaseAPIService {
  constructor() {
    super()
    this.endpoint = 'employee-logs'
  }

  // ========================================================================
  // CORE FUNCTIONS - Transactions Management
  // ========================================================================
  
  /**
   * Fetch transactions with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.username - Filter by username
   * @param {string} filters.date_from - Start date (YYYY-MM-DD)
   * @param {string} filters.date_to - End date (YYYY-MM-DD)
   * @param {string} filters.search - Search term
   * @param {number} filters.limit - Maximum number of results
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<Object>} Transaction response with data and pagination
   */
  async fetchTransactions(filters = {}) {
    try {
      const params = new URLSearchParams()
      
      if (filters.username) params.append('username', filters.username)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.search) params.append('search', filters.search)
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.offset) params.append('offset', filters.offset.toString())
      
      const queryString = params.toString()
      console.log(`[ToolboxTransactionsService] Fetching transactions with filters:`, filters)
      
      const response = await this.request(
        `/api/${this.endpoint}${queryString ? '?' + queryString : ''}`,
        { addSync: true }
      )
      
      if (!response.success && response.success !== undefined) {
        throw new Error(response.error || 'Failed to fetch transactions')
      }
      
      console.log(`[ToolboxTransactionsService] Successfully fetched ${response.data?.length || 0} transactions`)
      console.log(`[ToolboxTransactionsService] Pagination:`, {
        total: response.total,
        limit: response.limit,
        offset: response.offset
      })
      
      return {
        data: response.data || [],
        total: response.total || 0,
        limit: response.limit || 50,
        offset: response.offset || 0,
        filters: response.filters || {}
      }
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to fetch transactions:', error)
      throw error
    }
  }

  /**
   * Fetch transaction statistics
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Transaction statistics
   */
  async fetchTransactionStats(days = 30) {
    try {
      console.log(`[ToolboxTransactionsService] Fetching transaction stats for ${days} days`)
      
      const response = await this.request(
        `/api/${this.endpoint}/stats?days=${days}`,
        { addSync: true }
      )
      
      if (!response.success && response.success !== undefined) {
        throw new Error(response.error || 'Failed to fetch transaction stats')
      }
      
      console.log(`[ToolboxTransactionsService] Successfully fetched transaction stats`)
      
      return {
        period_days: response.period_days || days,
        total_logs: response.total_logs || 0,
        recent_logs: response.recent_logs || 0,
        active_users: response.active_users || 0,
        logs_by_day: response.logs_by_day || [],
        top_users: response.top_users || []
      }
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to fetch transaction stats:', error)
      throw error
    }
  }

  /**
   * Fetch transactions for a specific user
   * @param {string} username - Username to fetch transactions for
   * @param {Object} filters - Additional filters (date_from, date_to, limit, offset)
   * @returns {Promise<Object>} User transactions
   */
  async fetchUserTransactions(username, filters = {}) {
    try {
      if (!username) throw new Error('Username is required')
      
      const params = new URLSearchParams()
      
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.offset) params.append('offset', filters.offset.toString())
      
      const queryString = params.toString()
      console.log(`[ToolboxTransactionsService] Fetching transactions for user: ${username}`)
      
      const response = await this.request(
        `/api/${this.endpoint}/user/${encodeURIComponent(username)}${queryString ? '?' + queryString : ''}`,
        { addSync: true }
      )
      
      if (!response.success && response.success !== undefined) {
        throw new Error(response.error || 'Failed to fetch user transactions')
      }
      
      console.log(`[ToolboxTransactionsService] Successfully fetched ${response.data?.length || 0} transactions for ${username}`)
      
      return response
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to fetch user transactions:', error)
      throw error
    }
  }

  /**
   * Create a new transaction log
   * @param {Object} logData - Transaction log data
   * @param {string} logData.username - Employee username
   * @param {string} logData.details - Transaction details
   * @param {string} logData.purpose - Optional purpose/reason
   * @param {string} logData.id_number - Employee ID number
   * @param {string} logData.id_barcode - Employee barcode
   * @param {string} logData.item_no - Item numbers
   * @param {string} logData.log_date - Optional log date (YYYY-MM-DD)
   * @param {string} logData.log_time - Optional log time (HH:MM:SS)
   * @returns {Promise<Object>} Created log entry
   */
  async createTransactionLog(logData) {
    try {
      if (!logData.username) throw new Error('Username is required')
      if (!logData.details) throw new Error('Details are required')
      
      const payload = {
        username: logData.username,
        details: logData.details,
        purpose: logData.purpose || '',
        id_number: logData.id_number || '',
        id_barcode: logData.id_barcode || '',
        item_no: logData.item_no || '',
        log_date: logData.log_date || new Date().toISOString().split('T')[0],
        log_time: logData.log_time || new Date().toTimeString().split(' ')[0]
      }
      
      console.log(`[ToolboxTransactionsService] Creating transaction log for ${logData.username}`)
      
      const response = await this.request(
        `/api/${this.endpoint}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create transaction log')
      }
      
      console.log(`[ToolboxTransactionsService] Successfully created transaction log`)
      return response
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to create transaction log:', error)
      throw error
    }
  }

  /**
   * Create enhanced transaction log with full item details
   * @param {Object} data - Enhanced transaction data
   * @param {string} data.userId - Employee ID
   * @param {Array} data.items - Array of items with details
   * @param {string} data.username - Employee username
   * @param {number} data.totalItems - Total number of items
   * @param {string} data.timestamp - Transaction timestamp
   * @returns {Promise<Object>} Created log entry
   */
  async createEnhancedLog(data) {
    try {
      if (!data.userId) throw new Error('User ID is required')
      if (!data.items || !Array.isArray(data.items)) throw new Error('Items array is required')
      if (!data.username) throw new Error('Username is required')
      
      // Format item details for the log
      const itemDetails = data.items.map(item => 
        `${item.name || 'Unknown'} (${item.quantity || 1}x)`
      ).join(', ')
      
      const itemNumbers = data.items.map(item => item.id || '').filter(Boolean).join(',')
      
      const logData = {
        username: data.username,
        details: `Checkout: ${itemDetails}`,
        purpose: data.purpose || `Toolbox checkout - ${data.totalItems} items`,
        id_number: data.userId,
        id_barcode: data.idBarcode || '',
        item_no: itemNumbers,
        log_date: data.timestamp ? data.timestamp.split('T')[0] : undefined,
        log_time: data.timestamp ? data.timestamp.split('T')[1]?.split('.')[0] : undefined
      }
      
      return await this.createTransactionLog(logData)
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to create enhanced log:', error)
      throw error
    }
  }

  /**
   * Delete a transaction log
   * @param {number} logId - Log ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteTransactionLog(logId) {
    try {
      if (!logId) throw new Error('Log ID is required')
      
      console.log(`[ToolboxTransactionsService] Deleting transaction log ${logId}`)
      
      const response = await this.request(
        `/api/${this.endpoint}/${logId}`,
        { method: 'DELETE' }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete transaction log')
      }
      
      console.log(`[ToolboxTransactionsService] Successfully deleted transaction log ${logId}`)
      return response
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to delete transaction log:', error)
      throw error
    }
  }

  /**
   * Export transactions to CSV/Excel
   * @param {Object} filters - Same filters as fetchTransactions
   * @param {string} format - 'csv' or 'excel' (default: 'csv')
   * @returns {Promise<Blob>} File blob
   */
  async exportTransactions(filters = {}, format = 'csv') {
    try {
      const params = new URLSearchParams()
      
      if (filters.username) params.append('username', filters.username)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.search) params.append('search', filters.search)
      params.append('format', format)
      
      const queryString = params.toString()
      console.log(`[ToolboxTransactionsService] Exporting transactions as ${format}`)
      
      const response = await fetch(
        `${this.baseURL}/api/${this.endpoint}/export${queryString ? '?' + queryString : ''}`,
        {
          method: 'GET',
          headers: this.defaultHeaders
        }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to export transactions: ${response.status} ${response.statusText}`)
      }
      
      const blob = await response.blob()
      console.log(`[ToolboxTransactionsService] Successfully exported transactions`)
      
      return blob
    } catch (error) {
      console.error('[ToolboxTransactionsService] Failed to export transactions:', error)
      throw error
    }
  }
}
