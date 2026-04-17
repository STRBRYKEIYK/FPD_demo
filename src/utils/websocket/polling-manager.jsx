// ============================================================================
// websocket/polling-manager.jsx
// ============================================================================
import { getStoredToken } from '../../auth.js'
import { API_ENDPOINTS } from '../config/api-config.js'
import { SOCKET_EVENTS } from './constants/events.js'
import { ListenerManager } from './managers/listener-manager.js'
import { InventoryEventHandler } from './handlers/inventory-handler.js'
import { ProcurementEventHandler } from './handlers/procurement-handler.js'
import { OperationsEventHandler } from './handlers/operations-handler.js'
import { FinanceEventHandler } from './handlers/finance-handler.js'
import { PayrollEventHandler } from './handlers/payroll-handler.js'

export class PollingManager {
  constructor() {
    this.listenerManager   = new ListenerManager()
    this.eventHandlers     = []
    this.pollingTimeout    = null
    this.pollingInterval   = null
    this.isPolling         = false
    this.pollingRate       = 15000
    this.errorCount        = 0
    this.rooms             = new Set()
    this.connectionState   = 'disconnected'
    this.processedEventIds = new Set()
    this._initialized      = false

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this._pausePolling()
        } else {
          this._resumePolling()
        }
      })
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  initialize() {
    if (this._initialized) {
      return this
    }
    this._initialized = true
    this.setupEventHandlers()
    this.startPolling()
    return this
  }

  setupEventHandlers() {
    const mockSocket = this.createMockSocketInterface()

    this.eventHandlers = [
      new InventoryEventHandler(this),
      new ProcurementEventHandler(this),
      new OperationsEventHandler(this),
      new FinanceEventHandler(this),
      new PayrollEventHandler(this),
    ]

    this.eventHandlers.forEach(handler => {
      handler.setupHandlers(mockSocket)
    })
  }

  createMockSocketInterface() {
    const internalHandlers = new Map()

    return {
      on: (event, callback) => {
        if (!internalHandlers.has(event)) {
          internalHandlers.set(event, [])
        }
        internalHandlers.get(event).push(callback)
        this._internalHandlers = internalHandlers
      },
      emit: () => {},
      connected: true,
      id: 'polling-' + Date.now()
    }
  }

  // ── Polling core ────────────────────────────────────────────────────────────

  async startPolling() {
    if (this.isPolling || this.pollingTimeout) return
    this.isPolling = true

    await this.poll()
    this.scheduleNextPoll()
  }

  scheduleNextPoll() {
    if (!this.isPolling) return

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout)
      this.pollingTimeout = null
    }

    this.pollingTimeout = setTimeout(async () => {
      await this.poll()
      this.scheduleNextPoll()
    }, this.pollingRate)
  }

  _pausePolling() {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout)
      this.pollingTimeout = null
    }
  }

  _resumePolling() {
    if (this.isPolling && !this.pollingTimeout) {
      this.scheduleNextPoll()
    }
  }

  async poll() {
    if (typeof document !== 'undefined' && document.hidden) return

    try {
      // ✅ Clean route — no action param needed
      const url = new URL(`${API_ENDPOINTS.public}/api/events/poll`)
      url.searchParams.append('since', this.lastTimestamp ?? 0)

      // ✅ No Authorization header — bypassed in index.php, not needed here
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.events && data.events.length > 0) {
        data.events.forEach(event => {
          if (!this.processedEventIds.has(event.id)) {
            this.processedEventIds.add(event.id)
            this.handleIncomingEvent(event)
          }
        })

        this.lastTimestamp = data.timestamp

        if (this.processedEventIds.size > 200) {
          const idsArray = Array.from(this.processedEventIds)
          this.processedEventIds = new Set(idsArray.slice(-200))
        }
      }

      // ── Success: reset backoff ───────────────────────────────────────────
      this.errorCount  = 0
      this.pollingRate = 15000

      if (this.connectionState !== 'connected') {
        this.connectionState = 'connected'
        this.notifyListeners('connection', { status: 'connected' })
      }

    } catch (error) {
      console.error('Polling error:', error)

      // ── Backoff: 5s → 10s → 20s → 40s → max 60s ────────────────────────
      this.errorCount++
      this.pollingRate = Math.min(5000 * Math.pow(2, this.errorCount - 1), 60000)
      console.warn(`Polling backed off to ${this.pollingRate / 1000}s (error #${this.errorCount})`)

      if (this.connectionState !== 'error') {
        this.connectionState = 'error'
        this.notifyListeners('connection', { status: 'error', error })
      }
    }
  }

  stopPolling() {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout)
      this.pollingTimeout = null
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
    this.isPolling = false
    this.connectionState = 'disconnected'
    this.notifyListeners('connection', { status: 'disconnected' })
  }

  // ── Event handling ──────────────────────────────────────────────────────────

  handleIncomingEvent(event) {
    if (this._internalHandlers && this._internalHandlers.has(event.event)) {
      this._internalHandlers.get(event.event).forEach(handler => {
        try {
          handler(event.data)
        } catch (e) {
          console.error(`Error in handler for ${event.event}:`, e)
        }
      })
    }

    this.notifyListeners(event.event, event.data)
    this.notifyListeners('event', event)
  }

  // ── Room management ─────────────────────────────────────────────────────────

  joinRoom(room) {
    this.rooms.add(room)
  }

  joinAllRooms() {
    [
      'employees',
      'departments',
      'auth',
      'daily-summary',
      'attendance',
      'operations',
      'finance'
    ].forEach(room => this.joinRoom(room))
  }

  leaveRoom(room) {
    this.rooms.delete(room)
  }

  // ── Listener management ─────────────────────────────────────────────────────

  subscribeToUpdates(event, callback) {
    return this.listenerManager.subscribe(event, callback)
  }

  notifyListeners(event, data) {
    this.listenerManager.notify(event, data)
  }

  unsubscribe(unsubscribeFn) {
    if (typeof unsubscribeFn === 'function') unsubscribeFn()
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  ping() {
    this.poll()
  }

  disconnect() {
    this.stopPolling()
    this.listenerManager.clear()
    this.eventHandlers     = []
    this.rooms.clear()
    this.lastTimestamp     = 0
    this.processedEventIds.clear()
    this.errorCount        = 0
    this._initialized      = false
  }

  get isConnected() {
    return this.connectionState === 'connected'
  }

  getListenerCount(event) {
    return this.listenerManager.getListenerCount(event)
  }

  getAllSubscribedEvents() {
    return this.listenerManager.getAllEvents()
  }

  setPollingRate(milliseconds) {
    this.pollingRate = milliseconds
    if (this.isPolling) {
      if (this.pollingTimeout) {
        clearTimeout(this.pollingTimeout)
        this.pollingTimeout = null
      }
      this.scheduleNextPoll()
    }
  }
}

// Export singleton instance
export const pollingManager = new PollingManager()