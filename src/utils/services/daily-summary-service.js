// ============================================================================
// services/daily-summary-service.js
// ============================================================================
import { BaseAPIService } from "../core/base-api.js";

export class DailySummaryService extends BaseAPIService {
  async getDailySummaryRecords(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.request(`/api/daily-summary?${queryParams}`);
  }

  async getDailySummaryStats(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.request(`/api/daily-summary/stats?${queryParams}`);
  }

  async getDailySummaryById(id) {
    return this.request(`/api/daily-summary/${id}`);
  }

  async getEmployeeDailySummary(employee_uid, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.request(
      `/api/daily-summary/employee/${employee_uid}?${queryParams}`
    );
  }

  async syncDailySummaryRecords(daily_summary_data) {
    return this.request("/api/daily-summary", {
      method: "POST",
      body: JSON.stringify({ daily_summary_data }),
    });
  }

  async editDailySummaryRecord(id, updateData) {
    return this.request(`/api/daily-summary/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  }

  async deleteDailySummaryRecord(id) {
    return this.request(`/api/daily-summary/${id}`, {
      method: "DELETE",
    });
  }

  async rebuildDailySummary(start_date, end_date) {
    return this.request("/api/daily-summary/rebuild", {
      method: "POST",
      body: JSON.stringify({ start_date, end_date }),
    });
  }

  /**
 * Get daily attendance summary for specific dates (for payroll preview)
 * Uses daily_attendance_summary table which has pre-aggregated hours
 * @param {Object} params - { dates: ['2025-01-15'], employee_uid?: 123 }
 * @returns {Promise<Object>} Daily summary records
 */
async getDailySummaryByDates(params = {}) {
  try {
    const queryParams = new URLSearchParams();

    // ✅ FIXED: Handle dates array - pass as comma-separated string
    if (params.dates) {
      const datesArray = Array.isArray(params.dates) ? params.dates : [params.dates];
      queryParams.append("dates", datesArray.join(","));
      //console.log('[DailySummaryService] Dates:', datesArray.join(","));
    }

    // Handle employee_uid
    if (params.employee_uid) {
      queryParams.append("employee_uid", params.employee_uid);
    }

    console.log(
      "[DailySummaryService] Fetching daily summary by dates:",
      queryParams.toString()
    );

    const response = await this.request(
      `/api/daily-summary?${queryParams.toString()}`,
      {
        method: "GET",
      }
    );

    // ✅ ADDED: Validate response structure
    if (!response) {
      throw new Error('No response from server');
    }

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch daily summary');
    }

    if (!response.data) {
      console.warn('⚠️ No data in response, returning empty array');
      return {
        success: true,
        data: [],
        pagination: { total: 0, limit: 0, offset: 0, pages: 0 }
      };
    }

    //console.log('[DailySummaryService] Success:', response.data.length, 'records');
    return response;

  } catch (error) {
    console.error(
      "[DailySummaryService] Failed to fetch daily summary by dates:",
      error
    );
    throw error;
  }
}
}
