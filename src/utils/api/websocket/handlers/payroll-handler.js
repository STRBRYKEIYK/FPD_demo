// ============================================================================
// websocket/handlers/payroll-handler.js
// Updated with approval event
// ============================================================================
import { BaseEventHandler } from './base-event-handler.js'

export class PayrollEventHandler extends BaseEventHandler {
  setupHandlers(socket) {
    // Payroll processing events
    socket.on('payroll_processed', (data) => {
      this.log('Payroll processed', data)
      this.notifyListeners('payroll_processed', data)
    })

    socket.on('payroll_created', (data) => {
      this.log('Payroll record created', data)
      this.notifyListeners('payroll_created', data)
    })

    socket.on('payroll_updated', (data) => {
      this.log('Payroll record updated', data)
      this.notifyListeners('payroll_updated', data)
    })

    socket.on('payroll_deleted', (data) => {
      if (data.bulk_delete) {
        this.log(`Payroll bulk deleted: ${data.deleted_count} records`, data)
      } else {
        this.log(`Payroll record deleted: ID ${data.id}`, data)
      }
      this.notifyListeners('payroll_deleted', data)
    })

    // ✅ NEW: Payroll approval event
    socket.on('payroll_approved', (data) => {
      this.log(`✅ Payroll approved: ${data.approved_count} records for ${data.period} (cutoff ${data.cutoff})`, data)
      this.notifyListeners('payroll_approved', data)
    })

    socket.on('payroll_settings_updated', (data) => {
      this.log('Payroll settings updated', data)
      this.notifyListeners('payroll_settings_updated', data)
    })

    socket.on('loan_payment_recorded', (data) => {
      this.log('Loan payment recorded', data)
      this.notifyListeners('loan_payment_recorded', data)
    })
  }
}