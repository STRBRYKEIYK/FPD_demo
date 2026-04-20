import { useState, useEffect } from "react";
import {
  LuSearch,
  LuX,
  LuPrinter,
  LuCopy,
  LuDownload,
  LuUpload,
  LuFileSpreadsheet,
  LuFileText,
  LuUsers,
  LuChartPie,
} from "react-icons/lu";
import apiService from "../../../utils/api/api-service";
import {
  fetchInvoices as fetchInvoicesHandler,
  fetchCustomers as fetchCustomersHandler,
  handleSubmitInvoice as handleSubmitInvoiceHandler,
  validateInvoiceNumber as validateInvoiceNumberHandler,
  handlePrintInvoice as handlePrintInvoiceHandler,
  handleDuplicateInvoice as handleDuplicateInvoiceHandler,
  showInfo as showInfoHandler,
} from "../handlers/SalesInvoice-Handlers";

import ViewRecordModal from "../components/main_ui/ViewRecordModal";
import { ToastContainer } from "../components/main_ui/Toast";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import ImportExportModal from "../components/main_ui/ImportExportModal";
import SalesInvoiceBulkCreator from "../components/forms/SalesInvoiceBulkCreator";
import CustomersSection from "./CustomersSection";
import SalesInvoiceSummary from "./SalesInvoiceSummary";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../../../contexts/AuthContext";
import { normalizeInvoiceImportResponse } from "../helpers/importResponseUtils";

// --- Aesthetic UI Components ---

const AestheticStatWidget = ({ title, value, colorClass, icon: Icon }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-stone-800/80 p-5 shadow-sm border ${colorClass} transition-all hover:shadow-md`}>
    <div className="absolute -right-4 -top-4 opacity-10 dark:opacity-5 text-current">
      {Icon && <Icon size={80} />}
    </div>
    <div className="relative z-10 flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <span className="text-2xl sm:text-3xl font-semibold text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  </div>
);

const AestheticActionButton = ({ title, description, icon, onClick, primary, colorClass }) => (
  <button
    onClick={onClick}
    className={`group flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-300 border ${
      primary 
        ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20 shadow-lg" 
        : `bg-white dark:bg-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800 border-gray-200 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 ${colorClass}`
    }`}
  >
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${primary ? "bg-white/20" : "bg-stone-100 dark:bg-stone-700"}`}>
      {icon}
    </div>
    <div>
      <h3 className="font-medium text-sm sm:text-base">{title}</h3>
      <p className={`text-xs ${primary ? "text-emerald-100" : "text-gray-500 dark:text-gray-400"}`}>{description}</p>
    </div>
  </button>
);

// Helper: is this invoice voided (rejected or cancelled)?
const isVoided = (invoice) =>
  invoice.status === "rejected" || invoice.status === "cancelled";

export default function SalesInvoiceSection({
  financeData,
  formatCurrency,
  onDataChange,
  user,
  initialTab = "records",
}) {
  const { isDarkMode } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // --- State Declarations ---
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [editingRowId, setEditingRowId] = useState(null);
  const [rowEditData, setRowEditData] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [ocrDraftInvoice, setOcrDraftInvoice] = useState(null);
  const [ocrDraftInvoices, setOcrDraftInvoices] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, data: null });
  const [importExportModal, setImportExportModal] = useState({ isOpen: false, mode: null });

  // --- Effects ---
  useEffect(() => {
    fetchCustomersHandler(setCustomers);
  }, []);

  useEffect(() => {
    if (financeData?.salesInvoices) {
      fetchInvoicesHandler(
        setLoading,
        setInvoices,
        selectedQuarter ? { quarter: selectedQuarter } : {}
      );
    }
  }, [financeData?.salesInvoices, selectedQuarter]);

  useEffect(() => {
    const openNewInvoice = () => {
      setEditingInvoice(null);
      setOcrDraftInvoice(null);
      setOcrDraftInvoices([]);
      setShowInvoiceForm(true);
    };

    window.addEventListener("fpd:quick-new-invoice", openNewInvoice);
    return () => window.removeEventListener("fpd:quick-new-invoice", openNewInvoice);
  }, []);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'sales_invoice') return;

      const drafts = Array.isArray(payload.drafts)
        ? payload.drafts.filter(Boolean)
        : payload.draft
          ? [payload.draft]
          : [];

      setActiveTab('records');
      setEditingInvoice(null);
      setOcrDraftInvoice(drafts[0] || null);
      setOcrDraftInvoices(drafts);
      setShowInvoiceForm(true);
      showSuccess(`OCR draft mapped to Sales Invoice form (${drafts.length} item${drafts.length === 1 ? '' : 's'}).`);
    };

    window.addEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
    return () => window.removeEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
  }, [showSuccess]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // --- Handlers ---
  const handleQuarterFilter = (quarter) => {
    setSelectedQuarter(quarter);
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setOcrDraftInvoice(null);
    setOcrDraftInvoices([]);
    setShowInvoiceForm(true);
  };

  const handleCloseInvoiceForm = () => {
    setShowInvoiceForm(false);
    setEditingInvoice(null);
    setOcrDraftInvoice(null);
    setOcrDraftInvoices([]);
  };

  const handleSubmitInvoice = async (invoiceData) => {
    await handleSubmitInvoiceHandler({
      invoiceData,
      editingInvoice,
      user,
      showSuccess,
      showError,
      fetchInvoices: (filters) => fetchInvoicesHandler(setLoading, setInvoices, filters),
      selectedQuarter,
      onDataChange,
      setShowInvoiceForm,
      setEditingInvoice,
    });
  };

  const validateInvoiceNumber = validateInvoiceNumberHandler;

  const showInfo = (message) => {
    showInfoHandler(message, showSuccess);
  };

  const handleInlineEdit = (row) => {
    setEditingRowId(row.id);
    setRowEditData({
      customer_name: row.customer_name,
      invoice_date: row.invoice_date,
      total_amount: row.total_amount,
      account_receivables: row.account_receivables ?? row.total_amount,
      status: row.status || "",
      remarks: row.remarks || "",
    });
  };

  const handleInlineCancel = () => {
    setEditingRowId(null);
    setRowEditData({});
  };

  const handleInlineSave = async (row) => {
    try {
      // Map total_amount → account_receivables so the backend recalculates VAT correctly
      const payload = {
        ...row,
        ...rowEditData,
        account_receivables: rowEditData.total_amount ?? row.account_receivables ?? row.total_amount,
        updated_by: user?.id || null,
      };

      await apiService.finance.updateInvoice(row.id, payload);

      const statusLabel = payload.status
        ? ` (${payload.status.charAt(0).toUpperCase() + payload.status.slice(1)})`
        : "";
      showSuccess(`Invoice updated${statusLabel}`);

      setEditingRowId(null);
      setRowEditData({});
      await fetchInvoicesHandler(setLoading, setInvoices, selectedQuarter ? { quarter: selectedQuarter } : {});
      if (onDataChange) await onDataChange();
    } catch (error) {
      showError("Failed to update invoice");
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedInvoices(filteredInvoices.map((inv) => inv.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invoiceId) => {
    setSelectedInvoices((prev) => {
      if (prev.includes(invoiceId)) return prev.filter((id) => id !== invoiceId);
      return [...prev, invoiceId];
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedInvoices.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: "Delete Invoices",
      message: `Are you sure you want to delete ${selectedInvoices.length} invoice(s)? This action cannot be undone.`,
      action: async () => {
        try {
          setDeleting(true);
          const targetIds = [...selectedInvoices];
          const results = await Promise.allSettled(
            targetIds.map((id) => apiService.finance.deleteInvoice(id))
          );

          const failedIds = targetIds.filter((_, index) => results[index]?.status === "rejected");
          const deletedCount = targetIds.length - failedIds.length;

          if (deletedCount > 0) {
            await fetchInvoicesHandler(setLoading, setInvoices, selectedQuarter ? { quarter: selectedQuarter } : {});
            if (onDataChange) await onDataChange();
            showSuccess(`${deletedCount} invoice(s) deleted successfully`);
          }

          setSelectedInvoices(failedIds);

          if (failedIds.length > 0) {
            if (deletedCount > 0) {
              showWarning(`${failedIds.length} invoice(s) failed to delete and remain selected`);
            } else {
              showError("Failed to delete selected invoices");
            }
          }
        } catch (error) {
          console.error("Failed to delete invoices:", error);
          showError("Failed to delete some invoices");
        } finally {
          setDeleting(false);
          setConfirmDialog({ isOpen: false, action: null, data: null });
        }
      },
    });
  };

  const loadInvoiceExportUtils = () => import("../../../utils/finance-import-export");
  const loadInvoiceReportUtils = () => import("../../../utils/finance-report-generator");

  const handleOfficialReport = async () => {
    try {
      const { generateBeautifulInvoiceReport } = await loadInvoiceReportUtils();
      await generateBeautifulInvoiceReport(activeInvoices);
    } catch (error) {
      showError("Failed to generate official report");
    }
  };

  const handleExportSelected = async (format) => {
    const selected = filteredInvoices.filter((inv) => selectedInvoices.includes(inv.id));
    if (selected.length === 0) {
      showWarning("Please select at least one invoice to export");
      return;
    }

    const dateSuffix = new Date().toISOString().split("T")[0];

    try {
      const { exportInvoicesToCSV, exportInvoicesToExcel, exportInvoicesToPDF } = await loadInvoiceExportUtils();
      if (format === "csv") {
        exportInvoicesToCSV(selected, `invoices_${dateSuffix}.csv`);
      } else if (format === "excel") {
        exportInvoicesToExcel(selected, `invoices_${dateSuffix}.xlsx`);
      } else if (format === "pdf") {
        exportInvoicesToPDF(selected, `invoices_${dateSuffix}.pdf`);
      }
    } catch (error) {
      showError(`Failed to export invoices as ${format.toUpperCase()}`);
    }
  };

  const handleRowClick = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setViewModalOpen(true);
  };

  const handleImportComplete = async (importedInvoices, mode) => {
    try {
      const response = await apiService.finance.importInvoices(importedInvoices, mode, user?.id);
      const { createdInvoices, updatedInvoices, errors } = normalizeInvoiceImportResponse(response);

      if (createdInvoices.length > 0 || updatedInvoices.length > 0) {
        showSuccess(`Imported ${createdInvoices.length + updatedInvoices.length} invoice(s) successfully`);
      }
      if (errors.length > 0) {
        showWarning(`${errors.length} invoice(s) had errors`);
      }
      await fetchInvoicesHandler(setLoading, setInvoices, selectedQuarter ? { quarter: selectedQuarter } : {});
      if (onDataChange) await onDataChange();
    } catch (error) {
      throw new Error(error.message || "Failed to import invoices");
    }
  };

  // --- Advanced Filtering Logic ---
  const filteredInvoices = invoices.filter((invoice) => {
    if (selectedQuarter && invoice.quarter !== selectedQuarter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!(
        invoice.invoice_number?.toLowerCase().includes(query) ||
        invoice.customer_name?.toLowerCase().includes(query) ||
        invoice.remarks?.toLowerCase().includes(query)
      )) return false;
    }
    if (filterCustomer && invoice.customer_name !== filterCustomer) return false;
    if (filterStatus && invoice.status !== filterStatus) return false;
    if (filterDateFrom && new Date(invoice.invoice_date) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(invoice.invoice_date) > new Date(filterDateTo)) return false;
    if (filterAmountMin && Number(invoice.total_amount) < Number(filterAmountMin)) return false;
    if (filterAmountMax && Number(invoice.total_amount) > Number(filterAmountMax)) return false;
    return true;
  });

  // --- Active invoices (exclude rejected/cancelled) for stats ---
  const activeInvoices = filteredInvoices.filter((inv) => !isVoided(inv));
  const activeTotal = activeInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const activeVat = activeInvoices.reduce((sum, inv) => sum + Number(inv.vat_amount || 0), 0);
  const activeZeroRated = activeInvoices.reduce((sum, inv) => sum + Number(inv.zero_rated_sales || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, data: null })}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
      />

      <ViewRecordModal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setSelectedInvoiceId(null); }}
        recordType="invoice"
        recordId={selectedInvoiceId}
        apiService={apiService}
        formatCurrency={formatCurrency}
        isDarkMode={isDarkMode}
      />

      <SalesInvoiceBulkCreator
        isOpen={showInvoiceForm}
        onClose={handleCloseInvoiceForm}
        onSubmit={handleSubmitInvoice}
        customers={customers}
        isDarkMode={isDarkMode}
        createdBy={user?.id}
        initialDraft={ocrDraftInvoice}
        initialDrafts={ocrDraftInvoices}
      />

      {/* Modern Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-800/60 rounded-xl w-fit mb-6">
        {[
          { id: "records", label: "Invoice Records", icon: LuFileText },
          { id: "customers", label: "Customers", icon: LuUsers },
          { id: "summary", label: "Invoice Summary", icon: LuChartPie }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-stone-700/50"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "records" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Dashboard Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AestheticActionButton 
              title="New Invoice" description="Create sales invoice" primary 
              icon={<span className="text-xl leading-none mb-1">+</span>} 
              onClick={handleCreateInvoice} 
            />
            <AestheticActionButton 
              title="Export" description="Download as CSV/Excel" 
              colorClass="hover:border-blue-300"
              icon={<LuDownload className="w-5 h-5 text-blue-500" />} 
              onClick={() => setImportExportModal({ isOpen: true, mode: "export" })} 
            />
            <AestheticActionButton 
              title="Import" description="Bulk import invoices" 
              colorClass="hover:border-purple-300"
              icon={<LuUpload className="w-5 h-5 text-purple-500" />} 
              onClick={() => setImportExportModal({ isOpen: true, mode: "import" })} 
            />
            <AestheticActionButton 
              title="Official Report" description="Generated Excel Masterlist" 
              colorClass="hover:border-emerald-300"
              icon={<LuFileSpreadsheet className="w-5 h-5 text-emerald-500" />} 
              onClick={handleOfficialReport} 
            />
          </div>

          {/* Search and Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-stone-800/80 rounded-2xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by invoice #, customer, or remarks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-stone-50 dark:bg-stone-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <LuX className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex bg-stone-100 dark:bg-stone-900 rounded-lg p-1">
                  {["", "Q1", "Q2", "Q3", "Q4"].map((q) => (
                    <button
                      key={q || "all"}
                      onClick={() => handleQuarterFilter(q)}
                      className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${
                        selectedQuarter === q 
                          ? "bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      {q || "All Quarters"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-row items-center gap-3">
                <button
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                  onClick={() => setFiltersCollapsed((c) => !c)}
                >
                  {filtersCollapsed ? "Show Filters" : "Hide Filters"}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap bg-stone-50 dark:bg-stone-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                  {filteredInvoices.length} / {invoices.length}
                </span>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {!filtersCollapsed && (
              <div className="flex flex-wrap gap-3 bg-white dark:bg-stone-800/80 p-4 rounded-2xl border border-emerald-100 dark:border-gray-700/50 shadow-sm animate-in slide-in-from-top-2 duration-200">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Customer</label>
                  <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                    <option value="">All Customers</option>
                    {customers.map((c) => (<option key={c.id} value={c.customer_name}>{c.customer_name}</option>))}
                  </select>
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date From</label>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date To</label>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Min Amount</label>
                  <input type="number" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" placeholder="0.00" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Max Amount</label>
                  <input type="number" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" placeholder="0.00" />
                </div>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedInvoices.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 items-center">
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mr-auto pl-2">
                {selectedInvoices.length} Invoices Selected
              </span>
              <button onClick={handleDeleteSelected} disabled={deleting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                {deleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button onClick={() => handleExportSelected("csv")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                <LuDownload className="w-4 h-4" /> CSV
              </button>
              <button onClick={() => handleExportSelected("excel")} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                <LuFileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => handleExportSelected("pdf")} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                <LuFileText className="w-4 h-4" /> PDF
              </button>
            </div>
          )}

          {/* Sales Invoice Summary Stats — active invoices only */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AestheticStatWidget
              title="Total Invoiced"
              value={formatCurrency(activeTotal)}
              colorClass="border-emerald-200 dark:border-emerald-900/50"
            />
            <AestheticStatWidget
              title="Total Invoices"
              value={activeInvoices.length.toString()}
              colorClass="border-blue-200 dark:border-blue-900/50"
            />
            <AestheticStatWidget
              title="Total VAT"
              value={formatCurrency(activeVat)}
              colorClass="border-purple-200 dark:border-purple-900/50"
            />
            <AestheticStatWidget
              title="Total Zero-Rated"
              value={formatCurrency(activeZeroRated)}
              colorClass="border-cyan-200 dark:border-cyan-900/50"
            />
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-stone-800/80 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-stone-50/80 dark:bg-stone-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0} 
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-stone-800" 
                      />
                    </th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Quarter</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {loading ? (
                    <tr><td colSpan="10" className="py-12 text-center text-gray-400">Loading invoices...</td></tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-16 text-center">
                        <p className="text-gray-400 mb-4">{searchQuery ? "No invoices found matching your search" : "No invoices yet"}</p>
                        {!searchQuery && (
                          <button onClick={handleCreateInvoice} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm transition-colors shadow-sm">
                            Create First Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const voided = isVoided(invoice);
                      const isEditing = editingRowId === invoice.id;

                      return (
                        <tr 
                          key={invoice.id} 
                          className={`group transition-colors cursor-pointer ${
                            isEditing
                              ? "bg-emerald-50/50 dark:bg-stone-700/50"
                              : voided
                              ? "bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/60 dark:hover:bg-red-900/20 opacity-70"
                              : "hover:bg-emerald-50/30 dark:hover:bg-stone-700/30"
                          }`}
                          onClick={() => { if (!isEditing) handleRowClick(invoice.id); }}
                        >
                          {/* Checkbox */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedInvoices.includes(invoice.id)} 
                              onChange={() => handleSelectInvoice(invoice.id)}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-stone-800" 
                            />
                          </td>
                          
                          {/* Invoice Number */}
                          <td className="px-4 py-3 font-medium">
                            <span className={`text-gray-900 dark:text-gray-100 ${voided ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                              {invoice.invoice_number}
                            </span>
                          </td>
                          
                          {/* Customer */}
                          <td className="px-4 py-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <select
                                value={rowEditData.customer_name || ""}
                                onChange={(e) => setRowEditData({ ...rowEditData, customer_name: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-white dark:bg-stone-900 text-gray-900 dark:text-white border border-emerald-300 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                              >
                                {customers.map((c) => (<option key={c.id} value={c.customer_name}>{c.customer_name}</option>))}
                              </select>
                            ) : (
                              <span className={`text-gray-600 dark:text-gray-300 ${voided ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                                {invoice.customer_name}
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                type="date"
                                value={rowEditData.invoice_date || ""}
                                onChange={(e) => setRowEditData({ ...rowEditData, invoice_date: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-white dark:bg-stone-900 text-gray-900 dark:text-white border border-emerald-300 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            ) : (
                              <span className={`text-gray-500 ${voided ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                                {new Date(invoice.invoice_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </td>

                          {/* Quarter */}
                          <td className="px-4 py-3">
                            <span className={`text-gray-500 dark:text-gray-400 ${voided ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                              {invoice.quarter}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                type="number"
                                value={rowEditData.total_amount || ""}
                                onChange={(e) => setRowEditData({ ...rowEditData, total_amount: e.target.value, account_receivables: e.target.value })}
                                min="0" step="0.01"
                                className="w-24 px-2 py-1 rounded bg-white dark:bg-stone-900 text-gray-900 dark:text-white border border-emerald-300 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            ) : (
                              <span className={`font-semibold ${voided ? "line-through text-gray-400 dark:text-gray-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {formatCurrency(invoice.total_amount || 0)}
                              </span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-lg font-medium ${
                              voided
                                ? "bg-stone-100 text-gray-400 dark:bg-stone-800 dark:text-gray-500 line-through"
                                : invoice.sale_type === "vatable"
                                ? "bg-gray-50 text-blue-600 dark:bg-gray-900/30 dark:text-blue-400"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}>
                              {invoice.sale_type === "vatable" ? "Vatable" : "Zero-Rated"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <select
                                value={rowEditData.status || ""}
                                onChange={(e) => setRowEditData({ ...rowEditData, status: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-white dark:bg-stone-900 text-gray-900 dark:text-white border border-emerald-300 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                              >
                                <option value="">Select</option>
                                <option value="draft">Draft</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                invoice.status === "paid"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                                  : invoice.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                                  : invoice.status === "rejected"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                  : invoice.status === "cancelled"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                  : "bg-stone-100 text-gray-700 border-gray-200 dark:bg-stone-800 dark:text-gray-400 dark:border-gray-700"
                              }`}>
                                {invoice.status || "Draft"}
                              </span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-4 py-3 max-w-[150px] truncate" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={rowEditData.remarks || ""}
                                onChange={(e) => setRowEditData({ ...rowEditData, remarks: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-white dark:bg-stone-900 text-gray-900 dark:text-white border border-emerald-300 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            ) : (
                              <span className={`text-gray-500 dark:text-gray-400 ${voided ? "line-through text-gray-400 dark:text-gray-500" : ""}`}>
                                {invoice.remarks}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => handleInlineSave(invoice)} className="text-sm text-emerald-600 font-medium hover:bg-emerald-100 dark:hover:bg-stone-700 px-2 py-1 rounded transition-colors">Save</button>
                                <button onClick={handleInlineCancel} className="text-sm text-gray-500 font-medium hover:bg-stone-100 dark:hover:bg-stone-700 px-2 py-1 rounded transition-colors">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                {!voided && (
                                  <button
                                    onClick={() => handleInlineEdit(invoice)}
                                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-stone-700 px-2 py-1 rounded transition-colors font-medium"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button onClick={() => handlePrintInvoiceHandler(invoice, formatCurrency, showSuccess)} className="text-gray-400 hover:text-blue-500 p-1.5 hover:bg-stone-100 dark:hover:bg-stone-700 rounded transition-colors" title="Print"><LuPrinter size={16} /></button>
                                {!voided && (
                                  <button onClick={() => handleDuplicateInvoiceHandler(invoice, user, setEditingInvoice, setViewModalOpen, setShowInvoiceForm, showInfo, showError)} className="text-gray-400 hover:text-amber-500 p-1.5 hover:bg-stone-100 dark:hover:bg-stone-700 rounded transition-colors" title="Duplicate"><LuCopy size={16} /></button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "customers" && (
        <CustomersSection formatCurrency={formatCurrency} onDataChange={onDataChange} user={user} />
      )}

      {activeTab === "summary" && (
        <SalesInvoiceSummary financeData={financeData} formatCurrency={formatCurrency} />
      )}

      <ImportExportModal
        isOpen={importExportModal.isOpen}
        onClose={() => setImportExportModal({ isOpen: false, mode: null })}
        mode={importExportModal.mode}
        invoices={activeInvoices}
        onImportComplete={handleImportComplete}
        showToast={(message, type) => {
          if (type === "success") showSuccess(message);
          else if (type === "error") showError(message);
          else if (type === "warning") showWarning(message);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}