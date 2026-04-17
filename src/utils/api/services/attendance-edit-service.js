// ============================================================================
// services/attendance-edit-service.js
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"

export class AttendanceEditService extends BaseAPIService {
  /**
   * Get records that have been edited or deleted since a specific timestamp
   * GET /api/attendanceEdit
   */
  async getEditedRecords(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/api/attendanceEdit?${queryParams}`)
  }

  /**
   * Add a new attendance record
   * POST /api/attendanceEdit
   */
  async addAttendanceRecord(recordData) {
    return this.request("/api/attendanceEdit", {
      method: "POST",
      body: JSON.stringify(recordData),
    })
  }

  /**
   * Edit an attendance record and mark it as unsynced
   * PUT /api/attendanceEdit/:id
   */
  async editAttendanceRecord(id, updateData) {
    return this.request(`/api/attendanceEdit/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    })
  }

  /**
   * Delete an attendance record and log the deletion
   * DELETE /api/attendanceEdit/:id
   */
  async deleteAttendanceRecord(id) {
    return this.request(`/api/attendanceEdit/${id}`, {
      method: "DELETE",
    })
  }

  /**
   * Batch edit multiple attendance records
   * POST /api/attendanceEdit/batch
   */
  async batchEditRecords(records) {
    return this.request("/api/attendanceEdit/batch", {
      method: "POST",
      body: JSON.stringify({ records }),
    })
  }

  /**
   * Get all unsynced attendance records
   */
  async getUnsyncedRecords(limit = 100) {
    return this.getEditedRecords({ limit })
  }

  /**
   * Get recent edits since last sync
   */
  async getEditsSince(lastSyncTime, limit = 100) {
    const timestamp = lastSyncTime instanceof Date
      ? lastSyncTime.toISOString()
      : lastSyncTime
    return this.getEditedRecords({ since: timestamp, limit })
  }

  /**
   * Update clock time for an attendance record
   */
  async updateClockTime(id, clockTime) {
    return this.editAttendanceRecord(id, { clock_time: clockTime })
  }

  /**
   * Mark attendance record as late
   */
  async markAsLate(id, isLate = true, notes = null) {
    const updateData = { is_late: isLate }
    if (notes) updateData.notes = notes
    return this.editAttendanceRecord(id, updateData)
  }

  /**
   * Update attendance hours
   */
  async updateHours(id, hours) {
    return this.editAttendanceRecord(id, hours)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMAND QUEUE — wait for Electron to confirm execution (is_executed = 1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Poll GET /api/command-queue/:id until Electron confirms execution.
   *
   * Resolution rules (in priority order):
   *   1. Row is gone (404 / success=false)  → { executed: true }
   *      This happens when command-queue.php deletes the row on ACK, which is
   *      the fastest possible signal — no more polling after the row disappears.
   *
   *   2. Row exists and is_executed=1        → { executed: true }
   *      Covers the case where the row is kept for audit purposes but has been
   *      marked done by the server.
   *
   *   3. Row exists, is_executed=0, status='failed' → { executed: false, error }
   *      Electron reported a permanent failure — stop polling, surface the error.
   *
   *   4. Anything else (pending/processing)  → wait intervalMs, retry
   *      No timeout — the toast stays "pending" for as long as it takes.
   *      This is intentional for slow/intermittent internet connections.
   *
   * Only use for attendance_add and attendance_update commands.
   * For attendance_delete the row is gone client-side immediately — confirm
   * the toast right after enqueue instead of polling.
   *
   * @param {number}  commandId         — command_queue.id from enqueue response
   * @param {number}  [intervalMs=2000] — gap between polls in ms (default 2 s)
   * @returns {Promise<{ executed: boolean, error?: string }>}
   */
async waitForExecution(commandId, intervalMs = 2_000, maxAttempts = 30) {
    if (!commandId) return { executed: false, error: "No commandId supplied" }

    return new Promise((resolve) => {
        let settled = false
        let attempts = 0

        const tick = async () => {
            if (settled) return

            // ── Max attempts guard (60s default) ──────────────────────────
            attempts++
            if (attempts > maxAttempts) {
                settled = true
                resolve({ executed: true }) // assume done, unblock the UI
                return
            }

            try {
                const res = await this.request(`/api/command-queue/${commandId}`)
                if (settled) return

                if (!res?.success) {
                    settled = true
                    resolve({ executed: true })
                    return
                }

                const row = res.data ?? {}

                if (Number(row.is_executed) === 1) {
                    settled = true
                    resolve({ executed: true })
                    return
                }

                if (row.status === "failed") {
                    settled = true
                    resolve({
                        executed: false,
                        error: row.last_error ?? "Command failed on Electron side",
                    })
                    return
                }

                setTimeout(tick, intervalMs)

            } catch {
                if (!settled) setTimeout(tick, intervalMs)
            }
        }

        setTimeout(tick, intervalMs)
    })
}
}