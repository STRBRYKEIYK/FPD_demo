// ============================================================================
// services/command-queue-service.js
// Mirrors the pattern of attendance-service.js / attendance-edit-service.js
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"

export class CommandQueueService extends BaseAPIService {

  /**
   * Enqueue a command for Electron to pick up on its next poll.
   * Fire-and-forget in practice — callers should not block the user on this.
   *
   * @param {'attendance_add'|'attendance_update'|'attendance_delete'} command
   * @param {number} targetId   - attendance.id (shared between MySQL and SQLite)
   * @param {object} payload    - full row for add, { fields:{...} } for update,
   *                              { employee_uid, date } for delete
   * @param {object} [opts]     - priority (1-10), created_by
   */
  async enqueue(command, targetId, payload, opts = {}) {
    return this.request("/api/command-queue", {
      method: "POST",
      body: JSON.stringify({
        command,
        target_id:  targetId,
        payload,
        priority:   opts.priority   ?? 5,
        created_by: opts.created_by ?? "attendance-edit-ui",
      }),
    })
  }

  /** Convenience: enqueue an attendance_add command */
  async enqueueAdd(targetId, attendanceRow) {
    return this.enqueue("attendance_add", targetId, attendanceRow)
  }

  /** Convenience: enqueue an attendance_update command */
  async enqueueUpdate(targetId, fields) {
    return this.enqueue("attendance_update", targetId, { fields })
  }

  /** Convenience: enqueue an attendance_delete command */
  async enqueueDelete(targetId, { employee_uid, date }) {
    return this.enqueue("attendance_delete", targetId, { employee_uid, date })
  }

  /** GET /api/command-queue?action=status — queue health for admin/debug */
  async getStatus() {
    return this.request("/api/command-queue?action=status")
  }
}