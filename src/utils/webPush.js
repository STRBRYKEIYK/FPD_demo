// ingestion-service/src/utils/webPush.js
import webpush from "web-push"

webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function sendPushToUsers(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        sub.subscription,           // the subscription object saved from browser
        JSON.stringify(payload)     // this is what service-worker.js receives
      )
    )
  )

  // Log failures (expired subscriptions, etc.)
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[Push] Failed for subscription ${i}:`, r.reason?.statusCode)
      // If 410 Gone — subscription expired, delete it from DB
      if (r.reason?.statusCode === 410) {
        deleteSubscriptionFromDB(subscriptions[i].id)
      }
    }
  })
}