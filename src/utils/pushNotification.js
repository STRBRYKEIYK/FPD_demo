// src/utils/pushNotification.js

const VAPID_PUBLIC_KEY = 'BCMrryOzEuXByLjPb4y_jMk37t8HGdYX6shEFpkNMLNqosAdoekUOaVpVPxhLgFxpPRgfB0qcWmK16DkyY1zXlQ'

// ─── Convert VAPID key ────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// ─── Request permission ───────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("[Push] Notifications not supported in this browser.")
    return false
  }
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") {
    console.warn("[Push] Notifications blocked. User must enable in browser settings.")
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === "granted"
}

// ─── Get or create push subscription ─────────────────────────────────────────
export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Push] Push not supported in this browser.")
    return null
  }

  // iOS Safari requires the app to be installed as a PWA
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.navigator.standalone === true  // installed as PWA
  
  if (isIOS && !isStandalone) {
    console.warn("[Push] iOS requires app to be installed as PWA for push notifications.")
    // Optionally show a prompt telling the user to install the app
    return null
  }

  const granted = await requestNotificationPermission()
  if (!granted) return null

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (subscription) return subscription

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    return subscription
  } catch (err) {
    console.error("[Push] Failed to subscribe:", err)
    return null
  }
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
    return true
  } catch (err) {
    console.error("[Push] Failed to unsubscribe:", err)
    return false
  }
}

// ─── Check current permission state ──────────────────────────────────────────
export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported"
  return Notification.permission // "default" | "granted" | "denied"
}

// ─── Show notification via Service Worker (no server needed) ─────────────────
export async function showLocalNotification({ title, body, icon, url = "/" }) {
  if (!("serviceWorker" in navigator)) return
  if (Notification.permission !== "granted") return

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      body,
      icon:  icon  || "/icons/icon-192.jpg",
      badge:        "/icons/icon-192.jpg",
      data: { url },
      tag:  `jjc-${Date.now()}`,
    })
  } catch (err) {
    console.error("[Push] showLocalNotification failed:", err)
  }
}