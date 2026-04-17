// services/checkout-requests-service.js
// Manages operations_checkout_requests table.
// This is for PENDING requests only — no stock deduction happens here.
// Warehouse confirms via approveRequest() which moves data to operations_employee_inventory.

import { BaseAPIService } from "../core/base-api.js";

export class CheckoutRequestsService extends BaseAPIService {
  constructor() {
    super();
    this.endpoint = "/api/checkout-requests";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all checkout requests with optional filters.
   * @param {Object} params
   * @param {'pending'|'approved'|'rejected'|undefined} params.status
   * @param {number}  [params.employee_uid]
   * @param {string}  [params.search]
   * @param {string}  [params.date_from]   YYYY-MM-DD
   * @param {string}  [params.date_to]     YYYY-MM-DD
   * @param {number}  [params.limit]
   * @param {number}  [params.offset]
   */
  async getRequests(params = {}) {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    ).toString();
    return this.request(`${this.endpoint}${q ? `?${q}` : ""}`);
  }

  /** Get only pending requests — shorthand used by warehouse UI */
  async getPendingRequests(params = {}) {
    return this.getRequests({ ...params, status: "pending" });
  }

  /**
   * Get a single request by ID.
   * @param {number} id
   */
  async getRequest(id) {
    return this.request(`${this.endpoint}/${id}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST — create
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a single checkout request (no stock deducted).
   * @param {Object} data
   * @param {number}  data.employee_uid
   * @param {string}  data.employee_barcode
   * @param {string}  data.employee_name
   * @param {string}  data.material_name
   * @param {number}  data.quantity_requested
   * @param {string}  [data.unit_of_measure]  default 'pcs'
   * @param {string}  [data.item_no]          real item_no for later deduction
   * @param {string}  [data.item_description]
   * @param {string}  [data.purpose]
   * @param {string}  [data.project_name]
   * @param {number}  [data.job_order_id]
   * @param {string}  [data.request_notes]
   */
  async createRequest(data) {
    const required = ["employee_uid", "employee_barcode", "employee_name", "material_name", "quantity_requested"];
    for (const f of required) {
      if (!data[f] && data[f] !== 0) throw new Error(`Missing required field: ${f}`);
    }
    return this.request(this.endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Bulk-create multiple requests in one call (all for the same employee checkout session).
   * @param {Array<Object>} requests  — each item matches createRequest() shape
   */
  async bulkCreateRequests(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error("requests array is required and must not be empty");
    }
    return this.request(`${this.endpoint}/bulk`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST — warehouse actions
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Approve a pending request.
   * Backend will:
   *   1. Deduct stock from itemsdb (if item_no is set)
   *   2. Insert a confirmed record into operations_employee_inventory
   *   3. Mark this request as 'approved'
   *
   * @param {number} id            — request ID
   * @param {Object} [meta]
   * @param {string} [meta.processed_by]  — warehouse staff name / "Warehouse"
   * @param {string} [meta.notes]         — optional confirmation note
   */
  async approveRequest(id, meta = {}) {
    return this.request(`${this.endpoint}/approve/${id}`, {
      method: "POST",
      body: JSON.stringify(meta),
    });
  }

  /**
   * Reject a pending request.
   * No stock movement occurs.
   *
   * @param {number} id
   * @param {Object} [meta]
   * @param {string} [meta.processed_by]
   * @param {string} [meta.reason]
   */
  async rejectRequest(id, meta = {}) {
    return this.request(`${this.endpoint}/reject/${id}`, {
      method: "POST",
      body: JSON.stringify(meta),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Update a pending request (only while still pending).
   * @param {number} id
   * @param {Object} data  — allowed: purpose, project_name, request_notes, quantity_requested, unit_of_measure
   */
  async updateRequest(id, data) {
    const allowed = ["purpose", "project_name", "request_notes", "quantity_requested", "unit_of_measure"];
    const payload = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(payload).length) throw new Error("No valid fields to update");
    return this.request(`${this.endpoint}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Delete (cancel) a checkout request.
   * @param {number} id
   */
  async deleteRequest(id) {
    return this.request(`${this.endpoint}/${id}`, { method: "DELETE" });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────

  /** Format request status for display */
  formatStatus(status) {
    return { pending: "Pending", approved: "Approved", rejected: "Rejected" }[status] ?? status;
  }

  /** Get status badge colour key */
  getStatusColor(status) {
    return { pending: "amber", approved: "green", rejected: "red" }[status] ?? "gray";
  }
}

export default CheckoutRequestsService;