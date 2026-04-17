// ============================================================================
// services/toolbox-employees-service.js
// Toolbox Employees API Service
// Handles employee data operations for Toolbox
// Note: This is separate from the main employee-service.js to handle Toolbox-specific needs
// ============================================================================
import { BaseAPIService } from '../core/base-api.js'

export class ToolboxEmployeesService extends BaseAPIService {
  constructor() {
    super()
    this.endpoint = 'employees'
  }

  // ========================================================================
  // CORE FUNCTIONS - Employees Management
  // ========================================================================
  
  /**
   * Fetch all employees from the API
   * @param {Object} options - Fetch options
   * @param {boolean} options.includeAllStatuses - Include all statuses (Active, Inactive, On Leave, etc.)
   * @returns {Promise<Array>} List of employees
   */
  async fetchEmployees(options = { includeAllStatuses: true }) {
    try {
      const params = new URLSearchParams()
      
      if (options.includeAllStatuses) {
        params.append('includeAllStatuses', 'true')
      }
      
      const queryString = params.toString()
      console.log(`[ToolboxEmployeesService] Fetching employees${options.includeAllStatuses ? ' (all statuses)' : ''}`)
      
      const response = await this.request(
        `/api/${this.endpoint}${queryString ? '?' + queryString : ''}`,
        { addSync: true }
      )
      
      // Handle different response structures
      let employees = []
      
      if (response && typeof response === 'object') {
        if (response.success && response.employees && Array.isArray(response.employees)) {
          // Structure: {success: true, employees: [...]}
          employees = response.employees
        } else if (response.success && response.data && response.data.employees && Array.isArray(response.data.employees)) {
          // Nested structure: {success: true, data: {employees: [...], ...}}
          employees = response.data.employees
        } else if (response.success && Array.isArray(response.data)) {
          // Flat structure: {success: true, data: [...]}
          employees = response.data
        } else if (Array.isArray(response)) {
          // Direct array: [...]
          employees = response
        } else {
          console.warn(`[ToolboxEmployeesService] Unexpected API response structure:`, Object.keys(response))
          if (response.data && typeof response.data === 'object') {
            console.warn(`[ToolboxEmployeesService] data structure:`, Object.keys(response.data))
          }
          throw new Error('Invalid employees response structure')
        }
      } else {
        throw new Error('Invalid API response format')
      }
      
      console.log(`[ToolboxEmployeesService] Successfully fetched ${employees.length} employees`)
      
      return employees
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to fetch employees:', error)
      throw error
    }
  }

  /**
   * Find employee by ID number (for barcode/ID scanning)
   * @param {string} idNumber - Employee ID number
   * @returns {Promise<Object|null>} Employee data or null if not found
   */
  async findEmployeeByIdNumber(idNumber) {
    try {
      if (!idNumber) throw new Error('ID number is required')
      
      console.log(`[ToolboxEmployeesService] Looking up employee by ID: ${idNumber}`)
      
      const response = await this.request(
        `/api/${this.endpoint}/lookup/${encodeURIComponent(idNumber)}`,
        { addSync: true, suppressErrors: true }
      )
      
      if (!response.success) {
        return null
      }
      
      const employee = response.employee || response.data
      
      if (employee) {
        console.log(`[ToolboxEmployeesService] Found employee: ${employee.fullName || employee.firstName}`)
      } else {
        console.log(`[ToolboxEmployeesService] No employee found with ID: ${idNumber}`)
      }
      
      return employee
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to find employee by ID:', error)
      return null
    }
  }

  /**
   * Find employee by barcode
   * @param {string} barcode - Employee barcode
   * @returns {Promise<Object|null>} Employee data or null if not found
   */
  async findEmployeeByBarcode(barcode) {
    try {
      if (!barcode) throw new Error('Barcode is required')
      
      console.log(`[ToolboxEmployeesService] Looking up employee by barcode`)
      
      const response = await this.request(
        `/api/${this.endpoint}/barcode/${encodeURIComponent(barcode)}`,
        { addSync: true, suppressErrors: true }
      )
      
      if (!response.success) {
        return null
      }
      
      const employee = response.employee || response.data
      
      if (employee) {
        console.log(`[ToolboxEmployeesService] Found employee: ${employee.fullName || employee.firstName}`)
      } else {
        console.log(`[ToolboxEmployeesService] No employee found with barcode`)
      }
      
      return employee
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to find employee by barcode:', error)
      return null
    }
  }

  /**
   * Get employee by ID
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Object>} Employee data
   */
  async getEmployee(employeeId) {
    try {
      if (!employeeId) throw new Error('Employee ID is required')
      
      console.log(`[ToolboxEmployeesService] Fetching employee ${employeeId}`)
      
      const response = await this.request(
        `/api/${this.endpoint}/${employeeId}`,
        { addSync: true }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch employee')
      }
      
      const employee = response.employee || response.data
      console.log(`[ToolboxEmployeesService] Successfully fetched employee`)
      
      return employee
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to fetch employee:', error)
      throw error
    }
  }

  /**
   * Search employees by name or ID
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching employees
   */
  async searchEmployees(query) {
    try {
      if (!query) return []
      
      console.log(`[ToolboxEmployeesService] Searching employees: "${query}"`)
      
      const response = await this.request(
        `/api/${this.endpoint}/search?q=${encodeURIComponent(query)}`,
        { addSync: true }
      )
      
      let employees = []
      
      if (response.success && Array.isArray(response.data)) {
        employees = response.data
      } else if (response.success && Array.isArray(response.employees)) {
        employees = response.employees
      } else if (Array.isArray(response)) {
        employees = response
      }
      
      console.log(`[ToolboxEmployeesService] Found ${employees.length} matching employees`)
      
      return employees
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to search employees:', error)
      throw error
    }
  }

  /**
   * Get active employees only
   * @returns {Promise<Array>} List of active employees
   */
  async getActiveEmployees() {
    try {
      console.log(`[ToolboxEmployeesService] Fetching active employees`)
      
      const response = await this.request(
        `/api/${this.endpoint}?status=Active`,
        { addSync: true }
      )
      
      let employees = []
      
      if (response.success && Array.isArray(response.data)) {
        employees = response.data
      } else if (response.success && Array.isArray(response.employees)) {
        employees = response.employees
      } else if (Array.isArray(response)) {
        employees = response
      }
      
      console.log(`[ToolboxEmployeesService] Found ${employees.length} active employees`)
      
      return employees
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to fetch active employees:', error)
      throw error
    }
  }

  /**
   * Validate employee credentials (for checkout authorization)
   * @param {string} identifier - Employee ID number or barcode
   * @param {string} pin - Optional PIN for verification
   * @returns {Promise<Object>} Validation result with employee data
   */
  async validateEmployee(identifier, pin = null) {
    try {
      if (!identifier) throw new Error('Employee identifier is required')
      
      console.log(`[ToolboxEmployeesService] Validating employee`)
      
      // Try finding by ID number first
      let employee = await this.findEmployeeByIdNumber(identifier)
      
      // If not found, try barcode
      if (!employee) {
        employee = await this.findEmployeeByBarcode(identifier)
      }
      
      if (!employee) {
        return {
          valid: false,
          error: 'Employee not found',
          employee: null
        }
      }
      
      // Check employee status
      if (employee.status && employee.status.toLowerCase() !== 'active') {
        return {
          valid: false,
          error: `Employee status is ${employee.status}`,
          employee: employee
        }
      }
      
      // If PIN is provided and employee has a PIN set, verify it
      if (pin && employee.pin) {
        if (employee.pin !== pin) {
          return {
            valid: false,
            error: 'Invalid PIN',
            employee: employee
          }
        }
      }
      
      console.log(`[ToolboxEmployeesService] Employee validated successfully`)
      
      return {
        valid: true,
        employee: employee,
        message: 'Employee validated successfully'
      }
    } catch (error) {
      console.error('[ToolboxEmployeesService] Failed to validate employee:', error)
      return {
        valid: false,
        error: error.message,
        employee: null
      }
    }
  }
}
