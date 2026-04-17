// ============================================================================
// axios-encryption.js - Axios Interceptors with Decryption & Console Logging
// ============================================================================
import axios from "axios"
import CryptoJS from "crypto-js"

// ============================================================================
// CONFIGURATION
// ============================================================================
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || "wSDp34MhW1pp7RJ8V01ovioEMYKI2hJceZ91VzZcA7s="
const ENABLE_LOGGING = import.meta.env.VITE_ENABLE_ENCRYPTION_LOGS !== "false" // Default true

// ============================================================================
// LOGGING UTILITIES
// ============================================================================
const logger = {
  group: (title, color = "#4CAF50") => {
    if (!ENABLE_LOGGING) return
    console.groupCollapsed(
      `%c🔐 ${title}`,
      `color: ${color}; font-weight: bold; font-size: 12px;`
    )
  },
  
  groupEnd: () => {
    if (!ENABLE_LOGGING) return
    console.groupEnd()
  },
  
  info: (label, data) => {
    if (!ENABLE_LOGGING) return
    console.log(`%c${label}:`, "color: #2196F3; font-weight: bold;", data)
  },
  
  success: (label, data) => {
    if (!ENABLE_LOGGING) return
    console.log(`%c✓ ${label}:`, "color: #4CAF50; font-weight: bold;", data)
  },
  
  error: (label, data) => {
    if (!ENABLE_LOGGING) return
    console.error(`%c✗ ${label}:`, "color: #F44336; font-weight: bold;", data)
  },
  
  warn: (label, data) => {
    if (!ENABLE_LOGGING) return
    console.warn(`%c⚠ ${label}:`, "color: #FF9800; font-weight: bold;", data)
  },
  
  debug: (label, data) => {
    if (!ENABLE_LOGGING) return
    console.debug(`%c${label}:`, "color: #9E9E9E;", data)
  }
}

// ============================================================================
// DECRYPTION FUNCTION
// ============================================================================
/**
 * Decrypts encrypted data using AES decryption
 * Compatible with PHP's openssl_encrypt (AES-256-CBC)
 * @param {string} encryptedData - The encrypted string to decrypt
 * @returns {any} - Decrypted and parsed data
 */
function decryptData(encryptedData) {
  const startTime = performance.now()
  
  logger.group("DECRYPTION PROCESS", "#9C27B0")
  
  try {
    // Log input
    logger.info("Encrypted Input (first 100 chars)", 
      encryptedData.substring(0, 100) + (encryptedData.length > 100 ? "..." : "")
    )
    logger.debug("Encrypted Data Length", `${encryptedData.length} characters`)
    
    // Step 1: Base64 decode to get IV + encrypted data
    logger.info("Step 1", "Base64 decoding encrypted data...")
    const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData)
    logger.success("Base64 Decode", "Complete")
    
    // Step 2: Extract IV (first 16 bytes for AES-256-CBC)
    logger.info("Step 2", "Extracting IV (first 16 bytes)...")
    const ivSize = 16 // AES block size
    const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4), ivSize)
    const encrypted = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(4), encryptedBytes.sigBytes - ivSize)
    
    logger.debug("IV (hex)", iv.toString(CryptoJS.enc.Hex).substring(0, 32) + "...")
    logger.debug("Encrypted payload size", `${encrypted.sigBytes} bytes`)
    logger.success("IV Extraction", "Complete")
    
    // Step 3: Prepare key (base64 decode the key)
    logger.info("Step 3", "Preparing decryption key...")
    const key = CryptoJS.enc.Base64.parse(ENCRYPTION_KEY)
    logger.success("Key Preparation", "Complete")
    
    // Step 4: Decrypt using AES-256-CBC
    logger.info("Step 4", "Starting AES-256-CBC decryption...")
    const decryptedBytes = CryptoJS.AES.decrypt(
      { ciphertext: encrypted },
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    )
    logger.success("AES-256-CBC Decryption", "Complete")
    
    // Step 5: Convert to UTF8 string
    logger.info("Step 5", "Converting bytes to UTF-8 string...")
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8)
    
    if (!decryptedString) {
      throw new Error("Decryption resulted in empty string - possible key mismatch or wrong format")
    }
    
    logger.success("UTF-8 Conversion", "Complete")
    logger.debug("Decrypted String (first 200 chars)", 
      decryptedString.substring(0, 200) + (decryptedString.length > 200 ? "..." : "")
    )
    
    // Step 6: Parse JSON
    logger.info("Step 6", "Parsing JSON data...")
    const parsedData = JSON.parse(decryptedString)
    logger.success("JSON Parsing", "Complete")
    
    // Log result
    const endTime = performance.now()
    const duration = (endTime - startTime).toFixed(2)
    
    logger.info("Decrypted Data Type", typeof parsedData)
    logger.info("Decrypted Data Structure", 
      Array.isArray(parsedData) ? `Array[${parsedData.length}]` : 
      parsedData && typeof parsedData === 'object' ? `Object with ${Object.keys(parsedData).length} keys` :
      'Primitive value'
    )
    logger.success("Processing Time", `${duration}ms`)
    logger.debug("Full Decrypted Data", parsedData)
    
    logger.groupEnd()
    
    return parsedData
    
  } catch (error) {
    const endTime = performance.now()
    const duration = (endTime - startTime).toFixed(2)
    
    logger.error("Decryption Failed", error.message)
    logger.debug("Error Details", error)
    logger.warn("Processing Time (Failed)", `${duration}ms`)
    logger.groupEnd()
    
    throw new Error(`Decryption failed: ${error.message}`)
  }
}

// ============================================================================
// ENCRYPTION FUNCTION (Optional - for requests)
// ============================================================================
/**
 * Encrypts data using AES encryption
 * @param {any} data - The data to encrypt
 * @returns {string} - Encrypted string
 */
function encryptData(data) {
  const startTime = performance.now()
  
  logger.group("ENCRYPTION PROCESS", "#FF5722")
  
  try {
    logger.info("Input Data Type", typeof data)
    logger.debug("Data to Encrypt", data)
    
    // Convert to JSON string
    const jsonString = JSON.stringify(data)
    logger.info("JSON String Length", `${jsonString.length} characters`)
    
    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString()
    
    const endTime = performance.now()
    const duration = (endTime - startTime).toFixed(2)
    
    logger.success("Encrypted Output (first 100 chars)", 
      encrypted.substring(0, 100) + (encrypted.length > 100 ? "..." : "")
    )
    logger.info("Encrypted Length", `${encrypted.length} characters`)
    logger.success("Processing Time", `${duration}ms`)
    
    logger.groupEnd()
    
    return encrypted
    
  } catch (error) {
    logger.error("Encryption Failed", error.message)
    logger.groupEnd()
    throw new Error(`Encryption failed: ${error.message}`)
  }
}

// ============================================================================
// CHECK IF DATA IS ENCRYPTED
// ============================================================================
/**
 * Check if the response data appears to be encrypted
 * @param {any} data - Data to check
 * @returns {boolean|object} - false if not encrypted, or object with encrypted data if it is
 */
function isEncrypted(data) {
  // Check for PHP wrapped format: { encrypted: true, data: "..." }
  if (data && typeof data === 'object' && data.encrypted === true && data.data) {
    logger.info("Detected Format", "PHP wrapped encrypted response")
    return { encrypted: true, data: data.data }
  }
  
  // Check for raw encrypted string
  if (typeof data !== "string") return false
  
  // Check for AES encrypted format (Base64 with "U2FsdGVkX1" prefix typically)
  // or other indicators of encryption
  const isEncryptedString = (
    data.startsWith("U2FsdGVkX1") || // AES with salt
    (data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data)) // Base64 pattern
  )
  
  if (isEncryptedString) {
    logger.info("Detected Format", "Raw encrypted string")
    return { encrypted: true, data: data }
  }
  
  return false
}

// ============================================================================
// SETUP AXIOS INTERCEPTORS
// ============================================================================
export function setupAxiosInterceptors() {
  console.log(
    "%c🔐 AXIOS ENCRYPTION INTERCEPTORS INITIALIZED",
    "color: #4CAF50; font-weight: bold; font-size: 14px; padding: 4px;"
  )
  console.log(
    "%cEncryption logging is " + (ENABLE_LOGGING ? "ENABLED" : "DISABLED"),
    `color: ${ENABLE_LOGGING ? "#4CAF50" : "#F44336"}; font-weight: bold;`
  )
  
  // ========================================================================
  // REQUEST INTERCEPTOR (Optional - for encrypting outgoing data)
  // ========================================================================
  axios.interceptors.request.use(
    (config) => {
      // Only log if encryption logging is enabled
      if (ENABLE_LOGGING && config.data) {
        logger.group(`REQUEST: ${config.method?.toUpperCase()} ${config.url}`, "#2196F3")
        logger.debug("Request Data", config.data)
        logger.groupEnd()
      }
      
      // Add encryption here if needed for requests
      // Example:
      // if (config.encryptRequest && config.data) {
      //   config.data = { encrypted: encryptData(config.data) }
      // }
      
      return config
    },
    (error) => {
      logger.error("Request Error", error)
      return Promise.reject(error)
    }
  )

  // ========================================================================
  // RESPONSE INTERCEPTOR (Auto-decrypt encrypted responses)
  // ========================================================================
  axios.interceptors.response.use(
    (response) => {
      // ALWAYS log this to verify interceptor is running
      console.log("%c🔥 INTERCEPTOR FIRED!", "color: #FF5722; font-weight: bold; font-size: 14px;")
      
      const url = response.config.url || "unknown"
      const method = response.config.method?.toUpperCase() || "GET"
      
      logger.group(`RESPONSE: ${method} ${url}`, "#4CAF50")
      logger.info("Status", `${response.status} ${response.statusText}`)
      logger.info("Raw Response Data Type", typeof response.data)
      logger.info("Raw Response Data", response.data)
      
      try {
        // Check if response data is encrypted
        const encryptedCheck = isEncrypted(response.data)
        
        console.log("%c🔍 Encryption Check Result:", "color: #9C27B0; font-weight: bold;", encryptedCheck)
        
        if (encryptedCheck && encryptedCheck.encrypted) {
          logger.warn("Encrypted Response Detected", "Attempting decryption...")
          console.log("%c🔐 STARTING DECRYPTION...", "color: #9C27B0; font-weight: bold; font-size: 14px;")
          
          // Decrypt the data (extract from wrapper if needed)
          const decryptedData = decryptData(encryptedCheck.data)
          
          console.log("%c✅ DECRYPTION COMPLETE!", "color: #4CAF50; font-weight: bold; font-size: 14px;")
          console.log("%c📦 Decrypted Data:", "color: #4CAF50; font-weight: bold;", decryptedData)
          
          // Replace response data with decrypted version
          response.data = decryptedData
          
          logger.success("Response Data Replaced", "Decrypted data is now in response.data")
        } else {
          logger.info("Response Format", "Plain data (not encrypted)")
          console.log("%c ℹ️ No encryption detected - returning plain data", "color: #2196F3;")
        }
        
        logger.groupEnd()
        return response
        
      } catch (error) {
        logger.error("Response Processing Failed", error.message)
        logger.error("Error Stack", error.stack)
        console.error("%c❌ DECRYPTION ERROR:", "color: #F44336; font-weight: bold;", error)
        logger.groupEnd()
        
        // Return original response if decryption fails
        console.warn("⚠️ Returning original response due to decryption failure")
        return response
      }
    },
    (error) => {
      console.log("%c🔥 INTERCEPTOR FIRED (ERROR)!", "color: #F44336; font-weight: bold; font-size: 14px;")
      
      const url = error.config?.url || "unknown"
      const method = error.config?.method?.toUpperCase() || "REQUEST"
      
      logger.group(`ERROR: ${method} ${url}`, "#F44336")
      
      if (error.response) {
        logger.error("Response Error", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })
        
        // Try to decrypt error response if it's encrypted
        const encryptedCheck = isEncrypted(error.response.data)
        if (encryptedCheck && encryptedCheck.encrypted) {
          try {
            logger.warn("Encrypted Error Response", "Attempting decryption...")
            error.response.data = decryptData(encryptedCheck.data)
            logger.success("Error Response Decrypted", error.response.data)
          } catch (decryptError) {
            logger.error("Error Response Decryption Failed", decryptError.message)
          }
        }
      } else if (error.request) {
        logger.error("No Response Received", error.request)
      } else {
        logger.error("Request Setup Error", error.message)
      }
      
      logger.groupEnd()
      
      return Promise.reject(error)
    }
  )
}

// ============================================================================
// MANUAL DECRYPT UTILITY (for use outside interceptors)
// ============================================================================
export { decryptData, encryptData, isEncrypted }

// ============================================================================
// TOGGLE LOGGING UTILITY
// ============================================================================
export function setEncryptionLogging(enabled) {
  const oldValue = ENABLE_LOGGING
  // Note: This won't actually change the const, but you can use a different approach
  console.log(`Encryption logging: ${enabled ? "ENABLED" : "DISABLED"}`)
  console.log("(Restart app to apply changes)")
  return oldValue
}