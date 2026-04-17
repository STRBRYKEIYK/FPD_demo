// ============================================================================
// services/employee-service.js - UPDATED WITH ALL DATABASE COLUMNS
// ============================================================================
import { BaseAPIService } from "../core/base-api.js"
import { getStoredToken } from "../../auth.js"
import axios from "axios"
import { decryptData, isEncrypted } from "../../axios-encryption.js"

const DEBUG = true
const log = (...args) => DEBUG && console.log('[EmployeeService]', ...args)
const error = (...args) => console.error('[EmployeeService]', ...args)

export class EmployeeService extends BaseAPIService {
  /**
   * Get all employees with filtering and pagination
   */
  async getEmployees(params = {}, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });

      const url = `${this.baseURL}/api/employees?${queryParams.toString()}`;
      
      log('📡 Fetching employees:', url);
      log('📋 Params:', params);

      const axiosConfig = {
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      };

      if (options.signal) {
        axiosConfig.signal = options.signal;
      }

      const response = await axios(axiosConfig);
      const data = response.data;
      
      log('✅ Received data:', {
        dataType: typeof data,
        hasEmployees: !!data.employees,
        employeeCount: data.employees?.length || 0
      });
      
      // Safety check for encrypted data
      if (data.encrypted && data.data) {
        error('⚠️ Data is still encrypted! Attempting manual decryption...');
        
        try {
          const decrypted = decryptData(data.data);
          log('✅ Manual decryption successful');
          
          return {
            success: true,
            employees: decrypted.employees || decrypted.data || [],
            pagination: decrypted.pagination || { total: 0, page: 1, limit: 20 },
            statistics: decrypted.statistics || {},
            departments: decrypted.departments || [],
          };
        } catch (decryptError) {
          error('❌ Manual decryption failed:', decryptError);
          throw new Error('Failed to decrypt employee data');
        }
      }
      
      return {
        success: true,
        employees: data.employees || data.data || [],
        pagination: data.pagination || { total: 0, page: 1, limit: 20 },
        statistics: data.statistics || {},
        departments: data.departments || [],
      };

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        log('ℹ️ Request aborted');
        throw err;
      }
      
      error("❌ Error fetching employees:", err);
      
      return {
        success: false,
        error: err.message,
        employees: [],
        pagination: { total: 0, page: 1, limit: 20 },
        statistics: {},
        departments: [],
      };
    }
  }

  /**
   * Get current logged-in employee data
   */
  async getCurrentEmployeeData(uid) {
    try {
      log('🔍 Fetching current employee data for UID:', uid);
      
      const queryParams = new URLSearchParams({
        employeeUid: uid,
        includeAllStatuses: 'true',
        limit: 1
      });

      const url = `${this.baseURL}/api/employees?${queryParams.toString()}`;

      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      
      // Safety check for encrypted data
      if (data.encrypted && data.data) {
        error('⚠️ Data is still encrypted! Attempting manual decryption...');
        
        try {
          const decrypted = decryptData(data.data);
          const employee = decrypted.employees?.[0] || decrypted.data?.[0] || null;
          
          return {
            success: true,
            employee: employee,
          };
        } catch (decryptError) {
          error('❌ Manual decryption failed:', decryptError);
          throw new Error('Failed to decrypt employee data');
        }
      }
      
      const employee = data.employees?.[0] || data.data?.[0] || null;
      
      return {
        success: true,
        employee: employee,
      };

    } catch (err) {
      error("❌ Error fetching current employee:", err);
      
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        employee: null,
      };
    }
  }

  /**
   * Search employee by ID Number, ID Barcode, or NFC Access
   */
  async searchByIdentifier(identifier) {
    try {
      if (!identifier || !identifier.trim()) {
        throw new Error('Identifier is required');
      }

      const url = `${this.baseURL}/api/employees/search?identifier=${encodeURIComponent(identifier.trim())}`;
      
      log('🔍 Searching by identifier:', identifier);

      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      log('✅ Employee found:', data);
      
      return {
        success: true,
        employee: data,
      };

    } catch (err) {
      error('❌ Search failed:', err);
      
      const errorMessage = err.response?.data?.error || 
                          err.message || 
                          `Employee not found with identifier: ${identifier}`;
      
      return {
        success: false,
        error: errorMessage,
        employee: null,
      };
    }
  }

  /**
   * Get single employee by ID
   */
  async getEmployee(id) {
    try {
      const url = `${this.baseURL}/api/employees/${id}`;
      
      log('📡 Fetching employee by ID:', id);

      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      log('✅ Employee data:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Get employee failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Create new employee - UPDATED with all database fields
   */
  async createEmployee(employeeData) {
    try {
      const url = `${this.baseURL}/api/employees`;
      
      log('📡 Creating employee:', employeeData);

      // Map all fields to match database columns
      const mappedData = {
        firstName: employeeData.firstName,
        middleName: employeeData.middleName,
        lastName: employeeData.lastName,
        age: employeeData.age,
        birthDate: employeeData.birthDate,
        contactNumber: employeeData.contactNumber,
        email: employeeData.email,
        civilStatus: employeeData.civilStatus,
        address: employeeData.address,
        hireDate: employeeData.hireDate,
        position: employeeData.position,
        department: employeeData.department,
        status: employeeData.status || 'Active',
        employmentType: employeeData.employmentType || 'regular',
        idNumber: employeeData.idNumber,
        idBarcode: employeeData.idBarcode,
        salary: employeeData.salary,
        dailyAllowanceRate: employeeData.dailyAllowanceRate || 0,
        tinNumber: employeeData.tinNumber,
        sssNumber: employeeData.sssNumber,
        pagibigNumber: employeeData.pagibigNumber,
        philhealthNumber: employeeData.philhealthNumber,
        profilePicture: employeeData.profilePicture,
        faceDescriptor: employeeData.faceDescriptor,
        document: employeeData.document,
        username: employeeData.username,
        password: employeeData.password,
        accessLevel: employeeData.accessLevel || 'user',
        nfcAccess: employeeData.nfcAccess,
        emailNotificationsEnabled: employeeData.emailNotificationsEnabled !== undefined ? employeeData.emailNotificationsEnabled : true
      };

      const response = await axios({
        method: "POST",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: mappedData
      });

      const data = response.data;
      log('✅ Employee created:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Create employee failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Update employee - UPDATED with all database fields
   */
  async updateEmployee(id, employeeData) {
    try {
      const url = `${this.baseURL}/api/employees/${id}`;
      
      log('📡 Updating employee:', id, employeeData);

      // Map all fields
      const mappedData = {
        firstName: employeeData.firstName,
        middleName: employeeData.middleName,
        lastName: employeeData.lastName,
        age: employeeData.age,
        birthDate: employeeData.birthDate,
        contactNumber: employeeData.contactNumber,
        email: employeeData.email,
        civilStatus: employeeData.civilStatus,
        address: employeeData.address,
        hireDate: employeeData.hireDate,
        position: employeeData.position,
        department: employeeData.department,
        status: employeeData.status,
        employmentType: employeeData.employmentType,
        idNumber: employeeData.idNumber,
        idBarcode: employeeData.idBarcode,
        salary: employeeData.salary,
        dailyAllowanceRate: employeeData.dailyAllowanceRate,
        tinNumber: employeeData.tinNumber,
        sssNumber: employeeData.sssNumber,
        pagibigNumber: employeeData.pagibigNumber,
        philhealthNumber: employeeData.philhealthNumber,
        profilePicture: employeeData.profilePicture,
        faceDescriptor: employeeData.faceDescriptor,
        document: employeeData.document,
        username: employeeData.username,
        accessLevel: employeeData.accessLevel,
        nfcAccess: employeeData.nfcAccess,
        emailNotificationsEnabled: employeeData.emailNotificationsEnabled
      };

      const response = await axios({
        method: "PUT",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: mappedData
      });

      const data = response.data;
      log('✅ Employee updated:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Update employee failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Update employee status
   */
  async updateEmployeeStatus(id, status) {
    try {
      const url = `${this.baseURL}/api/employees/${id}/status`;
      
      log('📡 Updating employee status:', id, status);

      const response = await axios({
        method: "PATCH",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: { status }
      });

      const data = response.data;
      log('✅ Status updated:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Update status failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Delete single employee
   */
  async deleteEmployee(id) {
    try {
      const url = `${this.baseURL}/api/employees/${id}`;
      
      log('📡 Deleting employee:', id);

      const response = await axios({
        method: "DELETE",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      log('✅ Employee deleted:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Delete employee failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Bulk delete employees
   */
  async bulkDeleteEmployees(employeeIds) {
    try {
      const url = `${this.baseURL}/api/employees/bulk`;
      
      log('📡 Bulk deleting employees:', employeeIds);

      const response = await axios({
        method: "DELETE",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: { employeeIds }
      });

      const data = response.data;
      log('✅ Employees deleted:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Bulk delete failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Get departments
   */
  async getDepartments() {
    try {
      const url = `${this.baseURL}/api/employees/departments`;
      
      log('📡 Fetching departments');

      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      log('✅ Departments:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Get departments failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Update employee password
   */
  async updateEmployeePassword(id, passwordData) {
    try {
      const url = `${this.baseURL}/api/employees/${id}/password`;
      
      log('📡 Updating employee password:', id);

      const response = await axios({
        method: "PUT",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: passwordData
      });

      const data = response.data;
      log('✅ Password updated:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Update password failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Add employee to emp_list
   */
  async addEmployeeToEmpList(employeeData) {
    try {
      const url = `${this.baseURL}/api/employees`;
      
      log("📡 Adding employee to emp_list:", employeeData);

      const response = await axios({
        method: "POST",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: employeeData
      });

      const data = response.data;
      log('✅ Employee added:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Add employee failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Validate employee data
   */
  async validateEmployee(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = `${this.baseURL}/api/employees/validate?${queryParams}`;
      
      log('📡 Validating employee:', params);

      const response = await axios({
        method: "GET",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      const data = response.data;
      log('✅ Validation result:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Validation failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }

  /**
   * Toggle email notifications
   */
  async toggleEmailNotifications(id, enabled) {
    try {
      const url = `${this.baseURL}/api/employees/${id}/email-notifications`;
      
      log('📡 Toggling email notifications:', id, enabled);

      const response = await axios({
        method: "PATCH",
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
        data: { enabled }
      });

      const data = response.data;
      log('✅ Notifications toggled:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (err) {
      error('❌ Toggle notifications failed:', err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        data: null
      };
    }
  }
}