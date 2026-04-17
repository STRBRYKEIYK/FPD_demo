// ============================================================================
// services/toolbox-items-service.js
// Toolbox Items Management API Service
// Handles item operations, stock management, and checkout for Toolbox
// ============================================================================
import { BaseAPIService } from '../core/base-api.js'
import { getStoredToken } from '../../auth.js'
import axios from 'axios'
import { imageRequestQueue } from '../../request-queue.js'

export class ToolboxItemsService extends BaseAPIService {
  constructor() {
    super()
    this.endpoint = 'items'
    this.imageCache = new Map()
    this.retryAttempts = 3
    this.retryDelay = 1000
  }

  // ========================================================================
  // HELPER: Axios-based requests (uses interceptors for auto-decryption)
  // ========================================================================
  
  async axiosRequest(url, options = {}) {
    try {
      const config = {
        url,
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: 10000, // 10 second timeout
        ...options
      }
      
      const response = await axios(config)
      return response.data
    } catch (error) {
      // Handle different error types
      if (error.response) {
        // Server responded with error status
        const status = error.response.status
        const errorData = error.response.data // This is already decrypted by interceptor!
        
        // Check if the decrypted response has actual data despite 404 status
        // (Server may return 404 status but encrypted data in body)
        if (status === 404) {
          // If decrypted response has data array, return it instead of throwing
          if (errorData && (errorData.data || errorData.images)) {
            console.log('[ToolboxItemsService] Got data despite 404 status (encrypted response)')
            return errorData
          }
          // If it's truly not found (error message), throw 404
          if (errorData?.error === 'Route not found' || errorData?.error === 'No images found') {
            throw new Error('404')
          }
          throw new Error('404')
        }
        
        throw new Error(errorData?.error || errorData?.message || error.response.statusText)
      } else if (error.request) {
        // Request made but no response (network error, CORS, cancelled)
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error('Request timeout')
        }
        if (error.message.includes('Network Error')) {
          throw new Error('Network error - check server connection')
        }
        // Request was cancelled (likely by HMR or component unmount)
        if (error.request.status === 0) {
          throw new Error('Request cancelled')
        }
        throw new Error('No response from server')
      } else {
        // Error setting up request
        throw new Error(error.message)
      }
    }
  }

  // ========================================================================
  // CORE FUNCTIONS - Items Management
  // ========================================================================
  
  /**
   * Fetch all items from the API
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of items to fetch
   * @returns {Promise<Array>} List of items
   */
  async fetchItems(options = { limit: 1000 }) {
    try {
      const params = new URLSearchParams()
      if (options.limit) params.append('limit', options.limit)
      
      const queryString = params.toString()
      const response = await this.request(
        `/api/${this.endpoint}${queryString ? '?' + queryString : ''}`,
        { addSync: true }
      )
      
      // Handle different response structures
      let items = []
      
      if (response && typeof response === 'object') {
        if (response.success && Array.isArray(response.data)) {
          items = response.data
          console.log(`[ToolboxItemsService] Successfully fetched ${items.length} items`)
          
          if (response.pagination) {
            console.log(`[ToolboxItemsService] Pagination:`, response.pagination)
          }
        } else if (Array.isArray(response)) {
          items = response
          console.log(`[ToolboxItemsService] Successfully fetched ${items.length} items (direct array)`)
        } else {
          console.warn(`[ToolboxItemsService] Unexpected response structure:`, Object.keys(response))
          throw new Error('API response does not contain expected data structure')
        }
      } else {
        throw new Error('Invalid API response format')
      }
      
      return items
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to fetch items:', error)
      throw error
    }
  }

  /**
   * Update item quantity using PUT /api/items/:id/quantity endpoint
   * @param {number} itemId - Item ID
   * @param {string} updateType - 'set_balance' | 'adjust_in' | 'adjust_out' | 'manual'
   * @param {number} value - Quantity value
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} Updated item data
   */
  async updateItemQuantity(itemId, updateType, value, notes = '') {
    try {
      if (!itemId) throw new Error('Item ID is required')
      if (!updateType) throw new Error('Update type is required')
      if (value === undefined || value === null) throw new Error('Value is required')
      
      const payload = {
        updateType,
        value,
        notes
      }
      
      const response = await this.request(
        `/api/${this.endpoint}/${itemId}/quantity`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update item quantity')
      }
      
      console.log(`[ToolboxItemsService] Updated item ${itemId} quantity:`, response)
      return response
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to update item quantity:', error)
      throw error
    }
  }

  /**
   * Record item going out (stock decrease)
   * @param {number} itemId - Item ID
   * @param {Object} data - Checkout data
   * @param {number} data.quantity - Quantity going out
   * @param {string} data.out_by - Who is taking the item
   * @param {string} data.notes - Optional notes
   * @param {string} data.item_name - Item name for logging
   * @returns {Promise<Object>} Result
   */
  async recordItemOut(itemId, data) {
    try {
      if (!itemId) throw new Error('Item ID is required')
      if (!data.quantity) throw new Error('Quantity is required')
      
      const payload = {
        quantity: data.quantity,
        out_by: data.out_by || 'toolbox_system',
        notes: data.notes || `Toolbox checkout - ${data.quantity} units taken`,
        item_name: data.item_name
      }
      
      const response = await this.request(
        `/api/${this.endpoint}/stock/${itemId}/out`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to record item out')
      }
      
      console.log(`[ToolboxItemsService] Recorded item ${itemId} going out:`, response)
      return response
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to record item out:', error)
      throw error
    }
  }

  /**
   * Bulk checkout multiple items
   * @param {Array} items - Array of items to checkout
   * @param {Object} options - Checkout options
   * @param {string} options.checkout_by - Who is checking out
   * @param {string} options.notes - Optional notes
   * @returns {Promise<Object>} Checkout result
   */
  async bulkCheckout(items, options = {}) {
    try {
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and must not be empty')
      }
      
      const payload = {
        items: items.map(item => ({
          item_no: item.item_no || item.id,
          quantity: item.quantity || 1,
          item_name: item.item_name || item.name || 'Unknown'
        })),
        checkout_by: options.checkout_by || 'toolbox_system',
        notes: options.notes || `Bulk checkout - ${items.length} items processed`,
        timestamp: new Date().toISOString()
      }
      
      console.log(`[ToolboxItemsService] Attempting bulk checkout for ${items.length} items`)
      
      // Try bulk checkout endpoint first
      try {
        const response = await this.request(
          `/api/${this.endpoint}/checkout`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
          }
        )
        
        if (response.success) {
          console.log(`[ToolboxItemsService] ✅ Bulk checkout successful!`)
          return response
        }
      } catch (bulkError) {
        console.log(`[ToolboxItemsService] Bulk checkout failed, falling back to individual endpoints:`, bulkError.message)
      }
      
      // Fallback: Use individual item out endpoints
      console.log(`[ToolboxItemsService] Using individual item out endpoints...`)
      const results = []
      const errors = []
      
      for (const item of items) {
        try {
          const result = await this.recordItemOut(item.item_no || item.id, {
            quantity: item.quantity || 1,
            out_by: options.checkout_by || 'toolbox_system',
            notes: options.notes || `Checkout - ${item.quantity || 1} units taken`,
            item_name: item.item_name || item.name
          })
          results.push(result)
        } catch (itemError) {
          console.error(`[ToolboxItemsService] Failed to checkout item ${item.item_no || item.id}:`, itemError)
          errors.push({ item, error: itemError.message })
        }
      }
      
      return {
        success: errors.length === 0,
        results,
        errors,
        message: errors.length === 0 
          ? `Successfully checked out ${results.length} items`
          : `Checked out ${results.length} items with ${errors.length} errors`
      }
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to bulk checkout:', error)
      throw error
    }
  }

  /**
   * Get item images
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} { success: boolean, data: Array, error?: string }
   */
  async getItemImages(itemId) {
    try {
      if (!itemId) throw new Error('Item ID is required')
      
      // Use axios for automatic decryption via interceptors
      // Backend expects: /api/items/images/{itemId}
      const data = await this.axiosRequest(`${this.baseURL}/api/${this.endpoint}/images/${itemId}`)
      
      if (!data) {
        console.warn('[ToolboxItemsService] No response received for item images')
        return { success: false, data: [], error: 'No response from server' }
      }
      
      if (data.success === false) {
        return { success: false, data: [], error: data.error || 'Failed to fetch item images' }
      }
      
      return { 
        success: true, 
        data: data.data || data.images || [] 
      }
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to fetch item images:', error)
      
      // Handle specific error cases
      const errorMsg = error.message || 'Unknown error'
      
      // 404s and cancelled requests - return empty array (item has no images)
      if (errorMsg.includes('404') || 
          errorMsg.includes('Not Found') || 
          errorMsg.includes('Request cancelled')) {
        return { success: true, data: [] }
      }
      
      // Network/timeout errors - return error so component can handle
      return { 
        success: false, 
        data: [], 
        error: errorMsg
      }
    }
  }

  /**
   * Upload item image
   * @param {number} itemId - Item ID
   * @param {File} imageFile - Image file to upload
   * @returns {Promise<Object>} Upload result
   */
  async uploadItemImage(itemId, imageFile) {
    try {
      if (!itemId) throw new Error('Item ID is required')
      if (!imageFile) throw new Error('Image file is required')
      
      const formData = new FormData()
      formData.append('image', imageFile)
      
      // Backend expects: /api/items/images/{itemId}
      const response = await this.request(
        `/api/${this.endpoint}/images/${itemId}`,
        {
          method: 'POST',
          body: formData,
          headers: {} // Let browser set Content-Type for FormData
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to upload image')
      }
      
      console.log(`[ToolboxItemsService] Successfully uploaded image for item ${itemId}`)
      return response
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to upload item image:', error)
      throw error
    }
  }

  /**
   * Delete item image
   * @param {number} itemId - Item ID
   * @param {string} imageUrl - Image URL to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteItemImage(itemId, imageUrl) {
    try {
      if (!itemId) throw new Error('Item ID is required')
      if (!imageUrl) throw new Error('Image URL is required')
      
      // Backend expects: /api/items/images/{itemId}/file/{filename}
      const response = await this.request(
        `/api/${this.endpoint}/images/${itemId}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ imageUrl }),
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete image')
      }
      
      console.log(`[ToolboxItemsService] Successfully deleted image for item ${itemId}`)
      
      // Clear cached images for this item
      this.clearItemImageCache(itemId)
      
      return response
    } catch (error) {
      console.error('[ToolboxItemsService] Failed to delete item image:', error)
      throw error
    }
  }

  // ========================================================================
  // IMAGE FETCHING WITH DECRYPTION SUPPORT
  // ========================================================================

  /**
   * Get latest item image as blob with decryption support
   * @param {number} itemId - Item ID
   * @param {boolean} forceRefresh - Force refresh from server
   * @returns {Promise<Object>} { success, blob, url, filename }
   */
  async getLatestItemImageBlob(itemId, forceRefresh = false) {
    return imageRequestQueue.add(async () => {
      try {
        const cacheKey = `latest_${itemId}`
        
        if (!forceRefresh && this.imageCache.has(cacheKey)) {
          console.log(`[ToolboxItemsService] Returning cached image: ${cacheKey}`)
          return this.imageCache.get(cacheKey)
        }

        const url = `${this.baseURL}/api/${this.endpoint}/images/${itemId}/latest`
        
        console.log(`[ToolboxItemsService] Fetching latest image for item ${itemId}...`)
        
        // Use axios with responseType: 'blob' for image fetching
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
          responseType: 'blob',
          timeout: 15000 // 15 second timeout for images
        })

        const blob = response.data
        const blobUrl = URL.createObjectURL(blob)

        const result = {
          success: true,
          blob,
          url: blobUrl,
          itemId
        }

        this.imageCache.set(cacheKey, result)
        console.log(`[ToolboxItemsService] ✓ Cached latest image for item ${itemId}`)

        return result

      } catch (error) {
        console.error(`[ToolboxItemsService] ✗ Failed to fetch latest image for item ${itemId}:`, error.message)
        
        if (error.response?.status === 404) {
          return { success: false, error: "No image found" }
        }
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return { success: false, error: "Request timeout" }
        }
        
        return { success: false, error: error.message || 'Failed to load image' }
      }
    })
  }

  /**
   * Get specific item image by filename as blob with decryption support
   * @param {number} itemId - Item ID
   * @param {string} filename - Image filename
   * @param {boolean} forceRefresh - Force refresh from server
   * @returns {Promise<Object>} { success, blob, url, filename }
   */
  async getItemImageBlob(itemId, filename, forceRefresh = false) {
    return imageRequestQueue.add(async () => {
      try {
        const cacheKey = `${itemId}_${filename}`
        
        if (!forceRefresh && this.imageCache.has(cacheKey)) {
          console.log(`[ToolboxItemsService] Returning cached image: ${cacheKey}`)
          return this.imageCache.get(cacheKey)
        }

        const encodedFilename = encodeURIComponent(filename)
        const url = `${this.baseURL}/api/${this.endpoint}/images/${itemId}/file/${encodedFilename}`
        
        console.log(`[ToolboxItemsService] Fetching image for item ${itemId}: ${filename}`)
        
        // Use axios with responseType: 'blob' for image fetching
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
          responseType: 'blob',
          timeout: 15000 // 15 second timeout for images
        })

        const blob = response.data
        const blobUrl = URL.createObjectURL(blob)

        const result = {
          success: true,
          blob,
          url: blobUrl,
          filename,
          itemId
        }

        this.imageCache.set(cacheKey, result)
        console.log(`[ToolboxItemsService] ✓ Cached image for item ${itemId}: ${filename}`)

        return result

      } catch (error) {
        console.error(`[ToolboxItemsService] ✗ Failed to fetch image ${filename} for item ${itemId}:`, error.message)
        
        if (error.response?.status === 404) {
          return { success: false, error: "Image not found" }
        }
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return { success: false, error: "Request timeout" }
        }
        
        return { success: false, error: error.message || 'Failed to load image' }
      }
    })
  }

  /**
   * Get URL for latest item image (for direct browser access)
   * @param {number} itemId - Item ID
   * @returns {string} Image URL
   */
  getLatestItemImageUrl(itemId) {
    return `${this.baseURL}/api/${this.endpoint}/images/${itemId}/latest`
  }

  /**
   * Get URL for specific item image by filename (for direct browser access)
   * @param {number} itemId - Item ID
   * @param {string} filename - Image filename
   * @returns {string} Image URL
   */
  getItemImageUrl(itemId, filename) {
    const encodedFilename = encodeURIComponent(filename)
    return `${this.baseURL}/api/${this.endpoint}/images/${itemId}/file/${encodedFilename}`
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * Clear cached image for specific item
   * @param {number} itemId - Item ID
   */
  clearItemImageCache(itemId) {
    const keysToDelete = []
    
    for (const [key, cached] of this.imageCache.entries()) {
      if (key.startsWith(`${itemId}_`) || key === `latest_${itemId}`) {
        if (cached.url && cached.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(cached.url)
          } catch (error) {
            console.warn('Failed to revoke blob URL:', error)
          }
        }
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.imageCache.delete(key))
    console.log(`[ToolboxItemsService] Cleared ${keysToDelete.length} cached images for item ${itemId}`)
  }

  /**
   * Clear all cached images
   */
  clearAllImageCache() {
    this.imageCache.forEach((cached) => {
      if (cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
    })
    this.imageCache.clear()
    console.log('[ToolboxItemsService] Cleared all cached images')
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getImageCacheStats() {
    return {
      totalCached: this.imageCache.size,
      items: Array.from(this.imageCache.keys())
    }
  }
}
