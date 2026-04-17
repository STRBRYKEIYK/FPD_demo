// ============================================================================
// services/profile-service.js - With Request Queue, Retry Logic, and Decryption
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"
import { getStoredToken } from "../../auth.js"
import { profileRequestQueue, descriptorRequestQueue } from "../../request-queue.js"
import { decryptData, isEncrypted } from "../../axios-encryption.js" // Import decryption utilities

export class ProfileService extends BaseAPIService {
  constructor() {
    super()
    this.profileCache = new Map()
    this.landingImageCache = new Map()
    this.galleryImageCache = new Map()
    this.retryAttempts = 3
    this.retryDelay = 1000
  }

  // ============================================================================
  // HELPER: Retry Logic for Network Requests with Decryption
  // ============================================================================
  
  async fetchWithRetry(url, options, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url, options);
        
        // If we get a 503, retry with exponential backoff
        if (response.status === 503 && i < attempts - 1) {
          const delay = this.retryDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // ========================================================================
        // ADDED: Decrypt JSON responses if encrypted
        // ========================================================================
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          // Clone response to read it multiple times
          const clonedResponse = response.clone();
          let data = await response.json();
          
          console.log('🔍 [fetchWithRetry] Raw JSON response:', data);
          
          // Check if data is encrypted
          const encryptedCheck = isEncrypted(data);
          
          if (encryptedCheck && encryptedCheck.encrypted) {
            console.log('🔐 [fetchWithRetry] Encrypted response detected - decrypting...');
            
            try {
              data = decryptData(encryptedCheck.data);
              console.log('✅ [fetchWithRetry] Decryption successful:', data);
            } catch (decryptError) {
              console.error('❌ [fetchWithRetry] Decryption failed:', decryptError);
              // Return original data if decryption fails
              throw decryptError;
            }
          } else {
            console.log('ℹ️ [fetchWithRetry] Plain response (not encrypted)');
          }
          
          // Return modified response object with decrypted data
          return new Response(JSON.stringify(data), {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers: clonedResponse.headers
          });
        }
        
        // Return original response for non-JSON (e.g., images, blobs)
        return response;
        
      } catch (error) {
        if (i === attempts - 1) throw error;
        
        const delay = this.retryDelay * Math.pow(2, i);
        console.log(`[ProfileService] Network error, retrying in ${delay}ms... (attempt ${i + 1}/${attempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ============================================================================
  // PROFILE PICTURE METHODS (Updated with Queue)
  // ============================================================================

  async getProfileByUid(uid) {
    return profileRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        if (response.status === 404) {
          return { success: false, error: "No profile picture found" }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
          throw error
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        
        return {
          success: true,
          blob,
          url
        }

      } catch (error) {
        console.error("Profile picture fetch error:", error)
        return { success: false, error: error.message }
      }
    });
  }

  getProfileUrlByUid(uid) {
    return `${this.baseURL}/api/profile/${uid}`
  }

  async checkProfileExists(uid) {
    return profileRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/info`,
          {
            method: "HEAD",
            headers: {
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        return response.ok
      } catch (error) {
        return false
      }
    });
  }

  async hasProfileByUid(uid) {
    try {
      const info = await this.getProfileInfoByUid(uid)
      return info.success && info.data && info.data.profile_pictures && info.data.profile_pictures.length > 0
    } catch (error) {
      console.error("Error checking profile existence:", error)
      return false
    }
  }

  clearProfileFromServiceWorker(uid) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_PROFILE',
        uid: uid
      })
    }
  }

  clearAllProfilesFromServiceWorker() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_PROFILE_CACHE'
      })
    }
  }

  clearProfileFromCache(uid) {
    if (this.profileCache.has(uid)) {
      const cached = this.profileCache.get(uid)
      if (cached.success && cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
      this.profileCache.delete(uid)
    }

    this.clearProfileFromServiceWorker(uid)
  }

  async preloadProfile(uid) {
    return profileRequestQueue.add(async () => {
      try {
        const url = this.getProfileUrlByUid(uid)
        const response = await this.fetchWithRetry(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        });
        
        if (response.ok) {
          return true
        }
        return false
      } catch (error) {
        console.error(`[ProfileService] Failed to preload profile for UID ${uid}:`, error)
        return false
      }
    });
  }

  async getProfileInfoByUid(uid) {
    return profileRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/info`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return data

      } catch (error) {
        console.error("Profile info fetch error:", error)
        throw error
      }
    });
  }

  async getSpecificProfilePicture(uid, filename) {
    return profileRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/${filename}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        if (response.status === 404) {
          return { success: false, error: "Profile picture file not found" }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        const blob = await response.blob()
        return {
          success: true,
          blob,
          url: URL.createObjectURL(blob),
          filename
        }

      } catch (error) {
        console.error("Specific profile picture fetch error:", error)
        throw error
      }
    });
  }

  // ============================================================================
  // FACE RECOGNITION DESCRIPTOR METHODS (Updated with Queue)
  // ============================================================================

  async getEmployeeDescriptor(uid) {
    return descriptorRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/descriptor`,
          {
            method: "GET",
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        const data = await response.json()

        if (response.status === 404) {
          return { success: false, error: "No face descriptor found" }
        }

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return {
          success: true,
          descriptor: data.descriptor || data.data?.descriptor,
          data: data
        }

      } catch (error) {
        console.error("Face descriptor fetch error:", error)
        return { success: false, error: error.message }
      }
    });
  }

  async saveEmployeeDescriptor(uid, descriptor) {
    return descriptorRequestQueue.add(async () => {
      try {
        if (!Array.isArray(descriptor) || descriptor.length !== 128) {
          throw new Error("Invalid descriptor: must be an array of 128 numbers")
        }

        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/descriptor`,
          {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredToken()}`,
            },
            body: JSON.stringify({ descriptor })
          }
        );

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return {
          success: true,
          message: data.message || "Descriptor saved successfully",
          data: data
        }

      } catch (error) {
        console.error("Face descriptor save error:", error)
        return { success: false, error: error.message }
      }
    });
  }

  async updateEmployeeDescriptor(uid, descriptor) {
    return descriptorRequestQueue.add(async () => {
      try {
        if (!Array.isArray(descriptor) || descriptor.length !== 128) {
          throw new Error("Invalid descriptor: must be an array of 128 numbers")
        }

        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/descriptor`,
          {
            method: "PUT",
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredToken()}`,
            },
            body: JSON.stringify({ descriptor })
          }
        );

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return {
          success: true,
          message: data.message || "Descriptor updated successfully",
          data: data
        }

      } catch (error) {
        console.error("Face descriptor update error:", error)
        return { success: false, error: error.message }
      }
    });
  }

  async deleteEmployeeDescriptor(uid) {
    return descriptorRequestQueue.add(async () => {
      try {
        const response = await this.fetchWithRetry(
          `${this.baseURL}/api/profile/${uid}/descriptor`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${getStoredToken()}`,
            },
          }
        );

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return {
          success: true,
          message: data.message || "Descriptor deleted successfully",
          data: data
        }

      } catch (error) {
        console.error("Face descriptor delete error:", error)
        return { success: false, error: error.message }
      }
    });
  }

  async getAllEmployeesWithDescriptors() {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/descriptors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        data: data.data || data.employees || [],
        count: data.count || data.data?.length || 0
      }

    } catch (error) {
      console.error("Fetch employees with descriptors error:", error)
      return { success: false, error: error.message, data: [] }
    }
  }

  // ============================================================================
  // LANDING & GALLERY IMAGE METHODS (Updated with Decryption)
  // ============================================================================

  async getLandingImages(forceRefresh = false) {
    try {
      const cacheKey = 'landing_images_list'
      if (!forceRefresh && this.landingImageCache.has(cacheKey)) {
        console.log('[ProfileService] Returning cached landing images list')
        return this.landingImageCache.get(cacheKey)
      }

      console.log('🔍 [getLandingImages] Fetching landing images...')
      
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/landing`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()
      
      console.log('✅ [getLandingImages] Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = {
        success: true,
        data: data.data || data
      }

      this.landingImageCache.set(cacheKey, result)
      console.log('[ProfileService] Cached landing images list:', result)

      return result

    } catch (error) {
      console.error("Landing images fetch error:", error)
      return { success: false, error: error.message, data: { images: [], count: 0 } }
    }
  }

  async getLandingImageBlob(filename, forceRefresh = false) {
    try {
      if (!forceRefresh && this.landingImageCache.has(filename)) {
        console.log(`[ProfileService] Returning cached landing image: ${filename}`)
        return this.landingImageCache.get(filename)
      }

      const url = this.getLandingImageUrl(filename)
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      if (response.status === 404) {
        return { success: false, error: "Landing image not found" }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const result = {
        success: true,
        blob,
        url: blobUrl,
        filename
      }

      this.landingImageCache.set(filename, result)
      console.log(`[ProfileService] Cached landing image: ${filename}`)

      return result

    } catch (error) {
      console.error("Landing image blob fetch error:", error)
      return { success: false, error: error.message }
    }
  }

  async uploadLandingImage(file) {
    try {
      if (!file) {
        throw new Error("No file provided for upload")
      }

      this.validateFile(file)

      const formData = new FormData()
      formData.append('image', file)

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/landing/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
          body: formData
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      this.clearLandingImageCache()

      return {
        success: true,
        message: data.message,
        data: data.data
      }

    } catch (error) {
      console.error("Landing image upload error:", error)
      return { success: false, error: error.message }
    }
  }

  getLandingImageUrl(filename) {
    return `${this.baseURL}/api/profile/landing/${filename}`
  }

  async deleteLandingImage(filename) {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/landing/${filename}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      this.clearLandingImageFromCache(filename)

      return {
        success: true,
        message: data.message,
        data: data.data
      }

    } catch (error) {
      console.error("Landing image delete error:", error)
      return { success: false, error: error.message }
    }
  }

  async getGalleryImages(forceRefresh = false) {
    try {
      const cacheKey = 'gallery_images_list'
      if (!forceRefresh && this.galleryImageCache.has(cacheKey)) {
        console.log('[ProfileService] Returning cached gallery images list')
        return this.galleryImageCache.get(cacheKey)
      }

      console.log('🔍 [getGalleryImages] Fetching gallery images...')

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/gallery`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()
      
      console.log('✅ [getGalleryImages] Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = {
        success: true,
        data: data.data || data
      }

      this.galleryImageCache.set(cacheKey, result)
      console.log('[ProfileService] Cached gallery images list:', result)

      return result

    } catch (error) {
      console.error("Gallery images fetch error:", error)
      return { success: false, error: error.message, data: { images: [], count: 0 } }
    }
  }

  async getGalleryImageBlob(filename, forceRefresh = false) {
    try {
      if (!forceRefresh && this.galleryImageCache.has(filename)) {
        console.log(`[ProfileService] Returning cached gallery image: ${filename}`)
        return this.galleryImageCache.get(filename)
      }

      const url = this.getGalleryImageUrl(filename)
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      if (response.status === 404) {
        return { success: false, error: "Gallery image not found" }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const result = {
        success: true,
        blob,
        url: blobUrl,
        filename
      }

      this.galleryImageCache.set(filename, result)

      return result

    } catch (error) {
      console.error("Gallery image blob fetch error:", error)
      return { success: false, error: error.message }
    }
  }

  async uploadGalleryImages(files) {
    try {
      const fileArray = Array.isArray(files) ? files : [files]
      
      if (fileArray.length === 0) {
        throw new Error("No files provided for upload")
      }

      fileArray.forEach(file => this.validateFile(file))

      const formData = new FormData()
      fileArray.forEach(file => {
        formData.append('images[]', file)
      })

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/gallery/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
          body: formData
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      this.clearGalleryImageCache()

      return {
        success: true,
        message: data.message,
        data: data.data
      }

    } catch (error) {
      console.error("Gallery images upload error:", error)
      return { success: false, error: error.message }
    }
  }

  getGalleryImageUrl(filename) {
    return `${this.baseURL}/api/profile/gallery/${filename}`
  }

  async deleteGalleryImage(filename) {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/gallery/${filename}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      this.clearGalleryImageFromCache(filename)

      return {
        success: true,
        message: data.message,
        data: data.data
      }

    } catch (error) {
      console.error("Gallery image delete error:", error)
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // BULK PROFILE METHODS (Keep as is)
  // ============================================================================

  async getBulkProfiles(options = {}) {
    try {
      const queryParams = new URLSearchParams()
      
      if (options.page) queryParams.append('page', options.page)
      if (options.limit) queryParams.append('limit', options.limit)
      if (options.search) queryParams.append('search', options.search)
      if (options.department) queryParams.append('department', options.department)

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/bulk?${queryParams}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return data

    } catch (error) {
      console.error("Bulk profiles fetch error:", error)
      throw error
    }
  }

  async getBulkProfilesSimple() {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/bulk/simple`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return data

    } catch (error) {
      console.error("Simple bulk profiles fetch error:", error)
      throw error
    }
  }

  async downloadBulkProfiles(options = {}) {
    try {
      const queryParams = new URLSearchParams()
      
      if (options.department) queryParams.append('department', options.department)
      if (options.search) queryParams.append('search', options.search)
      if (options.uids && Array.isArray(options.uids)) {
        queryParams.append('uids', options.uids.join(','))
      }

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/bulk/download?${queryParams}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return {
        success: true,
        blob,
        filename: this.extractFilenameFromResponse(response) || 'profile_images.zip'
      }

    } catch (error) {
      console.error("Bulk download error:", error)
      throw error
    }
  }

  async downloadBulkProfilesPost(uids, options = {}) {
    try {
      const requestBody = {
        uids: uids,
        include_summary: options.include_summary !== false,
        compression_level: options.compression_level || 6
      }

      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/bulk/download`,
        {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getStoredToken()}`,
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return {
        success: true,
        blob,
        filename: this.extractFilenameFromResponse(response) || 'profile_images.zip'
      }

    } catch (error) {
      console.error("Bulk download (POST) error:", error)
      throw error
    }
  }

  async deleteProfilePicture(uid, filename) {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/${uid}/${filename}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      this.clearProfileFromCache(uid)
      
      return data

    } catch (error) {
      console.error("Profile picture delete error:", error)
      throw error
    }
  }

  async uploadProfileByUid(uid, file) {
    if (!file) {
      throw new Error("No file provided for upload")
    }

    this.validateFile(file)

    const formData = new FormData()
    formData.append('profile_picture', file)

    const result = await this.request(`/api/profile/${uid}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
      },
      body: formData
    })

    this.clearProfileFromCache(uid)
    return result
  }

  async uploadReplaceProfileByUid(uid, file) {
    if (!file) {
      throw new Error("No file provided for upload")
    }

    this.validateFile(file)

    const formData = new FormData()
    formData.append('profile_picture', file)

    const result = await this.request(`/api/profile/${uid}/upload-replace`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
      },
      body: formData
    })

    this.clearProfileFromCache(uid)
    return result
  }

  // ============================================================================
  // CACHE MANAGEMENT METHODS
  // ============================================================================

  clearLandingImageFromCache(filename) {
    if (this.landingImageCache.has(filename)) {
      const cached = this.landingImageCache.get(filename)
      if (cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
      this.landingImageCache.delete(filename)
    }
    
    this.landingImageCache.delete('landing_images_list')
  }

  clearLandingImageCache() {
    this.landingImageCache.forEach((cached, key) => {
      if (cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
    })
    this.landingImageCache.clear()
    
    this.clearServiceWorkerImageCache('landing')
  }

  clearGalleryImageFromCache(filename) {
    if (this.galleryImageCache.has(filename)) {
      const cached = this.galleryImageCache.get(filename)
      if (cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
      this.galleryImageCache.delete(filename)
    }
    
    this.galleryImageCache.delete('gallery_images_list')
  }

  clearGalleryImageCache() {
    this.galleryImageCache.forEach((cached, key) => {
      if (cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
    })
    this.galleryImageCache.clear()
    
    this.clearServiceWorkerImageCache('gallery')
  }

  clearServiceWorkerImageCache(type) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_SPECIFIC_IMAGE_CACHE',
        imageType: type
      })
    }
  }

  clearAllCaches() {
    this.clearProfileCache()
    this.clearLandingImageCache()
    this.clearGalleryImageCache()
  }

  getCacheStats() {
    return {
      profiles: this.profileCache.size,
      landingImages: this.landingImageCache.size,
      galleryImages: this.galleryImageCache.size,
      total: this.profileCache.size + this.landingImageCache.size + this.galleryImageCache.size
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only image files are allowed.")
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error("File size too large. Maximum size is 10MB.")
    }
  }

  extractFilenameFromResponse(response) {
    const contentDisposition = response.headers.get('Content-Disposition')
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
      if (filenameMatch) {
        return filenameMatch[1]
      }
    }
    return null
  }

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  clearProfileCache() {
    this.profileCache.forEach((cached) => {
      if (cached.success && cached.url && cached.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.url)
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error)
        }
      }
    })
    this.profileCache.clear()
  }

  async getLandingImagesDirect() {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/landing/direct`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        data: data.data
      }

    } catch (error) {
      console.error("Landing images direct fetch error:", error)
      return { success: false, error: error.message, data: { images: [], count: 0 } }
    }
  }

  async getGalleryImagesDirect() {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseURL}/api/profile/gallery/direct`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getStoredToken()}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        }
      );

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        data: data.data
      }

    } catch (error) {
      console.error("Gallery images direct fetch error:", error)
      return { success: false, error: error.message, data: { images: [], count: 0 } }
    }
  }
}