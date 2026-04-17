import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Plus,
  TrendingUp,
  TrendingDown,
  Search,
  Eye,
  Edit2,
  Trash2,
  X,
  Tag,
  Download,
  Upload,
  Filter,
  MoreHorizontal,
  CheckSquare,
  Square,
  ArrowRight,
  Copy,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import apiService from "../../../../utils/api/api-service";
import CheckVoucherBulkCreator from "../../components/forms/CheckVoucherBulkCreator";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/main_ui/Toast";
import ConfirmDialog from "../../components/main_ui/ConfirmDialog";
import { generateCheckVoucherReport } from "../../../../utils/reports/CheckVoucherReport";
import CheckVoucherImportModal from "../../components/modals/CheckVoucherImportModal";
import {
  buildVoucherApprovePayload,
  buildVoucherCancelPayload,
  buildVoucherStatusUpdatePayload,
} from "../../helpers/voucherAuditPayload";
import { normalizeVoucherImportResponse } from "../../helpers/importResponseUtils";

/**
 * Check Vouchers Tab - Full CRUD functionality for check vouchers
 * UI/UX Upgraded Version
 */
export default function CheckVouchersTab({ chartOfAccounts = [], highlightVoucherNumber = null }) {
  const { isDarkMode, user } = useAuth();
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();

  // State
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Month/Year filter state
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");

  // Summary
  const [summary, setSummary] = useState({
    debit: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    netPosition: 0,
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [ocrDraftVoucher, setOcrDraftVoucher] = useState(null);
  const [ocrDraftVouchers, setOcrDraftVouchers] = useState([]);

  // Multi-select
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    type: 'danger',
    onConfirm: null,
  });

  const openConfirmDialog = ({ title, message, confirmText = 'Confirm', type = 'danger', onConfirm }) => {
    setConfirmDialog({ isOpen: true, title, message, confirmText, type, onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  useEffect(() => {
    loadVouchers();
  }, [transactionFilter, statusFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    setSelectedIds([]);
    setLastSelectedIndex(null);
  }, [transactionFilter, statusFilter, searchTerm, selectedMonth, selectedYear]);

  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      if (detail?.type === "check" && detail?.voucherId) {
        handleEditClick({ id: detail.voucherId });
      }
    };
    window.addEventListener("openVoucherEditor", handler);
    return () => window.removeEventListener("openVoucherEditor", handler);
  }, []);

  useEffect(() => {
    if (highlightVoucherNumber && highlightVoucherNumber.startsWith("CHK-")) {
      setSearchTerm(highlightVoucherNumber);
    }
  }, [highlightVoucherNumber]);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'check_voucher') return;

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
        voucher.bank_check_no,
        voucher.bank_deposited,
        voucher.po_number,
        voucher.si_number,
        voucher.cgr_number,
        voucher.qi_qf_qs,
        voucher.dr_number,
        voucher.remarks,
      ];
      return fields.some((value) =>
        String(value ?? "").toLowerCase().includes(query),
      );
    });
  }, [vouchers, searchTerm]);

  const CHECK_STATUS_ORDER = ['draft', 'pending', 'approved', 'released', 'received', 'rejected', 'cancelled', 'cleared', 'bounced'];
  const CHECK_STATUS_LABELS = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    released: 'Released',
    received: 'Received',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    cleared: 'Cleared',
    bounced: 'Bounced',
  };
  const CHECK_ALLOWED_TRANSITIONS = {
    draft: ['pending', 'cancelled'],
    pending: ['approved', 'cancelled'],
    approved: ['released', 'received', 'cancelled'],
    released: ['received', 'cancelled'],
    received: [],
    rejected: ['pending', 'cancelled'],
    cancelled: ['draft', 'pending'],
    cleared: ['cancelled'],
    bounced: ['pending', 'cancelled'],
  };

  const getCheckAllowedTransitions = (status, transactionType) => {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    const normalizedType = String(transactionType || '').toLowerCase();
    const baseTransitions = CHECK_ALLOWED_TRANSITIONS[normalizedStatus] || [];

    return baseTransitions.filter((candidate) => {
      if (candidate === 'released') return normalizedType === 'credit';
      if (candidate === 'received') return normalizedType === 'debit';
      return true;
    });
  };

  const getCheckSelectableStatuses = (status, transactionType) => {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    const options = [normalizedStatus, ...getCheckAllowedTransitions(normalizedStatus, transactionType)];
    return CHECK_STATUS_ORDER.filter((candidate) => options.includes(candidate));
  };

  const getSelectedCheckVouchers = () => vouchers.filter((voucher) => selectedIds.includes(voucher.id));

  const getBulkCheckStatusOptions = () => {
    const selectedVouchers = getSelectedCheckVouchers();
    if (selectedVouchers.length === 0) return [];

    const intersections = selectedVouchers
      .map((voucher) => new Set(getCheckAllowedTransitions(voucher.status, voucher.transaction_type)))
      .reduce((acc, statusSet) => {
        if (!acc) return statusSet;
        return new Set([...acc].filter((value) => statusSet.has(value)));
      }, null);

    if (!intersections) return [];
    return CHECK_STATUS_ORDER
      .filter((status) => intersections.has(status))
      .map((status) => ({ value: status, label: CHECK_STATUS_LABELS[status] || status }));
  };

  const bulkCheckStatusOptions = getBulkCheckStatusOptions();

  useEffect(() => {
    calculateSummary(filteredVouchers);
  }, [filteredVouchers]);

  const toggleMultiSelect = () => {
    setIsMultiSelect((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds([]);
        setLastSelectedIndex(null);
        setBulkStatus("");
      }
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    if (!checked) { setSelectedIds([]); return; }
    setSelectedIds(filteredVouchers.map((v) => v.id));
  };

  const handleSelectRow = (voucherId, index, event) => {
    const isCurrentlySelected = selectedIds.includes(voucherId);
    const shouldSelect =
      event?.target?.type === "checkbox" ? event.target.checked : !isCurrentlySelected;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (event?.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i += 1) {
          const rangeId = filteredVouchers[i]?.id;
          if (!rangeId) continue;
          if (shouldSelect) next.add(rangeId);
          else next.delete(rangeId);
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

  const getMonthOptions = () => [
    { value: "all", label: "All Months" },
    { value: 1, label: "January" }, { value: 2, label: "February" },
    { value: 3, label: "March" }, { value: 4, label: "April" },
    { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" },
    { value: 9, label: "September" }, { value: 10, label: "October" },
    { value: 11, label: "November" }, { value: 12, label: "December" },
  ];

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [{ value: "all", label: "All Years" }];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push({ value: i, label: i.toString() });
    }
    return years;
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    const allowedBulkStatuses = new Set(bulkCheckStatusOptions.map((option) => option.value));
    if (!allowedBulkStatuses.has(bulkStatus)) {
      showWarning('Selected vouchers do not share a valid transition for this status.');
      return;
    }

    try {
      const results = await Promise.allSettled(
        selectedIds.map(async (id) => {
          const voucher = vouchers.find((v) => v.id === id);
          const currentStatus = String(voucher?.status || '').toLowerCase();

          if (bulkStatus === "released" || bulkStatus === "received") {
            if (currentStatus === 'pending' || currentStatus === 'draft') {
              await apiService.finance.approveCheckVoucher(id, buildVoucherApprovePayload({ user }));
            } else {
              await apiService.finance.updateCheckVoucher(
                id,
                buildVoucherStatusUpdatePayload({ user, status: bulkStatus }),
              );
            }
            return;
          }

          if (bulkStatus === "cancelled") {
            await apiService.finance.cancelCheckVoucher(
              id,
              buildVoucherCancelPayload({ user, reason: "Cancelled by user" }),
            );
            return;
          }

          await apiService.finance.updateCheckVoucher(
            id,
            buildVoucherStatusUpdatePayload({ user, status: bulkStatus }),
          );
        }),
      );
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      await loadVouchers();
      setSelectedIds([]); setLastSelectedIndex(null);
      setBulkStatus(""); setIsMultiSelect(false);

      if (failedCount > 0 && successCount > 0) {
        showWarning(`Bulk update completed: ${successCount} updated, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk update failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess('Bulk status update successful');
      }
    } catch (error) {
      console.error("Failed to bulk update voucher status:", error);
      showError('Failed to bulk update voucher status');
    }
  };

  const executeBulkDelete = async () => {
    try {
      const result = await apiService.finance.bulkDeleteVouchers("check", selectedIds);
      const attemptedCount = result?.attempted_count ?? selectedIds.length;
      const deletedCount = result?.deleted_count ?? attemptedCount;
      const failedCount = result?.failed_count ?? Math.max(0, attemptedCount - deletedCount);

      await loadVouchers();
      setSelectedIds([]); setLastSelectedIndex(null); setIsMultiSelect(false);

      if (failedCount > 0 && deletedCount > 0) {
        showWarning(`Bulk delete completed: ${deletedCount} deleted, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk delete failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess('Selected vouchers deleted');
      }
    } catch (error) {
      console.error("Failed to bulk delete vouchers:", error);
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

  const loadVouchers = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const params = {};
      if (transactionFilter !== "all") params.transaction_type = transactionFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await apiService.finance.getCheckVouchers(params);
      const voucherCandidates =
        response?.data?.vouchers ??
        response?.vouchers ??
        response?.data ??
        response;
      const voucherList = Array.isArray(voucherCandidates) ? voucherCandidates : [];

      const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
      const filtered = voucherList.filter((voucher) => {
        if (selectedMonth === "all" && selectedYear === "all") return true;
        const date = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
        if (!isValidDate(date)) return false;
        const matchesMonth = selectedMonth === "all" ? true : date.getMonth() + 1 === selectedMonth;
        const matchesYear = selectedYear === "all" ? true : date.getFullYear() === selectedYear;
        return matchesMonth && matchesYear;
      });

      setVouchers(filtered);
    } catch (error) {
      console.error("Failed to load check vouchers:", error);
      setVouchers([]);
      setLoadError(error?.message || "Failed to load check vouchers.");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (voucherList) => {
    const active = voucherList.filter((v) => v.status !== "cancelled");
    const debit = active.filter((v) => v.transaction_type === "debit");
    const credit = active.filter((v) => v.transaction_type === "credit");
    const debitTotal = debit.reduce((s, v) => s + parseFloat(v.total_amount || v.dr_amount || 0), 0);
    const creditTotal = credit.reduce((s, v) => s + parseFloat(v.total_amount || v.cr_amount || 0), 0);
    setSummary({
      debit: { count: debit.length, total: debitTotal },
      credit: { count: credit.length, total: creditTotal },
      netPosition: creditTotal - debitTotal,
    });
  };

  const handleCreateVoucher = async (voucherData) => {
    try {
      if (Array.isArray(voucherData)) {
        await apiService.finance.createCheckVouchersBulk(voucherData);
        showSuccess('Check vouchers created successfully');
      } else {
        await apiService.finance.createCheckVoucher(voucherData);
        showSuccess('Check voucher created successfully');
      }
      loadVouchers();
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create voucher:", error);
      showError('Failed to create voucher: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const handleEditVoucher = async (voucherData) => {
    try {
      await apiService.finance.updateCheckVoucher(selectedVoucher.id, voucherData);
      loadVouchers();
      setShowEditModal(false);
      setSelectedVoucher(null);
      showSuccess('Voucher updated successfully');
    } catch (error) {
      console.error("Failed to update voucher:", error);
      showError('Failed to update voucher: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const executeDeleteVoucher = async (voucherId) => {
    try {
      await apiService.finance.deleteCheckVoucher(voucherId);
      loadVouchers();
      showSuccess('Voucher deleted successfully');
    } catch (error) {
      console.error("Failed to delete voucher:", error);
      showError('Failed to delete voucher: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    openConfirmDialog({
      title: 'Delete Check Voucher',
      message: 'Are you sure you want to delete this check voucher?',
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => executeDeleteVoucher(voucherId),
    });
  };

  const handleViewVoucher = async (voucher) => {
    try {
      const response = await apiService.finance.getCheckVoucher(voucher.id);
      const data = response.voucher || response.data || response;
      setSelectedVoucher(data);
      setShowViewModal(true);
    } catch (error) {
      console.error("Failed to fetch voucher details:", error);
      showError('Failed to load voucher details');
    }
  };

  const handleEditClick = async (voucher) => {
    try {
      const response = await apiService.finance.getCheckVoucher(voucher.id);
      const data = response.voucher || response.data || response;
      setSelectedVoucher(data);
      setShowEditModal(true);
    } catch (error) {
      console.error("Failed to fetch voucher details:", error);
      showError('Failed to load voucher details');
    }
  };

  const handleStatusChange = async (voucherId, newStatus) => {
    const previousVouchers = vouchers;
    try {
      const currentVoucher = previousVouchers.find((v) => v.id === voucherId);
      const currentStatus = String(currentVoucher?.status || '').toLowerCase();
      if (newStatus === currentStatus) return;

      const allowedTransitions = getCheckAllowedTransitions(currentStatus, currentVoucher?.transaction_type);
      if (!allowedTransitions.includes(newStatus)) {
        showWarning('Invalid status transition for this voucher.');
        return;
      }

      setVouchers((prev) => {
        const updated = prev.map((v) => v.id === voucherId ? { ...v, status: newStatus } : v);
        calculateSummary(updated);
        return updated;
      });

      if (newStatus === "released" || newStatus === "received") {
        if (currentStatus === 'pending' || currentStatus === 'draft') {
          await apiService.finance.approveCheckVoucher(voucherId, buildVoucherApprovePayload({ user }));
        } else {
          await apiService.finance.updateCheckVoucher(
            voucherId,
            buildVoucherStatusUpdatePayload({ user, status: newStatus }),
          );
        }
      } else if (newStatus === "cancelled") {
        await apiService.finance.cancelCheckVoucher(
          voucherId,
          buildVoucherCancelPayload({ user, reason: "Cancelled by user" }),
        );
      } else {
        await apiService.finance.updateCheckVoucher(voucherId, {
          ...buildVoucherStatusUpdatePayload({ user, status: newStatus }),
        });
      }
      await loadVouchers();
      showSuccess(`Voucher status updated to ${newStatus}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      setVouchers(previousVouchers);
      calculateSummary(previousVouchers);
      showError('Failed to update voucher status');
    }
  };

  const formatCurrency = (amount) =>
    `₱${parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  };

  const getStatusColor = (status) => {
    const configs = {
      draft:     { bg: "bg-neutral-100 dark:bg-neutral-900/20", text: "text-neutral-700 dark:text-neutral-400", border: "border-neutral-200 dark:border-neutral-800" },
      cancelled: { bg: "bg-stone-100 dark:bg-stone-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
      pending:   { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
      approved:  { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
      released:  { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
      received:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
      rejected:  { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
    };
    return configs[status] || configs.pending;
  };

  const getTransactionBadge = (type) => {
    if (type === "debit") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
          <TrendingDown size={12} /> Debit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
        <TrendingUp size={12} /> Credit
      </span>
    );
  };

  const getLineItemCount = (voucher) => voucher.line_items_count ?? 0;
  const getWithCopyCount = (voucher) => voucher.with_copy_count ?? 0;

  const handleExportExcel = async () => {
    if (vouchers.length === 0) {
      showWarning('No vouchers available to export.');
      return;
    }
    try {
      // Fetch full details for all vouchers to get their line items for flattening
      const fullVouchers = await Promise.all(
        vouchers.map(async (v) => {
          const response = await apiService.finance.getCheckVoucher(v.id);
          return response.voucher || response.data || response;
        })
      );

      const dateRange = {
        start: vouchers.length > 0 ? vouchers[vouchers.length - 1].voucher_date : new Date(),
        end: vouchers.length > 0 ? vouchers[0].voucher_date : new Date(),
      };
      await generateCheckVoucherReport(fullVouchers, dateRange);
      showSuccess('Excel report generated successfully');
    } catch (error) {
      console.error("Export failed:", error);
      showError('Failed to generate Excel report: ' + (error.message || 'Unknown error'));
    }
  };

  const handleImportVouchers = async (vouchersToImport) => {
    try {
      const response = await apiService.finance.request("/api/finance-payroll/check-vouchers/import", {
        method: "POST",
        body: JSON.stringify({ vouchers: vouchersToImport }),
      });

      const { importedCount, updatedCount, skippedCount } = normalizeVoucherImportResponse(response);

      await loadVouchers();

      if (importedCount > 0 || updatedCount > 0 || skippedCount > 0) {
        showSuccess(`Import completed! ${importedCount} new, ${updatedCount} updated, ${skippedCount} skipped.`);
      } else {
        showSuccess('Import completed!');
      }
    } catch (error) {
      console.error("Failed to import vouchers:", error);
      showError('Failed to import vouchers: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="group relative bg-white dark:bg-stone-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 dark:bg-rose-900/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                <TrendingDown size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Debit</span>
            </div>
            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(summary.debit.total)}
            </p>
            <p className="text-sm text-gray-500 mt-2 font-medium">{summary.debit.count} transactions</p>
          </div>
        </div>

        <div className="group relative bg-white dark:bg-stone-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Credit</span>
            </div>
            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(summary.credit.total)}
            </p>
            <p className="text-sm text-gray-500 mt-2 font-medium">{summary.credit.count} transactions</p>
          </div>
        </div>

        <div className={`relative p-6 rounded-2xl border shadow-sm overflow-hidden ${
          summary.netPosition >= 0
            ? "bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-800 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800"
            : "bg-gradient-to-br from-white to-rose-50/50 dark:from-gray-800 dark:to-rose-900/20 border-rose-200 dark:border-rose-800"
        }`}>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl ${
                summary.netPosition >= 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
              }`}>
                <CreditCard size={20} />
              </div>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Net Position</span>
            </div>
            <p className={`text-3xl font-mono font-bold tracking-tight ${
              summary.netPosition >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
            }`}>
              {formatCurrency(Math.abs(summary.netPosition))}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                summary.netPosition >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
              }`}>
                {summary.netPosition >= 0 ? "Surplus" : "Deficit"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 items-center">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by payee, #, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-stone-800 transition-all outline-none text-sm"
            />
          </div>

          <div className="flex w-full sm:w-auto gap-2 flex-wrap">
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => { const v = e.target.value; setSelectedMonth(v === "all" ? "all" : parseInt(v)); }}
                className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-400"
              >
                {getMonthOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => { const v = e.target.value; setSelectedYear(v === "all" ? "all" : parseInt(v)); }}
                className="w-full sm:w-32 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-400"
              >
                {getYearOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <button
              onClick={() => { setSelectedMonth(new Date().getMonth() + 1); setSelectedYear(new Date().getFullYear()); }}
              className="px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors font-medium whitespace-nowrap border border-blue-200 dark:border-blue-800"
            >
              Current Month
            </button>

            <div className="relative">
              <select
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value)}
                className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-400"
              >
                <option value="all">All Types</option>
                <option value="debit">Debit Only</option>
                <option value="credit">Credit Only</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-400"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
                <option value="received">Received</option>
                <option value="rejected">Rejected</option>
                <option value="cleared">Cleared</option>
                <option value="bounced">Bounced</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={toggleMultiSelect}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium border transition-all ${
              isMultiSelect
                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                : "bg-white dark:bg-stone-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-stone-50 dark:hover:bg-stone-600"
            }`}
          >
            {isMultiSelect ? <CheckSquare size={18} /> : <Square size={18} />}
            <span className="hidden sm:inline">{isMultiSelect ? "End Selection" : "Select"}</span>
          </button>

          <button onClick={() => setShowImportModal(true)} className="p-2.5 rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors" title="Import Excel">
            <Upload size={20} />
          </button>

          <button onClick={handleExportExcel} disabled={vouchers.length === 0} className="p-2.5 rounded-xl text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors disabled:opacity-50" title="Export Excel">
            <Download size={20} />
          </button>

          <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 text-sm font-medium shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus size={18} /> New Voucher
          </button>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {isMultiSelect && selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-stone-900 text-white p-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-4 mx-4 lg:mx-0 ring-1 ring-white/10">
            <div className="flex items-center gap-3 pl-2">
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-md">{selectedIds.length}</span>
              <span className="text-sm font-medium">items selected</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="bg-stone-800 border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none">
                <option value="" disabled>Set Status To...</option>
                {bulkCheckStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button onClick={handleBulkStatusUpdate} disabled={!bulkStatus || bulkCheckStatusOptions.length === 0} className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-50 text-blue-300 disabled:cursor-not-allowed" title="Update Status">
                <ArrowRight size={18} />
              </button>
              <div className="h-4 w-px bg-white/20 mx-1"></div>
              <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-sm font-medium transition-colors">
                <Trash2 size={16} /> Delete
              </button>
              <button onClick={() => { setSelectedIds([]); setIsMultiSelect(false); }} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 ml-2">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHERS TABLE */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        {loadError ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-200 dark:border-red-800/50">
              <AlertCircle size={26} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Couldn’t load vouchers</h3>
            <p className="text-gray-500 max-w-sm mb-6">{loadError}</p>
            <button onClick={loadVouchers} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-gray-100 dark:border-gray-700"></div>
              <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-500 font-medium">Loading vouchers...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No vouchers found</h3>
            <p className="text-gray-500 max-w-sm mb-8">Try adjusting your filters or create a new one.</p>
            <button onClick={() => setShowCreateModal(true)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl inline-flex items-center gap-2 font-medium transition-all">
              <Plus size={18} /> Create First Voucher
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto relative min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50/80 dark:bg-stone-800/80 backdrop-blur-sm sticky top-0 z-20">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 w-12">
                    <div className="flex items-center">
                      {(isMultiSelect || filteredVouchers.length > 0) && (
                        <input
                          type="checkbox"
                          checked={filteredVouchers.length > 0 && selectedIds.length === filteredVouchers.length}
                          onChange={(e) => { if (!isMultiSelect) setIsMultiSelect(true); handleSelectAll(e.target.checked); }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Voucher Info</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payee / Bank</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Refs</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredVouchers.map((voucher, index) => {
                  const lineItemCount = getLineItemCount(voucher);
                  const withCopyCount = getWithCopyCount(voucher);
                  const statusStyle = getStatusColor(voucher.status || "pending");
                  const isSelected = selectedIds.includes(voucher.id);
                  const isCancelled = voucher.status === "cancelled";
                  const isDebit = voucher.transaction_type === "debit";
                  const selectableStatuses = getCheckSelectableStatuses(voucher.status, voucher.transaction_type);

                  return (
                    <tr
                      key={voucher.id}
                      onClick={(e) => { if (isMultiSelect) handleSelectRow(voucher.id, index, e); }}
                      className={`group transition-colors ${isSelected ? "bg-blue-50/80 dark:bg-blue-900/30" : "hover:bg-stone-50 dark:hover:bg-stone-700/30"}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center h-full">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => { if (!isMultiSelect) setIsMultiSelect(true); handleSelectRow(voucher.id, index, e); }}
                            className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-opacity ${isMultiSelect ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{formatDate(voucher.voucher_date)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                            {voucher.voucher_number || "N/A"}
                          </span>
                          {voucher.remarks && (
                            <span className="text-xs text-gray-400 truncate max-w-[150px]" title={voucher.remarks}>
                              {voucher.remarks}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate" title={voucher.company_payee_payor}>
                            {voucher.company_payee_payor || "—"}
                          </span>
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-500 flex items-center gap-1">
                            <CreditCard size={10} />
                            {voucher.bank_check_no || "No Check #"}
                          </span>
                        </div>
                      </td>

                      {/* ── Refs: line item count + with_copy badge ── */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {lineItemCount > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                              <Tag size={12} />
                              {lineItemCount} {lineItemCount === 1 ? "item" : "items"}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {withCopyCount > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                              <Copy size={11} />
                              {withCopyCount} w/ copy
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">{getTransactionBadge(voucher.transaction_type)}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-sm font-mono font-medium ${
                          isCancelled ? "text-gray-400 line-through"
                          : isDebit ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isDebit
                            ? (voucher.dr_amount ? formatCurrency(voucher.dr_amount) : "—")
                            : (voucher.cr_amount ? formatCurrency(voucher.cr_amount) : "—")}
                        </span>
                      </td>

                      {/* ── Status select: filtered by transaction type ── */}
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group/status inline-block">
                          <select
                            value={voucher.status || "pending"}
                            onChange={(e) => handleStatusChange(voucher.id, e.target.value)}
                            className={`appearance-none pl-2.5 pr-6 py-1 rounded-md text-xs font-bold border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-all ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            {selectableStatuses.map((statusValue) => (
                              <option key={statusValue} value={statusValue}>
                                {CHECK_STATUS_LABELS[statusValue] || statusValue}
                              </option>
                            ))}
                          </select>
                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${statusStyle.text}`}>
                            <TrendingDown size={10} />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleViewVoucher(voucher)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="View Details">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => handleEditClick(voucher)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteVoucher(voucher.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CheckVoucherBulkCreator isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setOcrDraftVoucher(null); setOcrDraftVouchers([]); }} onSubmit={handleCreateVoucher} chartOfAccounts={chartOfAccounts} isDarkMode={isDarkMode} createdBy={user?.id} initialDraft={ocrDraftVoucher} initialDrafts={ocrDraftVouchers} />
      )}
      {showEditModal && selectedVoucher && (
        <CheckVoucherBulkCreator isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedVoucher(null); }} onSubmit={handleEditVoucher} chartOfAccounts={chartOfAccounts} isDarkMode={isDarkMode} createdBy={user?.id} editMode={true} initialData={selectedVoucher} />
      )}
      {showViewModal && selectedVoucher && (
        <CheckVoucherViewModal voucher={selectedVoucher} onClose={() => { setShowViewModal(false); setSelectedVoucher(null); }} isDarkMode={isDarkMode} />
      )}
      <CheckVoucherImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImportVouchers} isDarkMode={isDarkMode} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={() => confirmDialog.onConfirm?.()}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} isDarkMode={isDarkMode} />
    </div>
  );
}

// ─── View Modal ────────────────────────────────────────────────────────────────
function CheckVoucherViewModal({ voucher, onClose, isDarkMode }) {
  const lineItems = voucher.line_items || voucher.lineItems || voucher.items || voucher.check_voucher_items || [];

  const formatCurrency = (amount) =>
    `₱${parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  };

  const renderReferenceList = (label, value) => {
    let refs = [];
    if (Array.isArray(value)) { refs = value; }
    else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[")) {
        try { const p = JSON.parse(trimmed); if (Array.isArray(p)) refs = p; } catch { refs = trimmed.split(/[\n,\/]+/); }
      } else { refs = trimmed.split(/[\n,\/]+/); }
    }
    refs = refs.map((r) => String(r).trim()).filter(Boolean);
    if (refs.length === 0) return null;
    return (
      <div className="col-span-1 md:col-span-2">
        <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{label}</label>
        <div className="flex flex-wrap gap-2">
          {refs.map((ref, idx) => (
            <span key={idx} className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 text-xs font-mono font-medium">{ref}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      <div className={`rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? "bg-stone-800 border border-gray-700" : "bg-white"}`}>
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? "border-gray-700 bg-stone-800" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-white border border-gray-100 text-blue-600"}`}>
              <CreditCard size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Check Voucher Details</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`font-mono text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>#{voucher.voucher_number || voucher.id}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600"></span>
                <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{formatDate(voucher.voucher_date)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? "text-gray-400 hover:bg-stone-700" : "text-gray-400 hover:bg-stone-100"}`}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
          <div className="p-6 md:p-8 space-y-8">
            <section>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                Primary Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                <DetailField label="Company / Payee" value={voucher.company_payee_payor} isDarkMode={isDarkMode} prominent />
                <DetailField label="Bank / Check No." value={voucher.bank_check_no} isDarkMode={isDarkMode} />
                <DetailField label="Bank Deposited" value={voucher.bank_deposited} isDarkMode={isDarkMode} />
                <DetailField label="DR Number" value={voucher.dr_number} isDarkMode={isDarkMode} />
                <DetailField label="Transaction" value={voucher.transaction_type?.toUpperCase()} isDarkMode={isDarkMode} />
                <DetailField label="Status" value={voucher.status?.toUpperCase()} isDarkMode={isDarkMode} badge />
                <DetailField label="Debit Amount" value={formatCurrency(voucher.dr_amount)} isDarkMode={isDarkMode} mono />
                <DetailField label="Credit Amount" value={formatCurrency(voucher.cr_amount)} isDarkMode={isDarkMode} mono />
              </div>
            </section>

            <hr className={isDarkMode ? "border-gray-700" : "border-gray-100"} />

            <section>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                References & Notes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderReferenceList("PO Numbers", voucher.po_numbers_array)}
                {renderReferenceList("SI Numbers", voucher.si_numbers_array)}
                {renderReferenceList("CGR Numbers", voucher.cgr_numbers_array)}
                {renderReferenceList("QI/QF/QS Numbers", voucher.qi_numbers_array)}
                <div className="col-span-1 md:col-span-2 bg-stone-50 dark:bg-stone-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700/50">
                  <DetailField label="Remarks" value={voucher.remarks || "No remarks provided."} isDarkMode={isDarkMode} />
                </div>
              </div>
            </section>

            {voucher.discount_type && voucher.discount_type !== "none" && (
              <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 flex items-start gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg"><Tag size={20} /></div>
                <div>
                  <h3 className={`text-sm font-bold mb-1 ${isDarkMode ? "text-amber-400" : "text-amber-800"}`}>Discount Applied</h3>
                  <p className={`text-sm ${isDarkMode ? "text-amber-200/80" : "text-amber-700/80"}`}>
                    A {voucher.discount_type} discount of{" "}
                    <span className="font-bold font-mono">
                      {voucher.discount_type === "percentage" ? `${voucher.discount_value}%` : formatCurrency(voucher.discount_value)}
                    </span>{" "}
                    was applied to this voucher.
                  </p>
                </div>
              </div>
            )}

            {/* Line Items — Status/OK column removed, Copy column added */}
            {lineItems && lineItems.length > 0 ? (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                    Line Items
                  </h3>
                  <span className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{lineItems.length} items</span>
                </div>
                <div className={`rounded-xl border shadow-sm overflow-hidden ${isDarkMode ? "border-gray-700 bg-stone-800" : "border-gray-200 bg-white"}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={isDarkMode ? "bg-stone-900/50" : "bg-stone-50"}>
                        <tr>
                          {["P.O No.", "S.I No.", "DR No.", "QI/QF No.", "Remark", "Copy", "Amount"].map((h) => (
                            <th key={h} className={`px-4 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? "text-gray-400" : "text-gray-500"} ${h === "Amount" ? "text-right" : ""}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDarkMode ? "divide-y divide-gray-700" : "divide-y divide-gray-200"}>
                        {lineItems.map((item, index) => {
                          const amount = parseFloat(item.amount || 0);
                          const hasCopy = item.with_copy === true || item.with_copy === 1 || item.with_copy === "1";
                          return (
                            <tr key={index} className={isDarkMode ? "hover:bg-stone-700/30" : "hover:bg-stone-50"}>
                              <td className={`px-4 py-3 text-xs font-mono ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{item.po_number || "-"}</td>
                              <td className={`px-4 py-3 text-xs font-mono ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{item.si_number || "-"}</td>
                              <td className={`px-4 py-3 text-xs font-mono ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{item.dr_number || "-"}</td>
                              <td className={`px-4 py-3 text-xs font-mono ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{item.qi_number || "-"}</td>
                              <td className={`px-4 py-3 text-sm italic ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>{item.remark || "-"}</td>
                              <td className="px-4 py-3">
                                {hasCopy ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    <Copy size={9} /> Copy
                                  </span>
                                ) : (
                                  <span className={`text-xs ${isDarkMode ? "text-gray-600" : "text-gray-300"}`}>—</span>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-mono font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                                {formatCurrency(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className={isDarkMode ? "bg-stone-900/50 border-t border-gray-700" : "bg-stone-50 border-t border-gray-200"}>
                        <tr>
                          <td colSpan="6" className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-right ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                            Total Amount:
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-bold font-mono ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                            {formatCurrency(lineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                    Line Items
                  </h3>
                </div>
                <div className={`p-8 text-center rounded-xl border-2 border-dashed ${isDarkMode ? "border-gray-700 bg-stone-800/50" : "border-gray-200 bg-stone-50"}`}>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>No line items found for this voucher</p>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t px-6 py-4 flex justify-end gap-3 ${isDarkMode ? "border-gray-700 bg-stone-800" : "border-gray-200 bg-white"}`}>
          {voucher.with_copy && (
            <div className="mr-auto flex items-center gap-2 text-xs font-medium text-gray-500">
              <CheckSquare size={14} className="text-blue-500" />
              <span>Physical Copy Available</span>
            </div>
          )}
          <button onClick={onClose} className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${isDarkMode ? "bg-stone-700 text-white hover:bg-stone-600" : "bg-stone-100 text-gray-700 hover:bg-stone-200"}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, isDarkMode, prominent = false, badge = false, mono = false }) {
  let content = (
    <p className={`text-sm ${mono ? "font-mono" : ""} ${prominent ? "font-bold text-base" : "font-medium"} ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
      {value || "—"}
    </p>
  );

  if (badge && value) {
    const color =
      value.toLowerCase() === "released" ? "blue"
      : value.toLowerCase() === "received" ? "emerald"
      : value.toLowerCase() === "cancelled" ? "gray"
      : "amber";
    const colors = {
      blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      gray:    "bg-stone-100 text-gray-700 dark:bg-stone-700 dark:text-gray-300",
      amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    };
    content = (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${colors[color] || colors.amber}`}>
        {value}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{label}</label>
      {content}
    </div>
  );
}