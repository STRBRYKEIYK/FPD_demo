// ============================================================================
// services/attendance-service.js - UPDATED
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"

export class AttendanceService extends BaseAPIService {
  async getAttendanceRecords(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/api/attendance?${queryParams}`)
  }

  /**
   * Get attendance records for specific dates (for payroll preview)
   * @param {Object} params - { dates: ['2025-01-15', '2025-01-16'], employee_id?: 123 }
   * @returns {Promise<Object>} Attendance records
   */
  async getAttendanceByDates(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    // Handle dates array - keep as comma-separated
    if (params.dates && Array.isArray(params.dates)) {
      queryParams.append('dates', params.dates.join(','));
    }
    
    // ✅ ADD: Handle holiday arrays as JSON strings
    if (params.regular_holidays && Array.isArray(params.regular_holidays)) {
      queryParams.append('regular_holidays', JSON.stringify(params.regular_holidays));
    }
    
    if (params.special_holidays && Array.isArray(params.special_holidays)) {
      queryParams.append('special_holidays', JSON.stringify(params.special_holidays));
    }
    
    // Handle employee_id
    if (params.employee_id) {
      queryParams.append('employee_id', params.employee_id);
    }
    
    // Handle start_date and end_date (fallback)
    if (params.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params.end_date) {
      queryParams.append('end_date', params.end_date);
    }

    console.log('[AttendanceService] Fetching attendance by dates with holidays:', {
      dates: params.dates,
      regular_holidays: params.regular_holidays,
      special_holidays: params.special_holidays
    });

    return await this.request(`/api/attendance?${queryParams.toString()}`, {
      method: 'GET'
    });
  } catch (error) {
    console.error('[AttendanceService] Failed to fetch attendance by dates:', error);
    throw error;
  }
}

  async getAttendanceStats(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/api/attendance/stats?${queryParams}`)
  }

  async createAttendanceRecord(attendanceData) {
    return this.request("/api/attendance/record", {
      method: "POST",
      body: JSON.stringify(attendanceData),
    })
  }

  async updateAttendanceRecord(id, attendanceData) {
    return this.request(`/api/attendance/${id}`, {
      method: "PUT",
      body: JSON.stringify(attendanceData),
    })
  }

  async deleteAttendanceRecord(id) {
    return this.request(`/api/attendance/${id}`, {
      method: "DELETE",
    })
  }

  async getEmployeeAttendance(employee_uid, params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/api/attendance/employee/${employee_uid}?${queryParams}`)
  }

  async syncAttendanceRecords(attendance_data) {
    return this.request("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ attendance_data }),
    })
  }

  /**
   * Remove duplicate attendance entries
   * Duplicates are identified by: employee_uid, clock_time, date, and clock_type
   * Keeps the oldest record (smallest ID) and removes newer duplicates
   * @returns {Promise<Object>} Result with removed_count and removed_ids
   */
  async removeDuplicateEntries() {
    return this.request("/api/attendance/remove-duplicates", {
      method: "POST",
    })
  }

  /**
   * Get attendance records with automatic duplicate removal
   * This will automatically remove duplicates before fetching records
   * @param {Object} params - Query parameters (limit, offset, etc.)
   * @returns {Promise<Object>} Attendance records with duplicates_removed info
   */
  async getAttendanceRecordsWithCleanup(params = {}) {
    // Always include auto_remove_duplicates flag
    const cleanupParams = { ...params, auto_remove_duplicates: 'true' }
    const queryParams = new URLSearchParams(cleanupParams).toString()
    return this.request(`/api/attendance?${queryParams}`)
  }

  /**
   * Import corrected attendance data from Excel
   * @param {Object} data - Import data with records array and mode
   * @returns {Promise<Object>}
   */
  async importCorrectedAttendance(data) {
    return this.request("/api/attendance/import-corrected", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }
  async purgeOldRecords() {
  return this.request("/api/attendance/purge-old", {
    method: "DELETE",
  });
}
}