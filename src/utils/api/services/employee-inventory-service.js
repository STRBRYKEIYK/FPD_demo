// services/employee-inventory-service.js
import { BaseAPIService } from "../core/base-api.js"

export class EmployeeInventoryService extends BaseAPIService {
  constructor() {
    super()
    this.endpoint = "/api/employee-inventory"
  }

  // ============================================================================
  // GET Operations
  // ============================================================================

  /**
   * Get all checkouts with filtering and pagination
   */
  async getAllCheckouts(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      include_completed: params.includeCompleted || "false",
      ...(params.status && { status: params.status }),
      ...(params.employee_uid && { employee_uid: params.employee_uid }),
      ...(params.date_from && { date_from: params.date_from }),
      ...(params.date_to && { date_to: params.date_to }),
      ...(params.search && { search: params.search }),
    })

    return this.request(`${this.endpoint}?${queryParams}`)
  }

  /**
   * Get single checkout by ID
   */
  async getCheckoutById(id) {
    return this.request(`${this.endpoint}/${id}`)
  }

  /**
   * Get checkout by tracking ID
   */
  async getByTrackingId(trackingId) {
    return this.request(`${this.endpoint}/tracking/${trackingId}`)
  }

  /**
   * Get all checkouts for specific employee
   */
  async getEmployeeInventory(employeeUid, params = {}) {
    const queryParams = new URLSearchParams({
      include_completed: params.includeCompleted || "false",
      ...(params.status && { status: params.status }),
    })

    return this.request(`${this.endpoint}/employee/${employeeUid}?${queryParams}`)
  }

  /**
   * Get all active checkouts (not completed)
   */
  async getActiveCheckouts() {
    return this.request(`${this.endpoint}/active`)
  }

  /**
   * Get inventory statistics
   */
  async getStatistics() {
    return this.request(`${this.endpoint}/statistics`)
  }

  // ============================================================================
  // POST Operations
  // ============================================================================

  /**
   * Create new checkout
   */
  async createCheckout(checkoutData) {
    const requiredFields = [
      "employee_uid", 
      "employee_barcode", 
      "employee_name", 
      "material_name", 
      "quantity_checked_out"
    ]

    for (const field of requiredFields) {
      if (!checkoutData[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    return this.request(`${this.endpoint}/checkout`, {
      method: "POST",
      body: JSON.stringify(checkoutData),
    })
  }

  /**
   * Bulk checkout multiple items
   */
  async bulkCheckout(checkouts, checkoutBy = null) {
    if (!Array.isArray(checkouts) || checkouts.length === 0) {
      throw new Error("Checkouts array is required and must not be empty")
    }

    return this.request(`${this.endpoint}/bulk-checkout`, {
      method: "POST",
      body: JSON.stringify({
        checkouts,
        checkout_by: checkoutBy,
      }),
    })
  }

  /**
   * Mark quantity as used (consumed)
   */
  async markAsUsed(checkoutId, quantityUsed, notes = null) {
    if (!quantityUsed || quantityUsed <= 0) {
      throw new Error("Valid quantity is required")
    }

    return this.request(`${this.endpoint}/mark-used/${checkoutId}`, {
      method: "POST",
      body: JSON.stringify({
        quantity_used: quantityUsed,
        notes,
      }),
    })
  }

  /**
   * Complete project - marks all related checkouts as completed
   */
  async completeProject(projectIdentifier, notes = null) {
    return this.request(`${this.endpoint}/complete-project/${projectIdentifier}`, {
      method: "POST",
      body: JSON.stringify({
        notes: notes || `Project ${projectIdentifier} completed`,
      }),
    })
  }

  // ============================================================================
  // PUT Operations
  // ============================================================================

  /**
   * Update checkout details
   */
  async updateCheckout(checkoutId, updateData) {
    const allowedFields = ["purpose", "project_name", "checkout_notes"]

    const filteredData = {}
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field]
      }
    }

    if (Object.keys(filteredData).length === 0) {
      throw new Error("No valid fields to update")
    }

    return this.request(`${this.endpoint}/${checkoutId}`, {
      method: "PUT",
      body: JSON.stringify(filteredData),
    })
  }

  // ============================================================================
  // DELETE Operations
  // ============================================================================

  /**
   * Delete checkout
   */
  async deleteCheckout(checkoutId) {
    return this.request(`${this.endpoint}/${checkoutId}`, {
      method: "DELETE",
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate remaining quantity
   */
  calculateRemaining(checkout) {
    return checkout.quantity_checked_out - checkout.quantity_used
  }

  /**
   * Calculate usage percentage
   */
  calculateUsagePercentage(checkout) {
    if (checkout.quantity_checked_out === 0) return 0
    return (checkout.quantity_used / checkout.quantity_checked_out) * 100
  }

  /**
   * Format checkout status for display
   */
  formatStatus(status) {
    const statusMap = {
      active: "Active",
      used: "Used",
      completed: "Completed"
    }

    return statusMap[status] || status
  }

  /**
   * Get status color class
   */
  getStatusColor(status) {
    const colorMap = {
      active: "blue",
      used: "green",
      completed: "gray"
    }

    return colorMap[status] || "gray"
  }

  /**
   * Validate checkout data before submission
   */
  validateCheckoutData(data) {
    const errors = []

    if (!data.employee_uid) errors.push("Employee UID is required")
    if (!data.employee_barcode) errors.push("Employee barcode is required")
    if (!data.employee_name) errors.push("Employee name is required")
    if (!data.material_name) errors.push("Material name is required")
    if (!data.quantity_checked_out || data.quantity_checked_out <= 0) {
      errors.push("Valid quantity is required")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Generate checkout report data
   */
  generateReportData(checkouts) {
    const report = {
      total_checkouts: checkouts.length,
      total_quantity_issued: checkouts.reduce((sum, c) => sum + parseFloat(c.quantity_checked_out || 0), 0),
      total_quantity_used: checkouts.reduce((sum, c) => sum + parseFloat(c.quantity_used || 0), 0),
      active_count: checkouts.filter((c) => !c.is_completed).length,
      completed_count: checkouts.filter((c) => c.is_completed).length,
      by_status: {},
      by_employee: {},
      by_material: {},
      by_project: {}
    }

    // Group by status
    checkouts.forEach((checkout) => {
      report.by_status[checkout.status] = (report.by_status[checkout.status] || 0) + 1
    })

    // Group by employee
    checkouts.forEach((checkout) => {
      if (!report.by_employee[checkout.employee_name]) {
        report.by_employee[checkout.employee_name] = {
          count: 0,
          total_quantity: 0,
          total_used: 0
        }
      }
      report.by_employee[checkout.employee_name].count++
      report.by_employee[checkout.employee_name].total_quantity += parseFloat(checkout.quantity_checked_out || 0)
      report.by_employee[checkout.employee_name].total_used += parseFloat(checkout.quantity_used || 0)
    })

    // Group by material
    checkouts.forEach((checkout) => {
      if (!report.by_material[checkout.material_name]) {
        report.by_material[checkout.material_name] = {
          count: 0,
          total_quantity: 0,
          total_used: 0
        }
      }
      report.by_material[checkout.material_name].count++
      report.by_material[checkout.material_name].total_quantity += parseFloat(checkout.quantity_checked_out || 0)
      report.by_material[checkout.material_name].total_used += parseFloat(checkout.quantity_used || 0)
    })

    // Group by project
    checkouts.forEach((checkout) => {
      if (checkout.project_name) {
        if (!report.by_project[checkout.project_name]) {
          report.by_project[checkout.project_name] = {
            count: 0,
            total_quantity: 0,
            total_used: 0
          }
        }
        report.by_project[checkout.project_name].count++
        report.by_project[checkout.project_name].total_quantity += parseFloat(checkout.quantity_checked_out || 0)
        report.by_project[checkout.project_name].total_used += parseFloat(checkout.quantity_used || 0)
      }
    })

    return report
  }

  /**
   * Export checkouts to CSV
   */
  exportToCSV(checkouts, filename = "employee_inventory_checkouts.csv") {
    const headers = [
      "Tracking ID",
      "Employee",
      "Barcode",
      "Material",
      "Qty Checked Out",
      "Qty Used",
      "Remaining",
      "Unit",
      "Status",
      "Checkout Date",
      "Project",
      "Purpose"
    ]

    const rows = checkouts.map((c) => [
      c.tracking_id,
      c.employee_name,
      c.employee_barcode,
      c.material_name,
      c.quantity_checked_out,
      c.quantity_used,
      this.calculateRemaining(c),
      c.unit_of_measure,
      this.formatStatus(c.status),
      new Date(c.checkout_date).toLocaleDateString(),
      c.project_name || "N/A",
      c.purpose || ""
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  /**
   * Format tracking ID for display
   */
  formatTrackingId(trackingId) {
    // Example: 12345-20250115-143025 -> 12345 (Jan 15, 2025 14:30:25)
    const parts = trackingId.split('-')
    if (parts.length < 3) return trackingId
    
    const itemNo = parts[0]
    const datePart = parts[1]
    const timePart = parts[2]
    
    const year = datePart.substring(0, 4)
    const month = datePart.substring(4, 6)
    const day = datePart.substring(6, 8)
    
    const hour = timePart.substring(0, 2)
    const minute = timePart.substring(2, 4)
    const second = timePart.substring(4, 6)
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
    
    return `${itemNo} (${date.toLocaleString()})`
  }
}

// Create singleton instance
export const employeeInventoryService = new EmployeeInventoryService()