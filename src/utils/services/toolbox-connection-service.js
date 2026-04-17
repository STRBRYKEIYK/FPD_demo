// ============================================================================
// services/toolbox-connection-service.js
// Toolbox Connection Testing Service
// Handles API connection testing and configuration for Toolbox
// ============================================================================
import { BaseAPIService } from '../core/base-api.js'


export class ToolboxConnectionService extends BaseAPIService {
  constructor() {
    super()
    this.isConnected = false
    this.lastTestTime = null
    this.testInterval = 60000 // 1 minute
  }

  // ========================================================================
  // CONNECTION TESTING
  // ========================================================================
  
  /**
   * Test connection to the API server
   * @param {Object} options - Test options
   * @param {boolean} options.skipCache - Skip cache and force a new test
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection(options = {}) {
    try {
      // Use cached result if available and recent (unless skipCache is true)
      if (!options.skipCache && this.lastTestTime) {
        const timeSinceLastTest = Date.now() - this.lastTestTime
        if (timeSinceLastTest < this.testInterval) {
          console.log(`[ToolboxConnectionService] Using cached connection status: ${this.isConnected}`)
          return this.isConnected
        }
      }
      
      console.log(`[ToolboxConnectionService] Testing API connection to ${this.baseURL}`)
      
      // Test with a simple items endpoint request
      const response = await fetch(`${this.baseURL}/api/items?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      
      this.isConnected = response.ok
      this.lastTestTime = Date.now()
      
      if (this.isConnected) {
        console.log(`[ToolboxConnectionService] ✅ API connection successful`)
      } else {
        console.log(`[ToolboxConnectionService] ❌ API connection failed - response not ok:`, response.status, response.statusText)
        
        // Log additional error info for debugging
        try {
          const errorText = await response.text()
          console.log(`[ToolboxConnectionService] API error response:`, errorText.substring(0, 200))
        } catch {
          // Ignore if can't read response
        }
      }
      
      return this.isConnected
    } catch (error) {
      console.error(`[ToolboxConnectionService] ❌ API connection test failed:`, error.message)
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error(`[ToolboxConnectionService] This is likely a CORS issue or the API server is not running`)
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        console.error(`[ToolboxConnectionService] Connection test timed out after 5 seconds`)
      }
      
      this.isConnected = false
      this.lastTestTime = Date.now()
      
      return false
    }
  }

  /**
   * Get connection status
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      lastTestTime: this.lastTestTime,
      lastTestDate: this.lastTestTime ? new Date(this.lastTestTime).toISOString() : null,
      timeSinceLastTest: this.lastTestTime ? Date.now() - this.lastTestTime : null,
      baseUrl: this.baseURL
    }
  }

  /**
   * Test connection with detailed diagnostics
   * @returns {Promise<Object>} Detailed connection information
   */
  async testConnectionDetailed() {
    const startTime = Date.now()
    
    try {
      console.log(`[ToolboxConnectionService] Running detailed connection test...`)
      
      const result = {
        success: false,
        baseUrl: this.baseURL,
        timestamp: new Date().toISOString(),
        responseTime: 0,
        status: null,
        statusText: null,
        error: null,
        details: {}
      }
      
      // Test basic connectivity
      const response = await fetch(`${this.baseURL}/api/items?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: AbortSignal.timeout(10000),
      })
      
      result.responseTime = Date.now() - startTime
      result.status = response.status
      result.statusText = response.statusText
      result.success = response.ok
      
      if (response.ok) {
        try {
          const data = await response.json()
          result.details.hasData = !!data
          result.details.dataStructure = data ? Object.keys(data) : []
          
          if (data.success !== undefined) {
            result.details.apiSuccess = data.success
          }
          
          if (Array.isArray(data.data)) {
            result.details.itemCount = data.data.length
          }
        } catch (jsonError) {
          result.details.parseError = 'Failed to parse response JSON'
        }
      } else {
        try {
          const errorText = await response.text()
          result.error = errorText.substring(0, 500)
        } catch {
          result.error = 'Could not read error response'
        }
      }
      
      this.isConnected = result.success
      this.lastTestTime = Date.now()
      
      console.log(`[ToolboxConnectionService] Detailed test completed:`, result)
      
      return result
    } catch (error) {
      const result = {
        success: false,
        baseUrl: this.baseURL,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        status: null,
        statusText: null,
        error: error.message,
        details: {
          errorType: error.constructor.name,
          isCorsError: error instanceof TypeError && error.message.includes('Failed to fetch'),
          isTimeout: error instanceof DOMException && error.name === 'AbortError'
        }
      }
      
      this.isConnected = false
      this.lastTestTime = Date.now()
      
      console.error(`[ToolboxConnectionService] Detailed test failed:`, result)
      
      return result
    }
  }

  /**
   * Test multiple endpoints to verify API functionality
   * @returns {Promise<Object>} Multi-endpoint test results
   */
  async testEndpoints() {
    const endpoints = [
      { name: 'Items', path: '/api/items?limit=1' },
      { name: 'Employees', path: '/api/employees?limit=1' },
      { name: 'Transactions', path: '/api/employee-logs?limit=1' }
    ]
    
    const results = {
      overall: true,
      timestamp: new Date().toISOString(),
      endpoints: []
    }
    
    console.log(`[ToolboxConnectionService] Testing ${endpoints.length} endpoints...`)
    
    for (const endpoint of endpoints) {
      const startTime = Date.now()
      
      try {
        const response = await fetch(`${this.baseURL}${endpoint.path}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          signal: AbortSignal.timeout(5000),
        })
        
        const endpointResult = {
          name: endpoint.name,
          path: endpoint.path,
          success: response.ok,
          status: response.status,
          responseTime: Date.now() - startTime
        }
        
        results.endpoints.push(endpointResult)
        
        if (!response.ok) {
          results.overall = false
        }
      } catch (error) {
        results.endpoints.push({
          name: endpoint.name,
          path: endpoint.path,
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime
        })
        results.overall = false
      }
    }
    
    console.log(`[ToolboxConnectionService] Endpoint tests completed. Overall: ${results.overall ? '✅' : '❌'}`)
    
    return results
  }

  /**
   * Reset connection cache
   */
  resetCache() {
    this.isConnected = false
    this.lastTestTime = null
    console.log(`[ToolboxConnectionService] Connection cache reset`)
  }

  /**
   * Update base URL and reset cache
   * @param {string} newBaseUrl - New base URL
   */
  updateBaseUrl(newBaseUrl) {
    if (!newBaseUrl) throw new Error('Base URL is required')
    
    // Validate URL format
    try {
      new URL(newBaseUrl)
    } catch {
      throw new Error('Invalid URL format')
    }
    
    this.baseURL = newBaseUrl.replace(/\/$/, '') // Remove trailing slash
    this.resetCache()
    
    console.log(`[ToolboxConnectionService] Base URL updated to: ${this.baseURL}`)
  }
}
