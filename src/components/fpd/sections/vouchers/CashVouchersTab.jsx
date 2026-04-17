import React, { useState, useEffect, useMemo } from 'react';
import { 
  Banknote, Plus, TrendingUp, TrendingDown, Search, Filter, 
  Eye, Edit2, Trash2, X, AlertCircle, Download, Upload,
  Calendar, ArrowRight, CheckCircle2, MoreHorizontal, CheckSquare
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import apiService from "../../../../utils/api/api-service";
import CashVoucherBulkCreator from "../../components/forms/CashVoucherBulkCreator";
import ConfirmDialog from "../../components/main_ui/ConfirmDialog";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/main_ui/Toast";
import { generateCashVoucherReport } from "../../../../utils/reports/CashVoucherReport";
import CashVoucherImportModal from "../../components/modals/CashVoucherImportModal";
import { buildVoucherStatusUpdatePayload } from "../../helpers/voucherAuditPayload";
import { normalizeVoucherImportResponse } from "../../helpers/importResponseUtils";

/**
 * Cash Vouchers Tab - Modern UI with FULL Functionality
 */
export default function CashVouchersTab({ chartOfAccounts = [] }) {
  const { isDarkMode, user } = useAuth();
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();
  
  // --- STATE ---
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  
  // Stats
  const [summary, setSummary] = useState({
    debit: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    netPosition: 0
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [ocrDraftVoucher, setOcrDraftVoucher] = useState(null);
  const [ocrDraftVouchers, setOcrDraftVouchers] = useState([]);

  // Bulk Selection
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [bulkStatus, setBulkStatus] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    type: 'danger',
    onConfirm: null,
  });

  const openConfirmDialog = ({ title, message, confirmText = 'Confirm', type = 'danger', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      type,
      onConfirm,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  // --- LOADING & FILTERING ---
  useEffect(() => {
    loadVouchers();
  }, [transactionFilter, statusFilter, selectedMonth, selectedYear]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
    setLastSelectedIndex(null);
  }, [transactionFilter, statusFilter, searchTerm, selectedMonth, selectedYear]);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'cash_voucher') return;

      const drafts = Array.isArray(payload.drafts)
        ? payload.drafts.filter(Boolean)
        : payload.draft
          ? [payload.draft]
          : [];

      setOcrDraftVoucher(drafts[0] || null);
      setOcrDraftVouchers(drafts);
      setShowCreateModal(true);
    };

    window.addEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
    return () => window.removeEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
  }, []);

  const filteredVouchers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return vouchers;

    return vouchers.filter((voucher) => {
      const fields = [
        voucher.voucher_number,
        voucher.company_payee_payor,
        voucher.cash_source,
        voucher.invoice_number,
        voucher.po_number,
        voucher.remarks
      ];
      return fields.some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [vouchers, searchTerm]);

  const CASH_STATUS_ORDER = ['draft', 'pending', 'approved', 'released', 'received', 'rejected', 'cancelled'];
  const CASH_BACKEND_ALLOWED_STATUSES = new Set(['draft', 'pending', 'approved', 'released', 'received', 'cancelled']);
  const CASH_STATUS_LABELS = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    released: 'Released',
    received: 'Received',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  const CASH_ALLOWED_TRANSITIONS = {
    draft: ['pending', 'cancelled'],
    pending: ['approved', 'cancelled'],
    approved: ['released', 'received', 'cancelled'],
    released: ['received', 'cancelled'],
    received: [],
    rejected: ['pending', 'cancelled'],
    cancelled: ['draft', 'pending'],
  };

  const getCashAllowedTransitions = (status) => {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    return CASH_ALLOWED_TRANSITIONS[normalizedStatus] || [];
  };

  const getCashSelectableStatuses = (status) => {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    const options = [normalizedStatus, ...getCashAllowedTransitions(normalizedStatus)];
    return CASH_STATUS_ORDER.filter((candidate) => options.includes(candidate));
  };

  const getSelectedCashVouchers = () => vouchers.filter((voucher) => selectedIds.includes(voucher.id));

  const getBulkCashStatusOptions = () => {
    const selectedVouchers = getSelectedCashVouchers();
    if (selectedVouchers.length === 0) return [];

    const intersections = selectedVouchers
      .map((voucher) => new Set(getCashAllowedTransitions(voucher.status)))
      .reduce((acc, statusSet) => {
        if (!acc) return statusSet;
        return new Set([...acc].filter((value) => statusSet.has(value)));
      }, null);

    if (!intersections) return [];
    return CASH_STATUS_ORDER
      .filter((status) => intersections.has(status))
      .map((status) => ({ value: status, label: `Mark ${CASH_STATUS_LABELS[status] || status}` }));
  };

  const bulkCashStatusOptions = getBulkCashStatusOptions();

  useEffect(() => {
    calculateSummary(filteredVouchers);
  }, [filteredVouchers]);

  // --- BULK ACTION HANDLERS (RESTORED) ---
  const toggleMultiSelect = () => {
    setIsMultiSelect((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds([]);
        setLastSelectedIndex(null);
        setBulkStatus('');
      }
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    if (!checked) { setSelectedIds([]); return; }
    setSelectedIds(filteredVouchers.map((voucher) => voucher.id));
  };

  const handleSelectRow = (voucherId, index, event) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = !next.has(voucherId);

      if (event?.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i += 1) {
          const rangeId = filteredVouchers[i]?.id;
          if (!rangeId) continue;
          if (shouldSelect) next.add(rangeId); else next.delete(rangeId);
        }
      } else if (shouldSelect) {
        next.add(voucherId);
      } else {
        next.delete(voucherId);
      }
      return Array.from(next);
    });
    setLastSelectedIndex(index);
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;

    const allowedBulkStatuses = new Set(bulkCashStatusOptions.map((option) => option.value));
    if (!allowedBulkStatuses.has(bulkStatus)) {
      showWarning('Selected vouchers do not share a valid transition for this status.');
      return;
    }

    try {
      const results = await Promise.allSettled(
        selectedIds.map((voucherId) =>
          apiService.finance.updateCashVoucher(
            voucherId,
            buildVoucherStatusUpdatePayload({
              user,
              status: bulkStatus,
              cancelReason: "Cancelled by user",
            }),
          ),
        )
      );
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      await loadVouchers();
      setSelectedIds([]);
      setLastSelectedIndex(null);
      setBulkStatus('');

      if (failedCount > 0 && successCount > 0) {
        showWarning(`Bulk update completed: ${successCount} updated, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk update failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess(`Successfully updated ${successCount} vouchers to ${bulkStatus}`);
      }
    } catch (error) {
      console.error('Failed to bulk update voucher status:', error);
      showError('Failed to bulk update voucher status');
    }
  };

  const executeBulkDelete = async () => {
    try {
      let result;
      if (apiService.finance.bulkDeleteVouchers) {
         result = await apiService.finance.bulkDeleteVouchers('cash', selectedIds);
      } else {
         const fallbackResults = await Promise.allSettled(selectedIds.map(id => apiService.finance.deleteCashVoucher(id)));
         const deletedCount = fallbackResults.filter((entry) => entry.status === 'fulfilled').length;
         const failedCount = fallbackResults.length - deletedCount;
         result = {
          attempted_count: fallbackResults.length,
          deleted_count: deletedCount,
          failed_count: failedCount,
         };
      }

      const attemptedCount = result?.attempted_count ?? selectedIds.length;
      const deletedCount = result?.deleted_count ?? attemptedCount;
      const failedCount = result?.failed_count ?? Math.max(0, attemptedCount - deletedCount);

      await loadVouchers();
      setSelectedIds([]);
      setLastSelectedIndex(null);

      if (failedCount > 0 && deletedCount > 0) {
        showWarning(`Bulk delete completed: ${deletedCount} deleted, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk delete failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess('Selected vouchers deleted successfully');
      }
    } catch (error) {
      console.error('Failed to bulk delete vouchers:', error);
      showError('Failed to delete selected vouchers');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    openConfirmDialog({
      title: 'Delete Selected Vouchers',
      message: `Delete ${selectedIds.length} selected vouchers? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: executeBulkDelete,
    });
  };

  // --- DATA LOADING & CALCULATIONS ---
  const loadVouchers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = {};
      if (transactionFilter !== 'all') params.transaction_type = transactionFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await apiService.finance.getCashVouchers(params);
      const voucherCandidates =
        response?.data?.vouchers ??
        response?.vouchers ??
        response?.data ??
        response;
      const voucherList = Array.isArray(voucherCandidates) ? voucherCandidates : [];
      
      // Client-side filtering by month/year
      const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
      const filteredVouchers = voucherList.filter((voucher) => {
        if (selectedMonth === 'all' && selectedYear === 'all') return true;
        const date = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
        if (!isValidDate(date)) return false;
        
        const matchesMonth = selectedMonth === 'all' ? true : date.getMonth() + 1 === selectedMonth;
        const matchesYear = selectedYear === 'all' ? true : date.getFullYear() === selectedYear;
        return matchesMonth && matchesYear;
      });
      
      setVouchers(filteredVouchers);
    } catch (error) {
      console.error('Failed to load cash vouchers:', error);
      setVouchers([]);
      setLoadError(error?.message || 'Failed to load cash vouchers.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (voucherList) => {
    const activeVouchers = voucherList.filter(v => v.status !== 'cancelled');
    const debitVouchers = activeVouchers.filter(v => v.transaction_type === 'debit');
    const creditVouchers = activeVouchers.filter(v => v.transaction_type === 'credit');

    const debitTotal = debitVouchers.reduce((sum, v) => sum + parseFloat(v.total_amount || v.dr_amount || 0), 0);
    const creditTotal = creditVouchers.reduce((sum, v) => sum + parseFloat(v.total_amount || v.cr_amount || 0), 0);

    setSummary({
      debit: { count: debitVouchers.length, total: debitTotal },
      credit: { count: creditVouchers.length, total: creditTotal },
      netPosition: creditTotal - debitTotal
    });
  };

  // --- CRUD ACTIONS ---
  const handleCreateVoucher = async (voucherData) => {
    try {
      await apiService.finance.createCashVoucher(voucherData);
      loadVouchers();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create voucher:', error);
      throw error;
    }
  };

  const handleEditVoucher = async (voucherData) => {
    try {
      const normalizeBackendCashStatus = (status) => {
        const normalized = String(status || 'pending').toLowerCase();
        return CASH_BACKEND_ALLOWED_STATUSES.has(normalized) ? normalized : 'pending';
      };

      const currentStatus = normalizeBackendCashStatus(selectedVoucher?.status || 'pending');
      const requestedStatus = normalizeBackendCashStatus(voucherData?.status || currentStatus);
      const canTransition = requestedStatus === currentStatus || getCashAllowedTransitions(currentStatus).includes(requestedStatus);
      const safeStatus = canTransition ? requestedStatus : currentStatus;
      const statusAuditPayload = buildVoucherStatusUpdatePayload({
        user,
        status: safeStatus,
        cancelReason: 'Cancelled by user',
      });
      const actorId = statusAuditPayload?.actor_id ?? null;

      if (!canTransition) {
        showWarning(`Invalid transition (${currentStatus} → ${requestedStatus}). Keeping status as ${currentStatus}.`);
      }

      await apiService.finance.updateCashVoucher(selectedVoucher.id, {
        ...voucherData,
        ...statusAuditPayload,
        ...(safeStatus === 'approved' && actorId ? { approved_by: actorId } : {}),
      });
      loadVouchers();
      setShowEditModal(false);
      setSelectedVoucher(null);
    } catch (error) {
      console.error('Failed to update voucher:', error);
      throw error;
    }
  };

  const handleViewVoucher = async (voucher) => {
    setSelectedVoucher(voucher);
    setShowViewModal(true);

    try {
      const response = await apiService.finance.getCashVoucher(voucher.id);
      const detailedVoucher = response?.data || response?.voucher || response;

      if (detailedVoucher) {
        setSelectedVoucher((previous) => ({
          ...(previous || {}),
          ...detailedVoucher,
        }));
      }
    } catch (error) {
      console.error('Failed to load cash voucher details:', error);
      showWarning('Showing summary only. Failed to load full voucher details.');
    }
  };

  const handleEditClick = (voucher) => {
    setSelectedVoucher(voucher);
    setShowEditModal(true);
  };

  const executeDeleteVoucher = async (voucherId) => {
    try {
      await apiService.finance.deleteCashVoucher(voucherId);
      showSuccess('Cash voucher deleted successfully');
      await loadVouchers();
    } catch (error) {
      console.error('Failed to delete voucher:', error);
      showError('Failed to delete voucher: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    const voucher = vouchers.find(v => v.id === voucherId);
    const message = voucher 
      ? `Are you sure you want to delete voucher ${voucher.voucher_number}?` 
      : 'Are you sure you want to delete this voucher?';

    openConfirmDialog({
      title: 'Delete Cash Voucher',
      message,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => executeDeleteVoucher(voucherId),
    });
  };

  const handleStatusChange = async (voucherId, newStatus) => {
    try {
      const voucher = vouchers.find((item) => item.id === voucherId);
      const currentStatus = String(voucher?.status || 'pending').toLowerCase();
      if (newStatus === currentStatus) return;

      const allowedTransitions = getCashAllowedTransitions(currentStatus);
      if (!allowedTransitions.includes(newStatus)) {
        showWarning('Invalid status transition for this voucher.');
        return;
      }

      await apiService.finance.updateCashVoucher(
        voucherId,
        buildVoucherStatusUpdatePayload({
          user,
          status: newStatus,
          cancelReason: "Cancelled by user",
        }),
      );
      setVouchers(prev => prev.map(v => v.id === voucherId ? { ...v, status: newStatus } : v));
      showSuccess(`Voucher status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      showError('Failed to update voucher status');
    }
  };

  const handleExportExcel = async () => {
    if (vouchers.length === 0) { showWarning('No vouchers available to export.'); return; }
    try {
      const dateRange = { 
        start: vouchers[vouchers.length - 1].voucher_date, 
        end: vouchers[0].voucher_date 
      };
      await generateCashVoucherReport(vouchers, dateRange);
      showSuccess('Excel report generated successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showError('Failed to generate Excel report');
    }
  };

  const handleImportVouchers = async (vouchersToImport) => {
    try {
      const response = await apiService.finance.request('/api/finance-payroll/cash-vouchers/import', {
        method: 'POST', body: JSON.stringify({ vouchers: vouchersToImport })
      });

      const { importedCount, updatedCount, skippedCount } = normalizeVoucherImportResponse(response);

      await loadVouchers();

      if (importedCount > 0 || updatedCount > 0 || skippedCount > 0) {
        const skippedSuffix = skippedCount > 0 ? `, ${skippedCount} skipped` : "";
        showSuccess(`Import completed! ${importedCount} new, ${updatedCount} updated${skippedSuffix}.`);
      } else {
        showSuccess('Import completed!');
      }
    } catch (error) {
      console.error('Failed to import vouchers:', error);
      showError('Failed to import vouchers: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  // --- HELPERS ---
  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const formatDate = (date) => !date ? 'N/A' : new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const getMonthOptions = () => [
    { value: 'all', label: 'All Months' }, { value: 1, label: 'January' }, { value: 2, label: 'February' }, 
    { value: 3, label: 'March' }, { value: 4, label: 'April' }, { value: 5, label: 'May' }, 
    { value: 6, label: 'June' }, { value: 7, label: 'July' }, { value: 8, label: 'August' }, 
    { value: 9, label: 'September' }, { value: 10, label: 'October' }, { value: 11, label: 'November' }, 
    { value: 12, label: 'December' }
  ];

  // --- SUB-COMPONENTS ---
  const StatusBadge = ({ status }) => {
    const configs = {
      draft: { bg: 'bg-neutral-100 dark:bg-neutral-900', text: 'text-neutral-700 dark:text-neutral-400', icon: AlertCircle },
      cancelled: { bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-gray-500', icon: X },
      pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle },
      approved: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', icon: CheckCircle2 },
      released: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: ArrowRight },
      received: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
      rejected: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', icon: X },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <Icon size={12} strokeWidth={3} />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  const TransactionBadge = ({ type }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
      type === 'debit' 
        ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-900 dark:text-rose-400' 
        : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400'
    }`}>
      {type}
    </span>
  );

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-10">
      {/* 1. SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Debit</p>
            <h3 className={`text-2xl font-bold font-mono ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{formatCurrency(summary.debit.total)}</h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">{summary.debit.count} transactions</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10"><TrendingDown className="text-rose-500" size={24} /></div>
        </div>
        
        <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Credit</p>
            <h3 className={`text-2xl font-bold font-mono ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{formatCurrency(summary.credit.total)}</h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">{summary.credit.count} transactions</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10"><TrendingUp className="text-emerald-500" size={24} /></div>
        </div>

        <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Net Position</p>
            <h3 className={`text-2xl font-bold font-mono ${summary.netPosition >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>{formatCurrency(Math.abs(summary.netPosition))}</h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">{summary.netPosition >= 0 ? 'Surplus' : 'Deficit'}</p>
          </div>
          <div className={`p-3 rounded-xl ${summary.netPosition >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10'}`}>
            <Banknote className={summary.netPosition >= 0 ? 'text-blue-500' : 'text-orange-500'} size={24} />
          </div>
        </div>
      </div>

      {/* 2. TOOLBAR & BULK ACTIONS */}
      <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center sticky top-2 z-20">
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
           {/* Search */}
           <div className="relative flex-1 sm:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Search vouchers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
           </div>
           
           {/* Filters */}
           <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 cursor-pointer"
              >
                {getMonthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
                <option value="received">Received</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end items-center">
            {isMultiSelect && selectedIds.length > 0 && (
               <div className="flex items-center gap-2 mr-2 bg-stone-100 dark:bg-stone-700 p-1 rounded-lg">
                  <select 
                    value={bulkStatus} 
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="bg-transparent text-sm border-none focus:ring-0 text-gray-700 dark:text-white"
                  >
                    <option value="">Bulk Action...</option>
                    {bulkCashStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button onClick={handleBulkStatusUpdate} disabled={!bulkStatus || bulkCashStatusOptions.length === 0} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"><CheckSquare size={16}/></button>
                  <div className="w-px h-4 bg-stone-300 dark:bg-stone-600 mx-1"></div>
                  <button onClick={handleBulkDelete} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
               </div>
            )}
            
            <button onClick={toggleMultiSelect} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isMultiSelect ? 'bg-stone-800 text-white' : 'bg-stone-100 hover:bg-stone-200 text-gray-700 dark:bg-stone-700 dark:text-gray-200'}`}>
              {isMultiSelect ? `Cancel (${selectedIds.length})` : 'Select'}
            </button>
            
            <div className="h-8 w-px bg-stone-200 dark:bg-stone-700 mx-1 hidden sm:block"></div>

            <button onClick={() => setShowImportModal(true)} className="p-2.5 rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors" title="Import Excel">
              <Upload size={20} />
            </button>
            <button onClick={handleExportExcel} disabled={vouchers.length === 0} className="p-2.5 rounded-xl text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors disabled:opacity-50" title="Export Excel">
              <Download size={20} />
            </button>
            <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95">
              <Plus size={18} /> New Voucher
            </button>
        </div>
      </div>

      {/* 3. TABLE/LIST CONTENT */}
      {loadError ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-stone-800 rounded-2xl border border-red-100 dark:border-red-900/40 text-center px-6">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full mb-4"><AlertCircle size={26} className="text-red-500" /></div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Couldn’t load vouchers</h3>
          <p className="text-sm text-gray-500 mt-1 mb-5 max-w-md">{loadError}</p>
          <button onClick={loadVouchers} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p>Loading vouchers...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-stone-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <div className="p-4 bg-stone-50 dark:bg-stone-700 rounded-full mb-4"><Banknote size={32} className="text-gray-400" /></div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No vouchers found</h3>
          <p className="text-gray-500 text-sm mb-6">Try adjusting your filters or create a new one.</p>
          <button onClick={() => setShowCreateModal(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Create Now</button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50/50 dark:bg-stone-900/50 border-b border-gray-100 dark:border-gray-700 backdrop-blur-sm sticky top-0 z-10">
                  <tr>
                    {isMultiSelect && (
                      <th className="w-12 px-6 py-4 text-left">
                        <input type="checkbox" checked={filteredVouchers.length > 0 && selectedIds.length === filteredVouchers.length} onChange={(e) => handleSelectAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date & No.</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Payee / Company</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Debit</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Credit</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider pl-8">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredVouchers.map((voucher, index) => (
                    <tr 
                      key={voucher.id} 
                      onClick={(e) => { if (!isMultiSelect) return; if (e.target.closest('button, select')) return; handleSelectRow(voucher.id, index, e); }}
                      className={`group transition-colors ${isMultiSelect && selectedIds.includes(voucher.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-700/30'}`}
                    >
                      {isMultiSelect && (
                        <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(voucher.id)} readOnly className="h-4 w-4 rounded border-gray-300 text-blue-600" /></td>
                      )}
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 dark:text-white font-mono">{voucher.voucher_number}</div>
                        <div className="text-xs text-gray-500">{formatDate(voucher.voucher_date)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={voucher.company_payee_payor}>{voucher.company_payee_payor}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{voucher.remarks || 'No remarks'}</div>
                      </td>
                      <td className="px-6 py-4"><TransactionBadge type={voucher.transaction_type} /></td>
                      <td className="px-6 py-4 text-right">
                         <div className={`text-sm font-mono font-bold ${voucher.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                            {voucher.dr_amount ? formatCurrency(voucher.dr_amount) : '—'}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className={`text-sm font-mono font-bold ${voucher.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                            {voucher.cr_amount ? formatCurrency(voucher.cr_amount) : '—'}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const selectableStatuses = getCashSelectableStatuses(voucher.status);
                          return (
                        <select
                          value={voucher.status || 'pending'}
                          onChange={(e) => handleStatusChange(voucher.id, e.target.value)}
                          className={`text-xs font-semibold py-1 pl-2 pr-8 rounded-lg border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none bg-transparent ${voucher.status === 'cancelled' ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}
                        >
                          {selectableStatuses.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {CASH_STATUS_LABELS[statusValue] || statusValue}
                            </option>
                          ))}
                        </select>
                          );
                        })()}
                        <div className="mt-1"><StatusBadge status={voucher.status} /></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleViewVoucher(voucher)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={16} /></button>
                          <button onClick={() => handleEditClick(voucher)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteVoucher(voucher.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4">
            {filteredVouchers.map((voucher) => (
              <div key={voucher.id} className="bg-white dark:bg-stone-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-gray-500">{voucher.voucher_number}</span>
                      <TransactionBadge type={voucher.transaction_type} />
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{voucher.company_payee_payor}</h4>
                    <p className="text-xs text-gray-500">{formatDate(voucher.voucher_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-mono font-bold ${voucher.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                      {formatCurrency(voucher.dr_amount || voucher.cr_amount)}
                    </p>
                    <StatusBadge status={voucher.status} />
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                   <button onClick={() => handleViewVoucher(voucher)} className="text-sm font-medium text-blue-600">View</button>
                   <button onClick={() => handleEditClick(voucher)} className="text-sm font-medium text-emerald-600">Edit</button>
                   <button onClick={() => handleDeleteVoucher(voucher.id)} className="text-sm font-medium text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODALS */}
      {showCreateModal && (
        <CashVoucherBulkCreator
          voucherType="cash"
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setOcrDraftVoucher(null);
            setOcrDraftVouchers([]);
          }}
          onSubmit={handleCreateVoucher}
          chartOfAccounts={chartOfAccounts}
          isDarkMode={isDarkMode}
          initialDraft={ocrDraftVoucher}
          initialDrafts={ocrDraftVouchers}
        />
      )}

      {showEditModal && selectedVoucher && (
        <CashVoucherBulkCreator
          voucherType="cash"
          isOpen={showEditModal}
          editMode
          onClose={() => { setShowEditModal(false); setSelectedVoucher(null); }}
          onSubmit={handleEditVoucher}
          chartOfAccounts={chartOfAccounts}
          isDarkMode={isDarkMode}
          initialData={selectedVoucher}
        />
      )}

      {showViewModal && selectedVoucher && (
        <VoucherViewModal voucher={selectedVoucher} onClose={() => { setShowViewModal(false); setSelectedVoucher(null); }} isDarkMode={isDarkMode} />
      )}

      <CashVoucherImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportVouchers}
        isDarkMode={isDarkMode}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={() => confirmDialog.onConfirm?.()}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// --- FULLY DETAILED VIEW MODAL (RESTORED) ---
function VoucherViewModal({ voucher, onClose, isDarkMode }) {
  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const formatDate = (date) => !date ? 'N/A' : new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const lineItems = Array.isArray(voucher?.line_items)
    ? voucher.line_items
    : Array.isArray(voucher?.lineItems)
      ? voucher.lineItems
      : [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-stone-800' : 'bg-white'}`}>
        {/* Modal Header */}
        <div className={`px-6 py-5 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><Banknote size={24} /></div>
             <div>
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{voucher.voucher_number || `CV-${voucher.id}`}</h2>
                <p className="text-sm text-gray-500">{formatDate(voucher.voucher_date)}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"><X size={20} className="text-gray-500" /></button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto space-y-8">
           {/* Summary Block */}
           <div className={`p-6 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${isDarkMode ? 'bg-stone-750 border-gray-700' : 'bg-stone-50 border-gray-200'}`}>
              <div>
                 <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Total Amount</span>
                 <div className={`text-3xl font-mono font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(parseFloat(voucher.dr_amount || 0) + parseFloat(voucher.cr_amount || 0))}
                 </div>
              </div>
              <div className="flex gap-8">
                  <div className="text-right">
                      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block mb-1">Status</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
                        {voucher.status}
                      </span>
                  </div>
                  <div className="text-right">
                      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block mb-1">Type</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${voucher.transaction_type === 'debit' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {voucher.transaction_type}
                      </span>
                  </div>
              </div>
           </div>

           {/* Details Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              <InfoGroup label="Payee / Company" value={voucher.company_payee_payor} isDarkMode={isDarkMode} />
              <InfoGroup label="Cash Source" value={voucher.cash_source} isDarkMode={isDarkMode} />
              <InfoGroup label="Invoice #" value={voucher.invoice_number} isDarkMode={isDarkMode} />
              <InfoGroup label="PO #" value={voucher.po_number} isDarkMode={isDarkMode} />
              <InfoGroup label="With Copy?" value={voucher.with_copy ? 'Yes' : 'No'} isDarkMode={isDarkMode} />
           </div>

           {/* Remarks */}
           {voucher.remarks && (
             <div>
               <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">Remarks</h4>
               <p className={`text-sm p-4 rounded-lg border ${isDarkMode ? 'bg-stone-900/50 border-gray-700 text-gray-300' : 'bg-stone-50 border-gray-100 text-gray-700'}`}>{voucher.remarks}</p>
             </div>
           )}

           {/* Detailed Line Items Table (RESTORED Columns) */}
           {lineItems.length > 0 && (
             <div>
               <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Line Items</h4>
               <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                 <table className="w-full">
                   <thead className={isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Reference</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Credit</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                      </tr>
                   </thead>
                   <tbody className={isDarkMode ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                     {lineItems.map((item, idx) => {
                       const dr = parseFloat(item.debit_amount || 0);
                       const cr = parseFloat(item.credit_amount || 0);
                       return (
                         <tr key={idx} className={isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-50'}>
                           <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.description}</td>
                           <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.reference || '-'}</td>
                           <td className={`px-4 py-3 text-sm text-right font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{dr ? formatCurrency(dr) : '-'}</td>
                           <td className={`px-4 py-3 text-sm text-right font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{cr ? formatCurrency(cr) : '-'}</td>
                           <td className={`px-4 py-3 text-sm text-right font-mono font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(dr + cr)}</td>
                         </tr>
                       );
                     })}
                   </tbody>
                   <tfoot className={isDarkMode ? 'bg-stone-800/50' : 'bg-stone-50'}>
                     <tr>
                        <td colSpan={2} className="px-4 py-3 text-sm font-bold text-right text-gray-500">Totals:</td>
                        <td className="px-4 py-3 text-sm text-right font-bold font-mono text-rose-600">
                           {formatCurrency(voucher.line_items.reduce((s, i) => s + parseFloat(i.debit_amount || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold font-mono text-emerald-600">
                           {formatCurrency(voucher.line_items.reduce((s, i) => s + parseFloat(i.credit_amount || 0), 0))}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-bold font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                           {formatCurrency(voucher.line_items.reduce((s, i) => s + parseFloat(i.debit_amount || 0) + parseFloat(i.credit_amount || 0), 0))}
                        </td>
                     </tr>
                   </tfoot>
                 </table>
               </div>
             </div>
           )}
        </div>

        <div className={`px-8 py-5 border-t flex justify-end ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-gray-800 font-medium transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

const InfoGroup = ({ label, value, isDarkMode }) => (
  <div>
    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">{label}</h4>
    <p className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value || '—'}</p>
  </div>
);