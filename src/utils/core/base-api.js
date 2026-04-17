// ============================================================================
// core/base-api.js - Using fetch() with Manual Decryption
// ============================================================================
import { getStoredToken, clearTokens } from "../../auth.js"
import { API_ENDPOINTS, DEFAULT_HEADERS } from "../config/api-config.js"
import { decryptData, isEncrypted } from "../../axios-encryption.js"

// ============================================================================
// NETWORK TOAST UTILITY
// Dispatches a custom DOM event that any toast component can listen to.
// Usage in your root component:
//   window.addEventListener('network-toast', (e) => showToast(e.detail))
// ============================================================================

const SLOW_REQUEST_THRESHOLD_MS = 5000  // warn if a request takes longer than this

const NETWORK_MESSAGES = {
  offline:   { type: "error",   text: "You're offline. Please check your internet connection." },
  slow:      { type: "warning", text: "Your connection seems slow. Data may take a moment to load." },
  timeout:   { type: "warning", text: "The request is taking longer than expected. Please wait…" },
  503:       { type: "error",   text: "The server is temporarily unavailable. Please try again shortly." },
  401:       { type: "error",   text: "Your session has expired. Please log in again." },
  server:    { type: "error",   text: "A server error occurred. Please try again later." },
  generic:   { type: "error",   text: "Something went wrong. Please check your connection and retry." },
}

/*
 * Fire a network-toast custom event.
 * Any component (Toaster, Snackbar, etc.) can subscribe with:
 *   window.addEventListener('network-toast', handler)
 *
 * @param {'error'|'warning'|'info'} type
 * @param {string} text  - Human-readable message
 * @param {string} [key] - Dedup key – prevents the same toast from stacking
 */
function fireToast(type, text, key = text) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("network-toast", {
      detail: { type, text, key, timestamp: Date.now() },
    })
  )
}

function toastForStatus(status) {
  if (status === 401) return fireToast("error",   NETWORK_MESSAGES[401].text,    "auth-401")
  if (status === 503) return fireToast("error",   NETWORK_MESSAGES[503].text,    "server-503")
  if (status >= 500)  return fireToast("error",   NETWORK_MESSAGES.server.text,  `server-${status}`)
}

function toastForNetworkError(error) {
  if (!navigator.onLine) {
    fireToast("error",   NETWORK_MESSAGES.offline.text, "offline")
    return
  }
  // fetch throws TypeError on DNS/connection failures
  if (error instanceof TypeError) {
    fireToast("error", NETWORK_MESSAGES.generic.text, "network-error")
    return
  }
  fireToast("error", error.message || NETWORK_MESSAGES.generic.text, "request-error")
}

// ============================================================================
// SLOW-REQUEST DETECTOR
// Returns a handle; call handle.cancel() once the request finishes normally.
// ============================================================================
function startSlowRequestTimer(endpoint) {
  let cancelled = false
  const timer = setTimeout(() => {
    if (!cancelled) {
      console.warn(`[API] Slow request detected: ${endpoint}`)
      fireToast("warning", NETWORK_MESSAGES.slow.text, "slow-request")
    }
  }, SLOW_REQUEST_THRESHOLD_MS)

  return {
    cancel() {
      cancelled = true
      clearTimeout(timer)
    },
  }
}

// ============================================================================
// ONLINE / OFFLINE GLOBAL LISTENERS (wired up once at module load)
// ============================================================================
if (typeof window !== "undefined") {
  window.addEventListener("offline", () =>
    fireToast("error", NETWORK_MESSAGES.offline.text, "offline")
  )
  window.addEventListener("online", () =>
    fireToast("info", "You're back online.", "online")
  )
}

// ============================================================================
// BASE API SERVICE
// ============================================================================
export class BaseAPIService {
  constructor() {
    this.baseURL = API_ENDPOINTS.public
    this.defaultHeaders = DEFAULT_HEADERS
    this.requestQueue = new Map()
    this.pendingRequests = new Set()
  }

  /**
   * Add sync parameter to URL to ensure data consistency
   */
  addSyncParameter(url) {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}_sync=${Date.now()}`
  }

  refreshDataSync() {
    console.log(`[API] Data sync refreshed: ${Date.now()}`)
  }

  async request(endpoint, options = {}) {
    // Bail immediately if we already know we're offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      fireToast("error", NETWORK_MESSAGES.offline.text, "offline")
      throw new Error("You are offline")
    }

    try {
      const pendingKey = `${options.method || "GET"}_${endpoint}`

      if (this.pendingRequests.has(pendingKey) && options.deduplicate !== false) {
        return await this.waitForPendingRequest(pendingKey)
      }

      this.pendingRequests.add(pendingKey)

      let finalEndpoint = endpoint
      const shouldAddSync =
        options.addSync !== false &&
        (options.method === "GET" || !options.method)

      if (shouldAddSync) {
        finalEndpoint = this.addSyncParameter(endpoint)
      }

      const url = `${this.baseURL}${finalEndpoint}`
      const config = {
        method: "GET",
        headers: { ...this.defaultHeaders },
        ...options,
      }

      const token = getStoredToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // ── Start the slow-request warning timer ─────────────────────────────
      const slowTimer = startSlowRequestTimer(endpoint)

      let response
      try {
        response = await fetch(url, config)
      } finally {
        slowTimer.cancel()   // request finished (success or error) – stop the timer
      }

      // ── HTTP-level errors ─────────────────────────────────────────────────
      if (response.status === 401) {
        console.warn("[API] Authentication failed, clearing tokens")
        clearTokens()
        toastForStatus(401)
        throw new Error("Authentication required")
      }

      if (!response.ok) {
        toastForStatus(response.status)   // 503, 5xx, etc.

        let errorData = {}
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json().catch(() => ({}))
        } else {
          const text = await response.text()
          console.error(
            `[API] Non-JSON error response (${response.status}):`,
            text.substring(0, 200)
          )
          errorData = { error: `Server returned ${response.status} error` }
        }

        if (options.suppressErrors) {
          return { success: false, status: response.status, ...errorData }
        }
        const nestedMessage =
          errorData?.details?.message ||
          errorData?.details?.error ||
          errorData?.details?.details?.message

          throw new Error(errorData.message || nestedMessage || errorData.error || `HTTP ${response.status}`)
      }

      // ── Decrypt if needed ─────────────────────────────────────────────────
      let data = await response.json()

      console.log(`%c🔥 FETCH REQUEST COMPLETED!`, "color: #FF5722; font-weight: bold; font-size: 14px;")
      console.log(`%c📍 URL: ${config.method} ${url}`, "color: #2196F3; font-weight: bold;")
      console.log(`%c📦 Raw Response:`, "color: #9C27B0; font-weight: bold;", data)

      const encryptedCheck = isEncrypted(data)
      if (encryptedCheck && encryptedCheck.encrypted) {
        console.log(`%c🔐 Encrypted response detected - decrypting…`, "color: #FF9800; font-weight: bold;")
        try {
          data = decryptData(encryptedCheck.data)
          console.log(`%c✅ Decryption successful!`, "color: #4CAF50; font-weight: bold;")
          console.log(`%c📦 Decrypted Data:`, "color: #4CAF50; font-weight: bold;", data)
        } catch (decryptError) {
          console.error(`%c❌ Decryption failed:`, "color: #F44336; font-weight: bold;", decryptError)
        }
      } else {
        console.log(`%cℹ️ Plain response (not encrypted)`, "color: #2196F3;")
      }

      this.requestQueue.set(pendingKey, data)
      return data

    } catch (error) {
      const alreadyHandled =
        error.message === "Authentication required" ||
        error.message === "You are offline" ||          // ← we threw this ourselves
        (error.message && error.message.startsWith("HTTP "))

      if (!alreadyHandled) {
        toastForNetworkError(error)
      }
      console.error(`[API] Request failed: ${endpoint}`, error)
      throw error
    } finally {
      this.pendingRequests.delete(`${options.method || "GET"}_${endpoint}`)
    }
  }

  async waitForPendingRequest(pendingKey) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.pendingRequests.has(pendingKey)) {
          clearInterval(checkInterval)
          resolve(this.requestQueue.get(pendingKey))
        }
      }, 50)
    })
  }
}