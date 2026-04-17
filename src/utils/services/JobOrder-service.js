// ============================================================================
// services/job-order-service.js
// — multi-employee assignments with per-employee date ranges
// — operation materials
// — PDF export materials persistence (saveExportMaterials, getLatestExportMaterials, getAllExportBatches)
// ============================================================================

import { BaseAPIService } from "../core/base-api.js";

export class JobOrderService extends BaseAPIService {

  // ── JOB ORDERS ─────────────────────────────────────────────────────────────

  async getJobOrders(params = {}) {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    ).toString();
    return this.request(`/api/job-orders${q ? `?${q}` : ""}`);
  }

  async getJobOrder(id) {
    return this.request(`/api/job-orders?id=${id}`);
  }

  async createJobOrder(data) {
    if (!data.description?.trim()) throw new Error("Description is required");
    return this.request("/api/job-orders", {
      method: "POST",
      body: JSON.stringify({
        jo_number:     data.jo_number     || null,
        description:   data.description.trim(),
        customer:      data.customer      || null,
        date_received: data.date_received || null,
        status:        "open",
      }),
    });
  }

  async updateJobOrder(id, data) {
    return this.request(`/api/job-orders?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteJobOrder(id) {
    return this.request(`/api/job-orders?id=${id}`, { method: "DELETE" });
  }


  // ── JOB OPERATIONS ─────────────────────────────────────────────────────────

  async getOperations(jobOrderId) {
    return this.request(`/api/job-operations?job_order_id=${jobOrderId}`);
  }

  async createOperation(data) {
    if (!data.job_order_id) throw new Error("job_order_id is required");
    if (!data.name?.trim()) throw new Error("Operation name is required");
    return this.request("/api/job-operations", {
      method: "POST",
      body: JSON.stringify({
        job_order_id:    data.job_order_id,
        name:            data.name.trim(),
        employee_ids:    Array.isArray(data.employee_ids)
                           ? data.employee_ids.map(Number).filter(Boolean) : [],
        employee_ranges: Array.isArray(data.employee_ranges) ? data.employee_ranges : [],
        sort_order:      data.sort_order     || 0,
        expected_hours:  data.expected_hours != null ? parseFloat(data.expected_hours) : null,
        remarks:         data.remarks        || null,
        materials:       Array.isArray(data.materials)
                           ? data.materials.filter(m => m.name?.trim()).map(m => ({
                               item_no:  m.item_no  || null,
                               name:     m.name.trim(),
                               quantity: parseFloat(m.quantity) || 1,
                               unit:     m.unit || "pcs",
                               notes:    m.notes || "",
                             }))
                           : [],
      }),
    });
  }

  async updateOperation(id, data) {
    const payload = {};
    if (data.name            !== undefined) payload.name            = data.name;
    if (data.employee_ids    !== undefined) payload.employee_ids    = Array.isArray(data.employee_ids) ? data.employee_ids.map(Number).filter(Boolean) : [];
    if (data.employee_ranges !== undefined) payload.employee_ranges = Array.isArray(data.employee_ranges) ? data.employee_ranges : [];
    if (data.sort_order      !== undefined) payload.sort_order      = data.sort_order;
    if (data.expected_hours  !== undefined) payload.expected_hours  = data.expected_hours;
    if (data.remarks         !== undefined) payload.remarks         = data.remarks;
    if (data.materials       !== undefined) payload.materials =
        Array.isArray(data.materials)
          ? data.materials.filter(m => m.name?.trim()).map(m => ({
              item_no:  m.item_no  || null,
              name:     m.name.trim(),
              quantity: parseFloat(m.quantity) || 1,
              unit:     m.unit || "pcs",
              notes:    m.notes || "",
            }))
          : [];
    return this.request(`/api/job-operations?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async toggleOperationComplete(id, completed) {
    return this.request(`/api/job-operations/complete?id=${id}`, {
      method: "POST",
      body: JSON.stringify({ completed }),
    });
  }

  async deleteOperation(id) {
    return this.request(`/api/job-operations?id=${id}`, { method: "DELETE" });
  }


  // ── OPERATION SHIFTS ───────────────────────────────────────────────────────

  async createShift(data) {
    if (!data.operation_id)   throw new Error("operation_id is required");
    if (!data.shift_date)     throw new Error("shift_date is required");
    if (!data.hours_rendered) throw new Error("hours_rendered is required");
    return this.request("/api/operation-shifts", {
      method: "POST",
      body: JSON.stringify({
        operation_id:   data.operation_id,
        shift_date:     data.shift_date,
        shift_type:     data.shift_type    || "regular",
        time_from:      data.time_from     || "08:00:00",
        time_to:        data.time_to       || "17:00:00",
        hours_rendered: parseFloat(data.hours_rendered),
        employee_id:    data.employee_id   != null ? Number(data.employee_id) : null,
        remarks:        data.remarks       || null,
      }),
    });
  }

  async deleteShift(id) {
    return this.request(`/api/operation-shifts?id=${id}`, { method: "DELETE" });
  }


  // ── TEMPLATES ──────────────────────────────────────────────────────────────

  async getTemplates() { return this.request("/api/job-order-templates"); }

  async createTemplate(data) {
    if (!data.name?.trim()) throw new Error("Template name is required");
    return this.request("/api/job-order-templates", {
      method: "POST",
      body: JSON.stringify({
        name:        data.name.trim(),
        description: data.description || null,
        operations:  Array.isArray(data.operations) ? data.operations : [],
      }),
    });
  }

  async updateTemplate(id, data) {
    return this.request(`/api/job-order-templates?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id) {
    return this.request(`/api/job-order-templates?id=${id}`, { method: "DELETE" });
  }

  async reorderOperations(jobOrderId, orderings) {
    return this.request(`/api/job-operations?action=reorder&job_order_id=${jobOrderId}`, {
      method: "PUT",
      body: JSON.stringify({ orderings }),
    });
  }

  async reorderShifts(operationId, orderings) {
    return this.request(`/api/operation-shifts?action=reorder&operation_id=${operationId}`, {
      method: "PUT",
      body: JSON.stringify({ orderings }),
    });
  }


  // ── PDF EXPORT MATERIALS ───────────────────────────────────────────────────

  /**
   * POST /api/job-order-export-materials
   * Saves a snapshot of the materials used in a PDF export.
   *
   * @param {number} jobOrderId
   * @param {string} exportBatch   — UUID, one per export session
   * @param {Array}  materials     — [{ item_no, name, brand, unit, quantity, unit_price, line_total, po_number, from_inventory }]
   */
  async saveExportMaterials(jobOrderId, exportBatch, materials) {
    return this.request("/api/job-order-export-materials", {
      method: "POST",
      body: JSON.stringify({
        job_order_id: jobOrderId,
        export_batch: exportBatch,
        materials,
      }),
    });
  }

  /**
   * GET /api/job-order-export-materials?job_order_id=:id&latest=1
   * Returns the flat list of materials from the most recent export.
   */
  async getLatestExportMaterials(jobOrderId) {
    return this.request(
      `/api/job-order-export-materials?job_order_id=${jobOrderId}&latest=1`
    );
  }

  /**
   * GET /api/job-order-export-materials?job_order_id=:id
   * Returns all export batches (newest first):
   *   [{ export_batch, exported_at, exported_by, materials: [...] }]
   */
  async getAllExportBatches(jobOrderId) {
    return this.request(
      `/api/job-order-export-materials?job_order_id=${jobOrderId}`
    );
  }
}

export default JobOrderService;