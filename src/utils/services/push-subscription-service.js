// src/services/push-subscription-service.js
import { BaseAPIService } from "../core/base-api.js"

export class PushSubscriptionService extends BaseAPIService {
  /**
   * Save (upsert) a push subscription for the logged-in user.
   * Call this right after subscribeToPush() succeeds on login.
   *
   * @param {number|string} userId       - The logged-in employee's uid
   * @param {PushSubscription} subscription - Object returned by subscribeToPush()
   * @returns {Promise} Success confirmation
   */
  async saveSubscription(userId, subscription) {
    return this.request("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON(),
      }),
    })
  }

  /**
   * Remove a push subscription.
   * Call this on logout or when the user manually opts out of notifications.
   *
   * @param {number|string} userId  - The employee's uid
   * @param {string}        endpoint - subscription.endpoint
   * @returns {Promise} Success confirmation
   */
  async deleteSubscription(userId, endpoint) {
    return this.request("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ userId, endpoint }),
    })
  }

  /**
   * Fetch all active subscriptions for a user.
   * Primarily used server-side by the Node ingestion service,
   * but exposed here in case the frontend ever needs it.
   *
   * @param {number|string} userId
   * @returns {Promise} { userId, subscriptions, count }
   */
  async getSubscriptions(userId) {
    return this.request(`/api/push/subscriptions?userId=${userId}`)
  }
}