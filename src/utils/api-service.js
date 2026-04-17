// ============================================================================
// api-service.js - Main service aggregator with Encryption Support
// ============================================================================
import { AuthService } from "./services/auth-service.js"
import { EmployeeService } from "./services/employee-service.js"
import { FileService } from "./services/file-service.js"
import { ProfileService } from "./services/profile-service.js"
import { AttendanceService } from "./services/attendance-service.js"
import { RecruitmentService } from "./services/recruitment-service.js"
import { PollingManager } from "./websocket/polling-manager.jsx"
import { DocumentService } from "./services/document-service.js"
import { DailySummaryService } from "./services/daily-summary-service.js"
import { ItemsService } from "./services/items-service.js"
import { PurchaseOrdersService } from "./services/purchase-orders-service.js"
import { SuppliersService } from "./services/suppliers-service.js"
import { EmployeeLogsService } from "./services/employee-logs-service.js"
import { AttendanceEditService } from "./services/attendance-edit-service.js"
import { AnnouncementService } from "./services/announcement-service.js"
import { EmailService } from "./services/email-service.js"
import { MaterialsService } from "./services/Materials-service.js"
import { EmployeeInventoryService } from "./services/employee-inventory-service.js"
import { FinanceService } from "./services/finance-service.js"
import { PayrollService } from "./services/payroll-service.js"
import { MonthlyBillsService } from "./services/monthly-bills-service.js"
import { ToolboxItemsService } from "./services/toolbox-items-service.js"
import { ToolboxTransactionsService } from "./services/toolbox-transactions-service.js"
import { ToolboxEmployeesService } from "./services/toolbox-employees-service.js"
import { ToolboxConnectionService } from "./services/toolbox-connection-service.js"
import { CommandQueueService } from "./services/command-queue-service.js"
import { JobOrderService } from "./services/JobOrder-service.js"
import { CheckoutRequestsService } from "./services/checkout-requests-service.js"
import { PushSubscriptionService } from "./services/push-subscription-service.js"

class APIService {

  constructor() {
    // Initialize all service modules
    this.auth = new AuthService()
    this.employees = new EmployeeService()
    this.files = new FileService()
    this.profiles = new ProfileService()
    this.attendance = new AttendanceService()
    this.recruitment = new RecruitmentService()
    this._socket = null // Lazy initialization to prevent circular dependency
    this.document = new DocumentService()
    this.summary = new DailySummaryService()
    this.items = new ItemsService()
    this.purchaseOrders = new PurchaseOrdersService()
    this.suppliers = new SuppliersService()
    this.employeeLogs = new EmployeeLogsService()
    this.editAttendance = new AttendanceEditService()
    this.announcements = new AnnouncementService()
    this.email = new EmailService()
    this.materials = new MaterialsService()
    this.employeeInventory = new EmployeeInventoryService()
    this.finance = new FinanceService()
    this.payroll = new PayrollService()
    this.monthlyBills = new MonthlyBillsService()
    this.commandQueue = new CommandQueueService()
    this.jobOrders = new JobOrderService()              
    this.checkoutRequests = new CheckoutRequestsService()
    this.push = new PushSubscriptionService()

    // Toolbox services
    this.toolboxItems = new ToolboxItemsService()
    this.toolboxTransactions = new ToolboxTransactionsService()
    this.toolboxEmployees = new ToolboxEmployeesService()
    this.toolboxConnection = new ToolboxConnectionService()
  }

  // Lazy initialization for socket to avoid circular dependency issues
  get socket() {
    if (!this._socket) {
      this._socket = new PollingManager()
    }
    return this._socket
  }

  // Initialize all services
  initialize() {
    this.socket.initialize()
  }

  // Cleanup method
  cleanup() {
    this.socket.disconnect()
    this.profiles.clearProfileCache()
  }
}

// Create and export singleton instance
const apiService = new APIService()

// Initialize services after a microtask to ensure all modules are loaded
if (typeof window !== "undefined") {
  // Delay initialization to avoid circular dependency issues
  queueMicrotask(() => {
    apiService.initialize()
  })

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    apiService.cleanup()
  })
}

export default apiService

// Export individual services for direct access if needed
export const {
  auth,
  employees,
  files,
  profiles,
  attendance,
  recruitment,
  document,
  summary,
  items,
  purchaseOrders,
  employeeLogs,
  editAttendance,
  suppliers,
  announcements,
  email,
  materials,
  employeeInventory,
  finance,
  payroll,
  monthlyBills,
  commandQueue,
  jobOrders,               
  toolboxItems,
  toolboxTransactions,
  toolboxEmployees,
  toolboxConnection,
  checkoutRequests,
  push
} = apiService

// Export socket separately to maintain lazy initialization
export const getSocket = () => apiService.socket