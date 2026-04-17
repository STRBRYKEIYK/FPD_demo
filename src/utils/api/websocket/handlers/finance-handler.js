// ============================================================================
// websocket/handlers/finance-handler.js
// Real-time finance event handler
// ============================================================================
import { BaseEventHandler } from './base-event-handler.js'
import { SOCKET_EVENTS } from '../constants/events.js'

export class FinanceEventHandler extends BaseEventHandler {
  setupHandlers(socket) {
    // Customer events
    socket.on(SOCKET_EVENTS.FINANCE.CUSTOMER_CREATED, (data) => {
      this.handleCustomerCreated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.CUSTOMER_UPDATED, (data) => {
      this.handleCustomerUpdated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.CUSTOMER_DELETED, (data) => {
      this.handleCustomerDeleted(data)
    })

    // Invoice events
    socket.on(SOCKET_EVENTS.FINANCE.INVOICE_CREATED, (data) => {
      this.handleInvoiceCreated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.INVOICE_UPDATED, (data) => {
      this.handleInvoiceUpdated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.INVOICE_DELETED, (data) => {
      this.handleInvoiceDeleted(data)
    })

    // Expense events
    socket.on(SOCKET_EVENTS.FINANCE.EXPENSE_CREATED, (data) => {
      this.handleExpenseCreated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.EXPENSE_UPDATED, (data) => {
      this.handleExpenseUpdated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.EXPENSE_DELETED, (data) => {
      this.handleExpenseDeleted(data)
    })

    // Voucher events
    socket.on(SOCKET_EVENTS.FINANCE.VOUCHER_CREATED, (data) => {
      this.handleVoucherCreated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.VOUCHER_UPDATED, (data) => {
      this.handleVoucherUpdated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.VOUCHER_DELETED, (data) => {
      this.handleVoucherDeleted(data)
    })

    // Vale events
    socket.on(SOCKET_EVENTS.FINANCE.VALE_CREATED, (data) => {
      this.handleValeCreated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.VALE_UPDATED, (data) => {
      this.handleValeUpdated(data)
    })

    socket.on(SOCKET_EVENTS.FINANCE.VALE_DELETED, (data) => {
      this.handleValeDeleted(data)
    })

    this.log('Finance event handlers registered')
  }

  // Customer handlers
  handleCustomerCreated(data) {
    this.log('Customer created', data)
    this.notifyListeners('finance:customer_created', data)
    this.notifyListeners('finance:refresh', { type: 'customer_created' })
  }

  handleCustomerUpdated(data) {
    this.log('Customer updated', data)
    this.notifyListeners('finance:customer_updated', data)
    this.notifyListeners('finance:refresh', { type: 'customer_updated' })
  }

  handleCustomerDeleted(data) {
    this.log('Customer deleted', data)
    this.notifyListeners('finance:customer_deleted', data)
    this.notifyListeners('finance:refresh', { type: 'customer_deleted' })
  }

  // Invoice handlers
  handleInvoiceCreated(data) {
    this.log('Invoice created', data)
    this.notifyListeners('finance:invoice_created', data)
    this.notifyListeners('finance:refresh', { type: 'invoice_created' })
  }

  handleInvoiceUpdated(data) {
    this.log('Invoice updated', data)
    this.notifyListeners('finance:invoice_updated', data)
    this.notifyListeners('finance:refresh', { type: 'invoice_updated' })
  }

  handleInvoiceDeleted(data) {
    this.log('Invoice deleted', data)
    this.notifyListeners('finance:invoice_deleted', data)
    this.notifyListeners('finance:refresh', { type: 'invoice_deleted' })
  }

  // Expense handlers
  handleExpenseCreated(data) {
    this.log('Expense created', data)
    this.notifyListeners('finance:expense_created', data)
    this.notifyListeners('finance:refresh', { type: 'expense_created' })
  }

  handleExpenseUpdated(data) {
    this.log('Expense updated', data)
    this.notifyListeners('finance:expense_updated', data)
    this.notifyListeners('finance:refresh', { type: 'expense_updated' })
  }

  handleExpenseDeleted(data) {
    this.log('Expense deleted', data)
    this.notifyListeners('finance:expense_deleted', data)
    this.notifyListeners('finance:refresh', { type: 'expense_deleted' })
  }

  // Voucher handlers
  handleVoucherCreated(data) {
    this.log('Voucher created', data)
    this.notifyListeners('finance:voucher_created', data)
    this.notifyListeners('finance:refresh', { type: 'voucher_created' })
  }

  handleVoucherUpdated(data) {
    this.log('Voucher updated', data)
    this.notifyListeners('finance:voucher_updated', data)
    this.notifyListeners('finance:refresh', { type: 'voucher_updated' })
  }

  handleVoucherDeleted(data) {
    this.log('Voucher deleted', data)
    this.notifyListeners('finance:voucher_deleted', data)
    this.notifyListeners('finance:refresh', { type: 'voucher_deleted' })
  }

  // Vale handlers
  handleValeCreated(data) {
    this.log('Vale created', data)
    this.notifyListeners('finance:vale_created', data)
    this.notifyListeners('finance:refresh', { type: 'vale_created' })
  }

  handleValeUpdated(data) {
    this.log('Vale updated', data)
    this.notifyListeners('finance:vale_updated', data)
    this.notifyListeners('finance:refresh', { type: 'vale_updated' })
  }

  handleValeDeleted(data) {
    this.log('Vale deleted', data)
    this.notifyListeners('finance:vale_deleted', data)
    this.notifyListeners('finance:refresh', { type: 'vale_deleted' })
  }
}
