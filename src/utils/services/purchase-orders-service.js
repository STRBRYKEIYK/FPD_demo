// ============================================================================
// services/purchase-orders-service.js
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"

export class PurchaseOrdersService extends BaseAPIService {
  // GET /api/items/purchase-orders - Retrieve all purchase orders with optional filtering
  async getPurchaseOrders(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/api/items/purchase-orders?${queryParams}`)
  }

  // GET /api/items/purchase-orders/:id - Get a specific purchase order
  async getPurchaseOrder(id) {
    return this.request(`/api/items/purchase-orders/${id}`)
  }

  // POST /api/items/purchase-orders - Create a new purchase order
  async createPurchaseOrder(orderData, options = {}) {
    return this.request("/api/items/purchase-orders", {
      method: "POST",
      body: JSON.stringify(orderData),
      ...options
    })
  }

  // PUT /api/items/purchase-orders/:id/status - Update purchase order status
  async updatePurchaseOrderStatus(id, statusPayload, options = {}) {
    return this.request(`/api/items/purchase-orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusPayload),
      ...options
    })
  }

  // DELETE /api/items/purchase-orders/:id - Delete a purchase order
  async deletePurchaseOrder(id) {
    return this.request(`/api/items/purchase-orders/${id}`, {
      method: "DELETE",
    })
  }

  // GET /api/items/purchase-orders/suppliers - Get list of suppliers
  async getSuppliers(options = {}) {
    const params = new URLSearchParams()
    if (options.lowStock) {
      params.append('low_stock', 'true')
    }
    const query = params.toString()
    return this.request(`/api/items/purchase-orders/suppliers${query ? '?' + query : ''}`)
  }

  // GET /api/items/purchase-orders/generate-prefix - Generate current MMYY prefix
  async generatePOPrefix() {
    return this.request("/api/items/purchase-orders/generate-prefix")
  }

  // GET /api/items/purchase-orders/suggest-number - Get suggested next PO number
  async suggestPONumber() {
    return this.request("/api/items/purchase-orders/suggest-number")
  }

  // GET /api/items/purchase-orders/items-by-supplier - Get items filtered by supplier
  async getItemsBySupplier(supplierName, options = {}) {
    const params = new URLSearchParams({ supplier: supplierName })
    if (options.lowStock) {
      params.append('low_stock', 'true')
    }
    return this.request(`/api/items/purchase-orders/items-by-supplier?${params.toString()}`)
  }

  // GET /api/items/purchase-orders/check/:po_number - Check if PO number exists
  async checkPONumber(poNumber) {
    return this.request(`/api/items/purchase-orders/check/${poNumber}`, { suppressErrors: true })
  }

  // PUT /api/items/purchase-orders/:id - Update (replace) an existing purchase order
  async updatePurchaseOrder(id, orderData, options = {}) {
    return this.request(`/api/items/purchase-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
      ...options
    })
  }

  // GET /api/items/purchase-orders/:poId/items - Get all items for a specific PO
  // Joins purchase_order_items with items table to get brand
  // Returns mapped material rows ready for the PDF export materials table
  async getPurchaseOrderMaterials(poId) {
    return this.request(`/api/items/purchase-orders/${poId}/items`)
  }

  async getLatestPOForItem(itemNo) {
    return this.request(`/api/items/purchase-orders/item/${itemNo}/latest-po`)
  }
}