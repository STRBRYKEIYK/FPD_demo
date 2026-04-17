// src/utils/pushManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Standalone push subscription helper.
// AuthContext imports ONLY this file — never api-service or BaseAPIService.
// This file lazy-imports api-service only when the push call actually runs,
// well after all modules have fully initialized.
// ─────────────────────────────────────────────────────────────────────────────
import { subscribeToPush, unsubscribeFromPush } from "./pushNotification"
import apiService from "./api/api-service"
/**
 * Subscribe the current user to push notifications and save to server.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {number|string} userId
 */
export function registerPushSubscription(userId) {
  if (!userId) return

  subscribeToPush()
    .then(async (subscription) => {
      if (!subscription) return
      return apiService.push.saveSubscription(userId, subscription)
    })
    .then(result => {
      if (result) console.log("[Push] Subscription saved for user", userId)
    })
    .catch(err => console.warn("[Push] Could not save subscription:", err.message))
}

/**
 * Unsubscribe and remove the stored subscription from the server.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {number|string} userId
 */
export function removePushSubscription(userId) {
  if (!userId) return

  navigator.serviceWorker?.ready
    .then(reg => reg.pushManager.getSubscription())
    .then(async (subscription) => {
      if (!subscription) return
      const endpoint = subscription.endpoint
      await unsubscribeFromPush()
      return apiService.push.deleteSubscription(userId, endpoint)
    })
    .then(result => {
      if (result) console.log("[Push] Subscription removed for user", userId)
    })
    .catch(err => console.warn("[Push] Cleanup failed:", err.message))
}