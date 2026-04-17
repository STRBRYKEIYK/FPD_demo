// ============================================================================
// websocket/handlers/monthly-bills-handler.js
// Real-time monthly bills event handler
// ============================================================================
import { BaseEventHandler } from './base-event-handler.js'
import { SOCKET_EVENTS } from '../constants/events.js'

export class MonthlyBillsEventHandler extends BaseEventHandler {
  setupHandlers(socket) {
    // Vendor events
    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.VENDOR_CREATED, (data) => {
      this.handleVendorCreated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.VENDOR_UPDATED, (data) => {
      this.handleVendorUpdated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.VENDOR_DELETED, (data) => {
      this.handleVendorDeleted(data)
    })

    // Bill events
    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.BILL_CREATED, (data) => {
      this.handleBillCreated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.BILL_UPDATED, (data) => {
      this.handleBillUpdated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.BILL_DELETED, (data) => {
      this.handleBillDeleted(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.PAYMENT_RECORDED, (data) => {
      this.handlePaymentRecorded(data)
    })

    // Bill item events
    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.ITEM_CREATED, (data) => {
      this.handleItemCreated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.ITEM_UPDATED, (data) => {
      this.handleItemUpdated(data)
    })

    socket.on(SOCKET_EVENTS.MONTHLY_BILLS.ITEM_DELETED, (data) => {
      this.handleItemDeleted(data)
    })

    this.log('Monthly Bills event handlers registered')
  }

  // Vendor handlers
  handleVendorCreated(data) {
    this.log('Vendor created', data)
    this.notifyListeners('monthly_bills:vendor_created', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'vendor_created' })
  }

  handleVendorUpdated(data) {
    this.log('Vendor updated', data)
    this.notifyListeners('monthly_bills:vendor_updated', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'vendor_updated' })
  }

  handleVendorDeleted(data) {
    this.log('Vendor deleted', data)
    this.notifyListeners('monthly_bills:vendor_deleted', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'vendor_deleted' })
  }

  // Bill handlers
  handleBillCreated(data) {
    this.log('Bill created', data)
    this.notifyListeners('monthly_bills:bill_created', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'bill_created' })
  }

  handleBillUpdated(data) {
    this.log('Bill updated', data)
    this.notifyListeners('monthly_bills:bill_updated', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'bill_updated' })
  }

  handleBillDeleted(data) {
    this.log('Bill deleted', data)
    this.notifyListeners('monthly_bills:bill_deleted', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'bill_deleted' })
  }

  handlePaymentRecorded(data) {
    this.log('Payment recorded', data)
    this.notifyListeners('monthly_bills:payment_recorded', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'payment_recorded' })
  }

  // Bill item handlers
  handleItemCreated(data) {
    this.log('Bill item created', data)
    this.notifyListeners('monthly_bills:item_created', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'item_created' })
  }

  handleItemUpdated(data) {
    this.log('Bill item updated', data)
    this.notifyListeners('monthly_bills:item_updated', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'item_updated' })
  }

  handleItemDeleted(data) {
    this.log('Bill item deleted', data)
    this.notifyListeners('monthly_bills:item_deleted', data)
    this.notifyListeners('monthly_bills:refresh', { type: 'item_deleted' })
  }
}
