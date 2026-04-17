import React, { useState, useEffect } from 'react';
import { 
  Coins, Plus, TrendingDown, TrendingUp, DollarSign, Search, 
  Eye, Edit2, Trash2, X, PieChart, Calendar, Download, 
  ChevronLeft, ChevronRight, Upload, Wallet, Receipt, 
  CheckSquare, Square, ArrowRight, Filter, AlertCircle, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import apiService from "../../../../utils/api/api-service";
import PettyCashBulkCreator from "../../components/forms/PettyCashBulkCreator";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/main_ui/Toast";
import ConfirmDialog from "../../components/main_ui/ConfirmDialog";
import { generatePettyCashReport } from "../../../../utils/reports/PettyCashReport";
import PettyCashImportModal from "../../components/modals/PettyCashImportModal";
import {
  buildVoucherApprovePayload,
  buildVoucherCancelPayload,
  buildVoucherStatusUpdatePayload,
} from "../../helpers/voucherAuditPayload";
import { normalizePettyCashImportResponse } from "../../helpers/importResponseUtils";

function parseProofDocuments(value) {
  if (value == null || value === '') return [];

  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return { label: `Document ${index + 1}`, reference: text };
      }

      if (!entry || typeof entry !== 'object') return null;

      const label = String(entry.label || entry.name || `Document ${index + 1}`).trim();
      const reference = String(entry.reference || entry.url || entry.path || '').trim();
      if (!label && !reference) return null;

      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Petty Cash Tab - Complete petty cash management
 * UX/UI Upgraded Version - Fixed Layout Clipping
 */
export default function PettyCashTab({ chartOfAccounts = [], highlightVoucherNumber = null }) {
  const { isDarkMode, user } = useAuth();
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();
  
  // State
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vatFilter, setVatFilter] = useState('all'); // all, vatable, non_vatable
  const [activeSubTab, setActiveSubTab] = useState('vouchers'); // vouchers | accounts | monthly | totals
  
  // Month/Year filter state - default to 'all' to show all data
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 1-12
  const [selectedYear, setSelectedYear] = useState('all'); // 'all' or year number
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Sorting state
  const [sortField, setSortField] = useState('voucher_number');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Budget state
  const [budget, setBudget] = useState({
    beginning_balance: 0,
    replenished_amount: 0,
    total_budget: 0,
    current_balance: 0,
    total_expenses: 0
  });

  // Summary state
  const [summary, setSummary] = useState({
    totalVat: 0,
    totalNonVat: 0,
    totalAmount: 0,
    vatCount: 0,
    nonVatCount: 0
  });

  // Expenses breakdown by account
  const [expensesByAccount, setExpensesByAccount] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [yearlySummary, setYearlySummary] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSetBalanceModal, setShowSetBalanceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSkippedDetails, setImportSkippedDetails] = useState([]);
  const [showImportSkippedDetails, setShowImportSkippedDetails] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [ocrDraftVoucher, setOcrDraftVoucher] = useState(null);
  const [ocrDraftVouchers, setOcrDraftVouchers] = useState([]);

  // Multi-select
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [bulkStatus, setBulkStatus] = useState('');
  const [newBeginningBalance, setNewBeginningBalance] = useState('');
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

  const PETTY_STATUS_ORDER = ['draft', 'pending', 'approved', 'paid', 'rejected', 'cancelled'];
  const PETTY_STATUS_LABELS = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    paid: 'Paid',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  const PETTY_ALLOWED_TRANSITIONS = {
    draft: ['pending', 'cancelled'],
    pending: ['approved', 'cancelled'],
    approved: ['paid', 'cancelled'],
    paid: [],
    rejected: ['pending', 'cancelled'],
    cancelled: ['draft', 'pending'],
  };

  const getPettyAllowedTransitions = (status) => {
    const normalizedStatus = String(status || 'draft').toLowerCase();
    return PETTY_ALLOWED_TRANSITIONS[normalizedStatus] || [];
  };

  const getPettySelectableStatuses = (status) => {
    const normalizedStatus = String(status || 'draft').toLowerCase();
    const options = [normalizedStatus, ...getPettyAllowedTransitions(normalizedStatus)];
    return PETTY_STATUS_ORDER.filter((candidate) => options.includes(candidate));
  };

  const getSelectedPettyVouchers = () => vouchers.filter((voucher) => selectedIds.includes(voucher.id));

  const getBulkPettyStatusOptions = () => {
    const selectedVouchers = getSelectedPettyVouchers();
    if (selectedVouchers.length === 0) return [];

    const intersections = selectedVouchers
      .map((voucher) => new Set(getPettyAllowedTransitions(voucher.status)))
      .reduce((acc, statusSet) => {
        if (!acc) return statusSet;
        return new Set([...acc].filter((value) => statusSet.has(value)));
      }, null);

    if (!intersections) return [];
    return PETTY_STATUS_ORDER
      .filter((status) => intersections.has(status))
      .map((status) => ({ value: status, label: PETTY_STATUS_LABELS[status] || status }));
  };

  const bulkPettyStatusOptions = getBulkPettyStatusOptions();

  const getSkipRowLabel = (detail, index) => (
    detail?.row_number || detail?.row || detail?.line || detail?.index || index + 1
  );

  const getSkipReason = (detail) => (
    detail?.reason || detail?.error || detail?.message || 'Validation failed'
  );

  const getSkipContext = (detail) => (
    detail?.voucher_number || detail?.reference || detail?.particulars || detail?.raw_value || ''
  );

  // Load data
  useEffect(() => {
    loadVouchers();
    loadBudget();
  }, [statusFilter, searchTerm, vatFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'petty_cash_voucher') return;

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

  // Subscribe to real-time updates
  useEffect(() => {
    const socket = apiService.socket;
    
    const unsubscribeVoucherCreated = socket.subscribeToUpdates('pettyCashVoucherCreated', () => {
      loadVouchers();
      loadBudget();
    });
    
    const unsubscribeVoucherUpdated = socket.subscribeToUpdates('pettyCashVoucherUpdated', () => {
      loadVouchers();
      loadBudget();
    });
    
    const unsubscribeVoucherApproved = socket.subscribeToUpdates('pettyCashVoucherApproved', () => {
      loadVouchers();
      loadBudget();
    });
    
    const unsubscribeVoucherCancelled = socket.subscribeToUpdates('pettyCashVoucherCancelled', () => {
      loadVouchers();
      loadBudget();
    });
    
    const unsubscribeBudgetUpdated = socket.subscribeToUpdates('pettyCashBudgetUpdated', () => {
      loadBudget();
    });

    return () => {
      unsubscribeVoucherCreated();
      unsubscribeVoucherUpdated();
      unsubscribeVoucherApproved();
      unsubscribeVoucherCancelled();
      unsubscribeBudgetUpdated();
    };
  }, []);

  // If a voucher number is highlighted externally, set search and switch to vouchers tab
  useEffect(() => {
    if (highlightVoucherNumber) {
      setSearchTerm(highlightVoucherNumber);
      setActiveSubTab('vouchers');
      setCurrentPage(1);
    }
  }, [highlightVoucherNumber]);

  const loadVouchers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      if (vatFilter !== 'all') params.vatable_type = vatFilter;
      
      // Add month/year filters only if not 'all'
      if (selectedMonth !== 'all') params.month = selectedMonth;
      if (selectedYear !== 'all') params.year = selectedYear;

      const response = await apiService.finance.getPettyCashVouchers(params);
      const voucherCandidates =
        response?.data?.vouchers ??
        response?.vouchers ??
        response?.data ??
        response;
      const voucherList = Array.isArray(voucherCandidates) ? voucherCandidates : [];

      const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
      const filteredVouchers = voucherList.filter((voucher) => {
        if (selectedMonth === 'all' && selectedYear === 'all') return true;

        const date = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
        if (!isValidDate(date)) return false;

        const matchesMonth = selectedMonth === 'all'
          ? true
          : date.getMonth() + 1 === selectedMonth;
        const matchesYear = selectedYear === 'all'
          ? true
          : date.getFullYear() === selectedYear;

        return matchesMonth && matchesYear;
      });

      setVouchers(filteredVouchers);
      calculateSummary(filteredVouchers);
      calculateExpensesByAccount(filteredVouchers);
      calculateMonthlySummary(filteredVouchers);
      calculateYearlySummary(filteredVouchers);
    } catch (error) {
      console.error('Failed to load petty cash vouchers:', error);
      setVouchers([]);
      setLoadError(error?.message || 'Failed to load petty cash vouchers.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBudget = async () => {
    try {
      // Pass month/year filter to budget endpoint
      const params = new URLSearchParams();
      if (selectedMonth !== 'all') params.append('month', selectedMonth);
      if (selectedYear !== 'all') params.append('year', selectedYear);
      
      const queryString = params.toString();
      const url = `/api/finance-payroll/petty-cash-budget${queryString ? '?' + queryString : ''}`;
      
      const response = await apiService.finance.request(url);
      const budgetData = response.data || response.budget || response || {};
      
      setBudget({
        beginning_balance: parseFloat(budgetData.beginning_balance || 0),
        replenished_amount: parseFloat(budgetData.replenished_amount || 0),
        total_budget: parseFloat(budgetData.total_budget || 0),
        current_balance: parseFloat(budgetData.current_balance || 0),
        total_expenses: parseFloat(budgetData.total_expenses || 0) // From backend
      });
    } catch (error) {
      console.error('Failed to load budget:', error);
      showError('Failed to load petty cash budget');
    }
  };

  const calculateSummary = (voucherList) => {
    // Exclude cancelled vouchers from summaries
    const activeVouchers = voucherList.filter(v => v.status !== 'cancelled');

    const vatVouchers = activeVouchers.filter(v => parseFloat(v.amount_vat || 0) > 0);
    const nonVatVouchers = activeVouchers.filter(v => parseFloat(v.amount_non_vat || 0) > 0);

    const totalVat = activeVouchers.reduce((sum, v) => sum + parseFloat(v.amount_vat || 0), 0);
    const totalNonVat = activeVouchers.reduce((sum, v) => sum + parseFloat(v.amount_non_vat || 0), 0);

    setSummary({
      totalVat,
      totalNonVat,
      totalAmount: totalVat + totalNonVat,
      vatCount: vatVouchers.length,
      nonVatCount: nonVatVouchers.length
    });
  };

  const calculateExpensesByAccount = (voucherList) => {
    const accountMap = {};

    voucherList.forEach(voucher => {
      // Skip cancelled
      if(voucher.status === 'cancelled') return;

      const accountClassification = voucher.account_classification || voucher.particulars || 'Uncategorized';
      if (!accountMap[accountClassification]) {
        accountMap[accountClassification] = {
          account: accountClassification,
          totalVat: 0,
          totalNonVat: 0,
          total: 0,
          count: 0
        };
      }

      const vat = parseFloat(voucher.amount_vat || 0);
      const nonVat = parseFloat(voucher.amount_non_vat || 0);

      accountMap[accountClassification].totalVat += vat;
      accountMap[accountClassification].totalNonVat += nonVat;
      accountMap[accountClassification].total += vat + nonVat;
      accountMap[accountClassification].count += 1;
    });

    const expenses = Object.values(accountMap).sort((a, b) => b.total - a.total);
    setExpensesByAccount(expenses);
  };

  const calculateMonthlySummary = (voucherList) => {
    const monthMap = {};
    const active = voucherList.filter(v => v.status !== 'cancelled');
    active.forEach((voucher) => {
      const date = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
      if (!date) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
      const account = voucher.account_classification || voucher.particulars || 'Uncategorized';
      const vat = parseFloat(voucher.amount_vat || 0);
      const nonVat = parseFloat(voucher.amount_non_vat || 0);

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { monthKey, monthLabel, totalVat: 0, totalNonVat: 0, total: 0, accounts: {} };
      }

      const monthBucket = monthMap[monthKey];
      if (!monthBucket.accounts[account]) {
        monthBucket.accounts[account] = { account, totalVat: 0, totalNonVat: 0, total: 0, count: 0 };
      }

      monthBucket.accounts[account].totalVat += vat;
      monthBucket.accounts[account].totalNonVat += nonVat;
      monthBucket.accounts[account].total += vat + nonVat;
      monthBucket.accounts[account].count += 1;

      monthBucket.totalVat += vat;
      monthBucket.totalNonVat += nonVat;
      monthBucket.total += vat + nonVat;
    });

    const monthly = Object.values(monthMap)
      .map((m) => ({
        ...m,
        accounts: Object.values(m.accounts).sort((a, b) => b.total - a.total)
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    setMonthlySummary(monthly);
  };

  const calculateYearlySummary = (voucherList) => {
    const yearMap = {};
    const active = voucherList.filter(v => v.status !== 'cancelled');

    active.forEach((voucher) => {
      const date = voucher.voucher_date ? new Date(voucher.voucher_date) : null;
      if (!date) return;

      const year = date.getFullYear();
      const account = voucher.account_classification || voucher.particulars || 'Uncategorized';
      const vat = parseFloat(voucher.amount_vat || 0);
      const nonVat = parseFloat(voucher.amount_non_vat || 0);

      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          totalVat: 0,
          totalNonVat: 0,
          total: 0,
          accounts: {}
        };
      }

      const yearBucket = yearMap[year];
      if (!yearBucket.accounts[account]) {
        yearBucket.accounts[account] = {
          account,
          totalVat: 0,
          totalNonVat: 0,
          total: 0,
          count: 0
        };
      }

      yearBucket.accounts[account].totalVat += vat;
      yearBucket.accounts[account].totalNonVat += nonVat;
      yearBucket.accounts[account].total += vat + nonVat;
      yearBucket.accounts[account].count += 1;

      yearBucket.totalVat += vat;
      yearBucket.totalNonVat += nonVat;
      yearBucket.total += vat + nonVat;
    });

    const yearly = Object.values(yearMap)
      .map((y) => ({
        ...y,
        accounts: Object.values(y.accounts).sort((a, b) => b.total - a.total)
      }))
      .sort((a, b) => b.year - a.year);

    setYearlySummary(yearly);
  };

  const handleSetBeginningBalance = async (e) => {
    e.preventDefault();
    const amount = parseFloat(newBeginningBalance);
    if (isNaN(amount) || amount < 0) {
      showError('Please enter a valid amount');
      return;
    }
    try {
      await apiService.finance.request('/api/finance-payroll/petty-cash-budget', {
        method: 'POST',
        body: JSON.stringify({
          action: 'set_beginning',
          amount: amount
        })
      });
      loadBudget();
      showSuccess(`Beginning balance set to ${formatCurrency(amount)}`);
      setShowSetBalanceModal(false);
      setNewBeginningBalance('');
    } catch (error) {
      console.error('Failed to set beginning balance:', error);
      showError('Failed to set beginning balance: ' + (error.message || 'Unknown error'));
    }
  };

  const handleImportVouchers = async (vouchers) => {
    try {
      const response = await apiService.finance.request('/api/finance-payroll/petty-cash-vouchers/import', {
        method: 'POST',
        body: JSON.stringify({ vouchers })
      });

      const {
        importedCount,
        updatedCount,
        skippedCount,
        skippedDetails,
      } = normalizePettyCashImportResponse(response);

      await Promise.all([loadVouchers(), loadBudget()]);

      if (importedCount > 0 || updatedCount > 0 || skippedCount > 0) {
        showSuccess(`Import completed! ${importedCount} new, ${updatedCount} updated, ${skippedCount} skipped.`);
      } else {
        showSuccess('Import completed!');
      }

      if (skippedCount > 0 && skippedDetails.length > 0) {
        setImportSkippedDetails(skippedDetails);
        setShowImportSkippedDetails(true);
        showWarning(`${skippedDetails.length} row(s) skipped. Review details below.`);
      } else {
        setImportSkippedDetails([]);
        setShowImportSkippedDetails(false);
      }
    } catch (error) {
      console.error('Failed to import vouchers:', error);
      showError('Failed to import vouchers: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const handleCreateVoucher = async (voucherData) => {
    try {
      await apiService.finance.createPettyCashVoucher(voucherData);
      await loadVouchers();
      await loadBudget();
      showSuccess('Petty cash voucher created successfully');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create voucher:', error);
      showError('Failed to create voucher: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const handleEditVoucher = async (voucherData) => {
    try {
      await apiService.finance.updatePettyCashVoucher(selectedVoucher.id, voucherData);
      await loadVouchers();
      await loadBudget();
      showSuccess('Voucher updated successfully');
      setShowEditModal(false);
      setSelectedVoucher(null);
    } catch (error) {
      console.error('Failed to update voucher:', error);
      showError('Failed to update voucher: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const executeDeleteVoucher = async (voucherId) => {
    try {
      await apiService.finance.deletePettyCashVoucher(voucherId);
      await loadVouchers();
      await loadBudget();
      showSuccess('Voucher deleted successfully');
    } catch (error) {
      console.error('Failed to delete voucher:', error);
      showError('Failed to delete voucher: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    openConfirmDialog({
      title: 'Delete Petty Cash Voucher',
      message: 'Are you sure you want to delete this petty cash voucher?',
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => executeDeleteVoucher(voucherId),
    });
  };

  const handleViewVoucher = async (voucher) => {
    try {
      const response = await apiService.finance.getPettyCashVoucher(voucher.id);
      const voucherWithLineItems = response.voucher || response.data || response;
      setSelectedVoucher(voucherWithLineItems);
      setShowViewModal(true);
    } catch (error) {
      console.error('Failed to fetch voucher details:', error);
      showError('Failed to load voucher details');
    }
  };

  const handleEditClick = async (voucher) => {
    try {
      const response = await apiService.finance.getPettyCashVoucher(voucher.id);
      const voucherWithLineItems = response.voucher || response.data || response;
      setSelectedVoucher(voucherWithLineItems);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to fetch voucher details:', error);
      showError('Failed to load voucher details');
    }
  };

  const handleStatusChange = async (voucherId, newStatus) => {
    try {
      const voucher = vouchers.find((item) => item.id === voucherId);
      const currentStatus = String(voucher?.status || 'draft').toLowerCase();
      if (newStatus === currentStatus) return;

      const allowedTransitions = getPettyAllowedTransitions(currentStatus);
      if (!allowedTransitions.includes(newStatus)) {
        showWarning('Invalid status transition for this voucher.');
        return;
      }

      if (newStatus === 'approved') {
        await apiService.finance.approvePettyCashVoucher(voucherId, buildVoucherApprovePayload({ user }));
      } else if (newStatus === 'cancelled') {
        await apiService.finance.cancelPettyCashVoucher(
          voucherId,
          buildVoucherCancelPayload({ user, reason: 'Cancelled by user' }),
        );
      } else {
        await apiService.finance.updatePettyCashVoucher(
          voucherId,
          buildVoucherStatusUpdatePayload({ user, status: newStatus }),
        );
      }

      setVouchers(prev => {
        const updated = prev.map(v => v.id === voucherId ? { ...v, status: newStatus } : v);
        calculateSummary(updated);
        calculateExpensesByAccount(updated);
        calculateMonthlySummary(updated);
        calculateYearlySummary(updated);
        return updated;
      });
      await loadBudget();
      showSuccess(`Voucher status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      showError('Failed to update voucher status');
      await loadVouchers();
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const configs = {
      draft: { bg: 'bg-stone-100 dark:bg-stone-700', text: 'text-gray-700 dark:text-gray-300' },
      pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
      approved: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
      paid: { bg: 'bg-neutral-100 dark:bg-neutral-900/20', text: 'text-neutral-700 dark:text-neutral-400' },
      rejected: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400' },
      cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' }
    };

    const config = configs[status] || configs.draft;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border border-transparent ${config.bg} ${config.text}`}>
            {status}
        </span>
    );
  };
  // Provide select-style status control (inline, auto-saves on change)
  const getStatusStyle = (status) => {
    // Use same bg/text classes as the original badge implementation and keep borders transparent
    const configs = {
      draft: { bg: 'bg-stone-100 dark:bg-stone-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-transparent' },
      pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-transparent' },
      approved: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-transparent' },
      paid: { bg: 'bg-neutral-100 dark:bg-neutral-900/20', text: 'text-neutral-700 dark:text-neutral-400', border: 'border-transparent' },
      rejected: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-transparent' },
      cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-transparent' }
    };
    return configs[status] || configs.draft;
  };

  const handleExportExcel = async () => {
    if (vouchers.length === 0) {
      showWarning('No vouchers available to export.');
      return;
    }

    try {
      let dateRange = {};
      if (selectedYear === 'all' && selectedMonth === 'all') {
        dateRange = { allTime: true };
      } else if (selectedYear !== 'all' && selectedMonth === 'all') {
        dateRange = { year: selectedYear, month: 'all', start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31) };
      } else if (selectedYear === 'all' && selectedMonth !== 'all') {
        dateRange = { year: 'all', month: selectedMonth };
      } else {
        const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth, 0);
        dateRange = { start: startOfMonth, end: endOfMonth, year: selectedYear, month: selectedMonth };
      }

      const summaryMetrics = {
        beginningBalance: budget.beginning_balance || 0,
        replenishment: budget.replenished_amount || 0,
        totalBudget: budget.total_budget || 0,
        totalExpenses: budget.total_expenses || 0,
        remainingBalance: budget.current_balance || 0
      };

      await generatePettyCashReport(vouchers, dateRange, summaryMetrics);
      showSuccess('Excel report generated successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showError('Failed to generate Excel report: ' + (error.message || 'Unknown error'));
    }
  };

  // Sorting helper
  const getSortedVouchers = () => {
    const sorted = [...vouchers].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'voucher_number':
          aVal = a.voucher_number || '';
          bVal = b.voucher_number || '';
          break;
        case 'voucher_date':
          aVal = new Date(a.voucher_date || 0).getTime();
          bVal = new Date(b.voucher_date || 0).getTime();
          break;
        case 'particulars':
          aVal = (a.account_classification || a.particulars || '').toLowerCase();
          bVal = (b.account_classification || b.particulars || '').toLowerCase();
          break;
        case 'payee':
          aVal = (a.company_supplier || '').toLowerCase();
          bVal = (b.company_supplier || '').toLowerCase();
          break;
        case 'amount':
          aVal = parseFloat(a.amount_vat || 0) + parseFloat(a.amount_non_vat || 0);
          bVal = parseFloat(b.amount_vat || 0) + parseFloat(b.amount_non_vat || 0);
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };
  
  // Pagination helpers
  const getPaginatedVouchers = () => {
    const sorted = getSortedVouchers();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(vouchers.length / itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setSelectedIds([]);
      setLastSelectedIndex(null);
    }
  };
  
  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };
  
  // Sort indicator component
  const SortIndicator = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="text-neutral-500" />
      : <ArrowDown size={14} className="text-neutral-500" />;
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
    setLastSelectedIndex(null);
  }, [statusFilter, searchTerm, vatFilter, selectedMonth, selectedYear]);

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
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(getPaginatedVouchers().map((voucher) => voucher.id));
  };

  const handleSelectRow = (voucherId, index, event) => {
    const currentList = getPaginatedVouchers();
    
    // Determine if we should select based on current state or explicit checkbox
    const isCurrentlySelected = selectedIds.includes(voucherId);
    
    const shouldSelect = event?.target?.type === 'checkbox' 
      ? event.target.checked 
      : !isCurrentlySelected;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (event?.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i += 1) {
          const rangeId = currentList[i]?.id;
          if (!rangeId) continue;
          if (shouldSelect) {
            next.add(rangeId);
          } else {
            next.delete(rangeId);
          }
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

    const allowedBulkStatuses = new Set(bulkPettyStatusOptions.map((option) => option.value));
    if (!allowedBulkStatuses.has(bulkStatus)) {
      showWarning('Selected vouchers do not share a valid transition for this status.');
      return;
    }

    try {
      const results = await Promise.allSettled(
        selectedIds.map((voucherId) =>
          apiService.finance.updatePettyCashVoucher(
            voucherId,
            buildVoucherStatusUpdatePayload({
              user,
              status: bulkStatus,
              cancelReason: 'Cancelled by user',
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
      setIsMultiSelect(false);

      if (failedCount > 0 && successCount > 0) {
        showWarning(`Bulk update completed: ${successCount} updated, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk update failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess('Bulk status update successful');
      }
    } catch (error) {
      console.error('Failed to bulk update voucher status:', error);
      showError('Failed to bulk update voucher status');
    }
  };

  const executeBulkDelete = async () => {
    try {
      const result = await apiService.finance.bulkDeleteVouchers('petty-cash', selectedIds);
      const attemptedCount = result?.attempted_count ?? selectedIds.length;
      const deletedCount = result?.deleted_count ?? attemptedCount;
      const failedCount = result?.failed_count ?? Math.max(0, attemptedCount - deletedCount);

      await loadVouchers();
      setSelectedIds([]);
      setLastSelectedIndex(null);
      setIsMultiSelect(false);

      if (failedCount > 0 && deletedCount > 0) {
        showWarning(`Bulk delete completed: ${deletedCount} deleted, ${failedCount} failed`);
      } else if (failedCount > 0) {
        showError(`Bulk delete failed for ${failedCount} voucher(s)`);
      } else {
        showSuccess('Selected vouchers deleted');
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

  const getMonthOptions = () => {
    const months = [
      { value: 'all', label: 'All Months' },
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' }
    ];
    return months;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [{ value: 'all', label: 'All Years' }];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push({ value: i, label: i.toString() });
    }
    return years;
  };

  // Budget progress percentage
  const budgetPercentage = budget.total_budget > 0 
    ? (budget.current_balance / budget.total_budget) * 100 
    : 0;

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. CONTEXT BAR (GLOBAL FILTERS) */}
      <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 relative z-20">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-100 dark:bg-neutral-900/20 text-neutral-700 dark:text-neutral-400 rounded-xl">
                <Calendar size={20} />
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Period Selection</h3>
                <p className="text-xs text-gray-500">Filters all data, budget, and reports</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <select
            value={selectedMonth}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedMonth(val === 'all' ? 'all' : parseInt(val));
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {getMonthOptions().map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedYear(val === 'all' ? 'all' : parseInt(val));
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {getYearOptions().map(year => (
              <option key={year.value} value={year.value}>{year.label}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setSelectedMonth(new Date().getMonth() + 1);
              setSelectedYear(new Date().getFullYear());
            }}
            className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/30 rounded-xl transition-colors font-medium whitespace-nowrap"
          >
            Current Month
          </button>
        </div>
      </div>

      {/* 2. BUDGET DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          {/* Main Budget Hero Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                        <Wallet size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Budget Overview</h2>
                        <p className="text-neutral-200 text-xs">Remaining Balance</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowSetBalanceModal(true)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                        <Edit2 size={12} /> Set Budget
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-end md:items-center gap-4 mb-4 relative z-10">
                <span className="text-4xl md:text-5xl font-mono font-bold tracking-tight">
                    {formatCurrency(budget.current_balance)}
                </span>
                <span className="text-neutral-200 text-sm mb-2 font-medium">
                    of {formatCurrency(budget.total_budget)} total budget
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-neutral-900/50 rounded-full overflow-hidden mb-2">
                <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
                        budgetPercentage < 20 ? 'bg-red-500' : 
                        budgetPercentage < 50 ? 'bg-yellow-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, budgetPercentage))}%` }}
                ></div>
            </div>
            <div className="flex justify-between text-xs text-neutral-200">
                <span>0%</span>
                <span>{budgetPercentage.toFixed(1)}% Remaining</span>
                <span>100%</span>
            </div>

            {/* Metrics Footer */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                <div>
                    <p className="text-neutral-300 text-xs uppercase tracking-wider mb-1">Beginning</p>
                    <p className="font-mono font-semibold">{formatCurrency(budget.beginning_balance)}</p>
                </div>
                <div>
                    <p className="text-neutral-300 text-xs uppercase tracking-wider mb-1">Replenished</p>
                    <p className="font-mono font-semibold text-emerald-300">+{formatCurrency(budget.replenished_amount)}</p>
                </div>
                <div>
                    <p className="text-neutral-300 text-xs uppercase tracking-wider mb-1">Total Expenses</p>
                    <p className="font-mono font-semibold text-red-300">-{formatCurrency(budget.total_expenses)}</p>
                </div>
            </div>
          </div>

          {/* Side Summary Cards - Fixed Flex Layout */}
          <div className="flex flex-col gap-4 h-full">
             {/* VAT Summary */}
             <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-center flex-1 min-h-[140px]">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-neutral-200 dark:bg-neutral-900/30 text-neutral-700 dark:text-neutral-400 rounded-lg">
                        <Receipt size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total VAT</span>
                </div>
                <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(summary.totalVat)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.vatCount} transactions</p>
             </div>

             {/* Non-VAT Summary */}
             <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-center flex-1 min-h-[140px]">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Receipt size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Non-VAT</span>
                </div>
                <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(summary.totalNonVat)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.nonVatCount} transactions</p>
             </div>
          </div>
      </div>

      {/* 3. TABS & MAIN CONTENT AREA */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative z-0">
        
        {/* Tab Navigation */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
             <div className="flex space-x-1">
                {[
                    { key: 'vouchers', label: 'All Vouchers', icon: <Receipt size={16} /> },
                    { key: 'accounts', label: 'By Account', icon: <PieChart size={16} /> },
                    { key: 'monthly', label: 'Monthly Trend', icon: <Calendar size={16} /> },
                    { key: 'yearly', label: 'Yearly Trend', icon: <BarChart3 size={16} /> },
                    { key: 'totals', label: 'Overview Stats', icon: <Coins size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSubTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeSubTab === tab.key 
                            ? 'bg-stone-100 dark:bg-stone-700 text-gray-900 dark:text-white shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                        }`}
                    >
                        {tab.icon}
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
             </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
            
            {/* TAB: VOUCHERS LIST */}
            {activeSubTab === 'vouchers' && (
                <div className="space-y-4">
                     {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6 relative z-20">
                        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                            <div className="relative group w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-neutral-500 transition-colors" size={18} />
                                <input
                                type="text"
                                placeholder="Search particulars, #, amount..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-neutral-800/20 focus:border-neutral-800 outline-none transition-all text-sm"
                                />
                            </div>
                            
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="paid">Paid</option>
                              <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                            </select>

                             <select
                                value={vatFilter}
                                onChange={(e) => setVatFilter(e.target.value)}
                                className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">All VAT Types</option>
                                <option value="vatable">VAT Only</option>
                                <option value="non_vatable">Non-VAT Only</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
                            <button
                                onClick={toggleMultiSelect}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium border transition-all ${
                                isMultiSelect
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-white dark:bg-stone-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                                }`}
                            >
                                {isMultiSelect ? <CheckSquare size={18} /> : <Square size={18} />}
                                <span className="hidden sm:inline">{isMultiSelect ? 'End Selection' : 'Select'}</span>
                            </button>
                            
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="p-2.5 rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
                                title="Import Excel"
                            >
                                <Upload size={20} />
                            </button>

                            <button
                                onClick={handleExportExcel}
                                disabled={vouchers.length === 0}
                                className="p-2.5 rounded-xl text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors disabled:opacity-50"
                                title="Export Excel"
                            >
                                <Download size={20} />
                            </button>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl flex items-center gap-2 text-sm font-medium shadow-md shadow-neutral-800/20 hover:shadow-lg hover:shadow-neutral-800/30 transition-all"
                            >
                                <Plus size={18} />
                                New Voucher
                            </button>
                        </div>
                    </div>

                    {showImportSkippedDetails && importSkippedDetails.length > 0 && (
                        <div className={`rounded-xl border p-4 mb-4 ${
                          isDarkMode
                            ? 'bg-amber-900/10 border-amber-800/50'
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className={isDarkMode ? 'text-amber-400' : 'text-amber-700'} />
                                    <h4 className={`text-sm font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>
                                      Import skipped rows ({importSkippedDetails.length})
                                    </h4>
                                </div>
                                <button
                                  onClick={() => setShowImportSkippedDetails(false)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isDarkMode ? 'hover:bg-amber-900/30 text-amber-300' : 'hover:bg-amber-100 text-amber-700'
                                  }`}
                                  title="Dismiss"
                                >
                                  <X size={14} />
                                </button>
                            </div>

                            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                                {importSkippedDetails.slice(0, 100).map((detail, index) => {
                                  const row = getSkipRowLabel(detail, index);
                                  const reason = getSkipReason(detail);
                                  const context = getSkipContext(detail);
                                  return (
                                    <div
                                      key={`${row}-${index}`}
                                      className={`rounded-lg p-2.5 border text-xs ${
                                        isDarkMode
                                          ? 'bg-stone-900/60 border-stone-700 text-gray-200'
                                          : 'bg-white border-amber-200 text-gray-700'
                                      }`}
                                    >
                                      <div className="font-semibold">Row {row}: {reason}</div>
                                      {context ? (
                                        <div className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Context: {context}</div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {importSkippedDetails.length > 100 && (
                                  <div className={`text-xs font-medium ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                                    Showing first 100 skipped rows.
                                  </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* BULK ACTION BAR */}
                    {isMultiSelect && selectedIds.length > 0 && (
                        <div className="sticky top-0 z-30 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-stone-900 text-white p-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-4 ring-1 ring-white/10">
                                <div className="flex items-center gap-3 pl-2">
                                <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-md">
                                    {selectedIds.length}
                                </span>
                                <span className="text-sm font-medium">items selected</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                <select
                                  value={bulkStatus}
                                  onChange={(e) => setBulkStatus(e.target.value)}
                                  className={`text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none ${bulkStatus ? (() => { const s = getStatusStyle(bulkStatus); return `${s.bg} ${s.text} ${s.border}`; })() : 'bg-stone-800 border-gray-700 text-white'}`}
                                >
                                  <option value="" disabled>Set Status To...</option>
                                  {bulkPettyStatusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                                
                                <button 
                                    onClick={handleBulkStatusUpdate}
                                    disabled={!bulkStatus || bulkPettyStatusOptions.length === 0}
                                    className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-50 text-neutral-300 disabled:cursor-not-allowed"
                                >
                                    <ArrowRight size={18} />
                                </button>
                                
                                <div className="h-4 w-px bg-white/20 mx-1"></div>
                                
                                <button 
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-stone-800 relative z-0">
                        <div className="overflow-x-auto min-h-[400px]">
                             <table className="w-full">
                                <thead className="bg-stone-50/80 dark:bg-stone-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        {isMultiSelect && (
                                            <th className="px-4 py-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={getPaginatedVouchers().length > 0 && selectedIds.length === getPaginatedVouchers().length}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-neutral-700 focus:ring-neutral-800"
                                                />
                                            </th>
                                        )}
                                        <th 
                                            className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('voucher_number')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>Voucher #</span>
                                                <SortIndicator field="voucher_number" />
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('voucher_date')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>Date</span>
                                                <SortIndicator field="voucher_date" />
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('particulars')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>Particulars</span>
                                                <SortIndicator field="particulars" />
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('payee')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>Payee</span>
                                                <SortIndicator field="payee" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th 
                                            className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('amount')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                <span>Amount</span>
                                                <SortIndicator field="amount" />
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors select-none"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <span>Status</span>
                                                <SortIndicator field="status" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                  {isLoading ? (
                                    <tr>
                                      <td colSpan="100%" className="py-20 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                          <div className="h-10 w-10 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 animate-spin mb-4" />
                                          <p>Loading vouchers...</p>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : loadError ? (
                                    <tr>
                                      <td colSpan="100%" className="py-20 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center max-w-md mx-auto px-4">
                                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full mb-4 border border-red-200 dark:border-red-800/50">
                                            <AlertCircle size={24} className="text-red-500" />
                                          </div>
                                          <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">Couldn’t load vouchers</p>
                                          <p className="text-sm text-gray-500 mb-5">{loadError}</p>
                                          <button
                                            onClick={loadVouchers}
                                            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-colors"
                                          >
                                            Retry
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : vouchers.length === 0 ? (
                                         <tr>
                                            <td colSpan="100%" className="py-20 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-full mb-3 border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <Search size={24} className="text-gray-400" />
                                                    </div>
                                          <p>No vouchers found. Try adjusting your filters.</p>
                                                </div>
                                            </td>
                                         </tr>
                                    ) : (
                                        getPaginatedVouchers().map((voucher, index) => {
                                            const totalAmount = parseFloat(voucher.amount_vat || 0) + parseFloat(voucher.amount_non_vat || 0);
                                            const isSelected = selectedIds.includes(voucher.id);
                                            const hasVat = parseFloat(voucher.amount_vat || 0) > 0;
                                            const hasNonVat = parseFloat(voucher.amount_non_vat || 0) > 0;
                                            
                                            return (
                                                <tr 
                                                    key={voucher.id} 
                                                    className={`group transition-colors ${isSelected ? 'bg-neutral-100/60 dark:bg-neutral-900/20' : 'hover:bg-stone-50 dark:hover:bg-stone-700/30'}`}
                                                    onClick={(e) => { if(isMultiSelect) handleSelectRow(voucher.id, index, e); }}
                                                >
                                                    {isMultiSelect && (
                                                        <td className="px-4 py-4">
                                                             <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {}} 
                                                                className="h-4 w-4 rounded border-gray-300 text-neutral-700 focus:ring-neutral-800"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 text-sm font-mono font-bold text-neutral-700 dark:text-neutral-400">
                                                        {voucher.voucher_number || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                        {formatDate(voucher.voucher_date)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col max-w-[200px]">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate" title={voucher.account_classification}>
                                                                {voucher.account_classification || voucher.particulars || 'N/A'}
                                                            </span>
                                                            <span className="text-xs text-gray-500 truncate">{voucher.receipt_number || 'No Receipt'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                                                        {voucher.company_supplier || '—'}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {hasVat && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-neutral-200 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                                                                    VAT
                                                                </span>
                                                            )}
                                                            {hasNonVat && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                    Non-VAT
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-4 text-right font-mono text-sm font-medium ${voucher.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                        {formatCurrency(totalAmount)}
                                                    </td>
                                                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                           {(() => {
                                                             const status = voucher.status || 'draft';
                                                             const style = getStatusStyle(status);
                                                             const selectableStatuses = getPettySelectableStatuses(status);
                                                             return (
                                                               <div className="relative inline-block">
                                                                 <select
                                                                   value={status}
                                                                   onChange={(e) => handleStatusChange(voucher.id, e.target.value)}
                                                                   className={`appearance-none pl-2.5 pr-6 py-1 rounded-md text-xs font-bold border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-all ${style.bg} ${style.text} ${style.border}`}
                                                                 >
                                                                   {selectableStatuses.map((statusValue) => (
                                                                     <option key={statusValue} value={statusValue}>
                                                                       {PETTY_STATUS_LABELS[statusValue] || statusValue}
                                                                     </option>
                                                                   ))}
                                                                 </select>
                                                                 <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${style.text}`}>
                                                                   <TrendingDown size={10} />
                                                                 </div>
                                                               </div>
                                                             );
                                                           })()}
                                                      </td>
                                                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleViewVoucher(voucher)} className="p-1.5 text-gray-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900/20 rounded-lg">
                                                                <Eye size={16} />
                                                            </button>
                                                            <button onClick={() => handleEditClick(voucher)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteVoucher(voucher.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                             </table>
                        </div>
                         {/* Pagination */}
                        {vouchers.length > itemsPerPage && (
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900/30 flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:hover:bg-stone-800"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:hover:bg-stone-800"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: ACCOUNTS ANALYTICS */}
            {activeSubTab === 'accounts' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expenses by Account</h3>
                            <p className="text-sm text-gray-500">Breakdown of spending per account classification</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full">
                            <thead className="bg-stone-50 dark:bg-stone-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Txn Count</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase w-1/3">Percentage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {expensesByAccount.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-12 text-center text-gray-500">No expense data available.</td>
                                    </tr>
                                ) : (
                                    expensesByAccount.map((expense, idx) => {
                                        const percentage = summary.totalAmount > 0 ? (expense.total / summary.totalAmount * 100) : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{expense.account}</td>
                                                <td className="px-6 py-4 text-gray-500">{expense.count}</td>
                                                <td className="px-6 py-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                                                    {formatCurrency(expense.total)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-blue-500 rounded-full" 
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-500 w-10">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: MONTHLY TREND */}
            {activeSubTab === 'monthly' && (
                monthlySummary.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Summary</h3>
                                <p className="text-sm text-gray-500">Expense breakdown by month and account</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {monthlySummary.map((month) => (
                                <div key={month.monthKey} className="bg-white dark:bg-stone-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <div className="px-6 py-4 bg-stone-50 dark:bg-stone-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{month.monthLabel}</h4>
                                            <p className="text-xs text-gray-500">
                                                VAT: {formatCurrency(month.totalVat)} • Non-VAT: {formatCurrency(month.totalNonVat)}
                                            </p>
                                        </div>
                                        <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(month.total)}
                                        </span>
                                    </div>
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-stone-50/50 dark:bg-stone-900/30">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">VAT</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Non-VAT</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Count</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                {month.accounts.map((acc) => (
                                                    <tr key={acc.account} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                                                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{acc.account}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(acc.totalVat)}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{formatCurrency(acc.totalNonVat)}</td>
                                                        <td className="px-6 py-3 text-right font-mono font-semibold text-gray-900 dark:text-white">{formatCurrency(acc.total)}</td>
                                                        <td className="px-6 py-3 text-right text-gray-500">{acc.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Monthly Data</h3>
                        <p className="text-gray-500">Create vouchers to see monthly expense summaries.</p>
                    </div>
                )
            )}

            {/* TAB: YEARLY TREND */}
            {activeSubTab === 'yearly' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Yearly Summary</h3>
                            <p className="text-sm text-gray-500">Long-term expense tracking by year</p>
                        </div>
                    </div>
                    
                    {yearlySummary.length > 0 ? (
                        <div className="space-y-4">
                            {yearlySummary.map((year) => (
                                <div key={year.year} className="bg-white dark:bg-stone-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <div className="px-6 py-4 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-lg text-gray-900 dark:text-white">{year.year}</h4>
                                            <p className="text-xs text-gray-500">
                                                Total Transactions: {year.accounts.reduce((acc, curr) => acc + curr.count, 0)} • 
                                                VAT: {formatCurrency(year.totalVat)} • Non-VAT: {formatCurrency(year.totalNonVat)}
                                            </p>
                                        </div>
                                        <span className="text-xl font-mono font-bold text-purple-600 dark:text-purple-400">
                                            {formatCurrency(year.total)}
                                        </span>
                                    </div>
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-stone-50/50 dark:bg-stone-900/30">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">VAT</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Non-VAT</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Avg/Txn</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Count</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                                {year.accounts.map((acc) => (
                                                    <tr key={acc.account} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                                                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{acc.account}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(acc.totalVat)}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{formatCurrency(acc.totalNonVat)}</td>
                                                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(acc.total)}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-gray-500">{formatCurrency(acc.total / acc.count)}</td>
                                                        <td className="px-6 py-3 text-right text-gray-500">{acc.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            <BarChart3 className="mx-auto text-gray-300 mb-4" size={48} />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Yearly Data</h3>
                            <p className="text-gray-500">Create vouchers to see yearly expense summaries.</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: OVERVIEW STATS */}
            {activeSubTab === 'totals' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <Receipt size={20} className="text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400">Total Transactions</p>
                        </div>
                        <p className="text-3xl font-mono font-bold text-blue-900 dark:text-white">{vouchers.length}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">All vouchers</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-600 rounded-lg">
                                <TrendingUp size={20} className="text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">Average Amount</p>
                        </div>
                        <p className="text-3xl font-mono font-bold text-emerald-900 dark:text-white">
                            {vouchers.length > 0 ? formatCurrency(summary.totalAmount / vouchers.length) : '₱0.00'}
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Per voucher</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-600 rounded-lg">
                                <TrendingDown size={20} className="text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase text-purple-700 dark:text-purple-400">Largest Expense</p>
                        </div>
                        <p className="text-3xl font-mono font-bold text-purple-900 dark:text-white">
                            {vouchers.length > 0 ? formatCurrency(Math.max(...vouchers.map(v => (parseFloat(v.amount_vat || 0) + parseFloat(v.amount_non_vat || 0))))) : '₱0.00'}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Single voucher</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-600 rounded-lg">
                                <PieChart size={20} className="text-white" />
                            </div>
                            <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">Unique Accounts</p>
                        </div>
                        <p className="text-3xl font-mono font-bold text-amber-900 dark:text-white">{expensesByAccount.length}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Categories used</p>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* MODALS */}
      {showCreateModal && (
        <PettyCashBulkCreator
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setOcrDraftVoucher(null);
            setOcrDraftVouchers([]);
          }}
          onSubmit={handleCreateVoucher}
          chartOfAccounts={chartOfAccounts}
          isDarkMode={isDarkMode}
          createdBy={user?.id}
          initialDraft={ocrDraftVoucher}
          initialDrafts={ocrDraftVouchers}
        />
      )}

      {showEditModal && selectedVoucher && (
        <PettyCashBulkCreator
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedVoucher(null);
          }}
          onSubmit={handleEditVoucher}
          chartOfAccounts={chartOfAccounts}
          isDarkMode={isDarkMode}
          createdBy={user?.id}
          editMode={true}
          initialData={selectedVoucher}
        />
      )}

      {showViewModal && selectedVoucher && (
        <PettyCashViewModal
          voucher={selectedVoucher}
          onClose={() => {
            setShowViewModal(false);
            setSelectedVoucher(null);
          }}
          isDarkMode={isDarkMode}
          chartOfAccounts={chartOfAccounts}
        />
      )}

      {showSetBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSetBalanceModal(false)} />
          <div className={`relative rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 ${
            isDarkMode ? 'bg-stone-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Set Beginning Balance</h3>
                <p className="text-xs text-gray-500">Manually set starting amount</p>
              </div>
            </div>
            
            <div className={`mb-6 p-4 rounded-xl flex gap-3 ${
              isDarkMode ? 'bg-amber-900/20 text-amber-200' : 'bg-amber-50 text-amber-800'
            }`}>
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                This will reset the beginning balance for the current period. Only use this when initializing a new period or correcting discrepancies.
              </p>
            </div>
            
            <form onSubmit={handleSetBeginningBalance}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Balance Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className={`w-full pl-9 pr-4 py-3 border rounded-xl text-lg font-mono font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all ${
                      isDarkMode
                        ? 'bg-stone-900 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    value={newBeginningBalance}
                    onChange={(e) => setNewBeginningBalance(e.target.value)}
                    required
                    autoFocus
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowSetBalanceModal(false)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                    isDarkMode ? 'text-gray-300 hover:bg-stone-700' : 'text-gray-600 hover:bg-stone-100'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-600/20 transition-all"
                >
                  Confirm Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PettyCashImportModal
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

/**
 * PettyCashViewModal - Detail view modal for vouchers
 */
function PettyCashViewModal({ voucher, onClose, isDarkMode, chartOfAccounts = [] }) {
  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const totalAmount = parseFloat(voucher.amount_vat || 0) + parseFloat(voucher.amount_non_vat || 0);
  const proofDocuments = parseProofDocuments(voucher.proof_documents_json);

  const getStatusBadge = (status) => {
    const configs = {
      draft: { bg: 'bg-stone-100 dark:bg-stone-700', text: 'text-gray-700 dark:text-gray-300' },
      pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
      approved: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
      paid: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
      cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' }
    };
    const config = configs[status] || configs.draft;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border border-transparent ${config.bg} ${config.text}`}>
            {status}
        </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all" onClick={onClose}>
      <div 
        className={`rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-stone-800 border border-gray-700' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700 bg-stone-800' : 'border-gray-100 bg-white'}`}>
           <div className="flex items-center gap-4">
               <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 border border-blue-100 text-blue-600'}`}>
                   <Receipt size={24} />
               </div>
               <div>
                   <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Petty Cash Details</h2>
                   <p className="text-sm text-gray-500">#{voucher.voucher_number || voucher.id}</p>
               </div>
           </div>
           <button 
             onClick={onClose} 
             className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-stone-700 text-gray-400' : 'hover:bg-stone-100 text-gray-500'}`}
           >
             <X size={24}/>
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Account Classification</label>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{voucher.account_classification || voucher.particulars || 'N/A'}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Payee</label>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{voucher.company_supplier || 'N/A'}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Total Amount</label>
                    <p className={`font-mono font-bold text-lg ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(totalAmount)}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Date</label>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatDate(voucher.voucher_date)}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Receipt Number</label>
                    <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{voucher.receipt_number || 'N/A'}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Status</label>
                    <div>{getStatusBadge(voucher.status)}</div>
                </div>
            </div>

            {/* VAT Breakdown */}
            <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">VAT Amount</p>
                    <p className={`font-mono font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(voucher.amount_vat)}</p>
                </div>
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-purple-900/10 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Non-VAT Amount</p>
                    <p className={`font-mono font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(voucher.amount_non_vat)}</p>
                </div>
            </div>

            {/* Additional Details */}
            {voucher.particulars && (
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Particulars</label>
                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{voucher.particulars}</p>
                </div>
            )}

            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-stone-900/30 border-gray-700' : 'bg-stone-50 border-gray-200'}`}>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Proof Documents</label>
              {proofDocuments.length === 0 ? (
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No proof documents attached.</p>
              ) : (
                <ul className="space-y-2">
                  {proofDocuments.map((doc, index) => {
                    const isUrl = /^https?:\/\//i.test(doc.reference);
                    return (
                      <li key={`${doc.label}-${index}`} className={`text-xs rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-stone-900/50 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <p className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{doc.label}</p>
                        {isUrl ? (
                          <a
                            href={doc.reference}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`break-all underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                          >
                            {doc.reference}
                          </a>
                        ) : (
                          <p className={`break-all ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{doc.reference}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Line Items */}
            {voucher.line_items && voucher.line_items.length > 0 && (
                <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Line Items</h3>
                    <div className={`border rounded-xl overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <table className="w-full text-sm">
                            <thead className={`${isDarkMode ? 'bg-stone-900/50' : 'bg-stone-50'}`}>
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Company/Supplier</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Particulars</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Type</th>
                                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                                {voucher.line_items.map((item, i) => {
                                    const itemVat = parseFloat(item.vat_amount || 0);
                                    const itemNonVat = parseFloat(item.non_vat_amount || 0);
                                    const itemTotal = itemVat + itemNonVat;
                                    const isVat = itemVat > 0;
                                    
                                    return (
                                        <tr key={i} className={`${isDarkMode ? 'hover:bg-stone-900/30' : 'hover:bg-stone-50'}`}>
                                            <td className={`px-4 py-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {item.location || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{item.description || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {isVat ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                        VAT
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                        Non-VAT
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-mono font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {formatCurrency(itemTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer */}
        <div className={`p-4 border-t flex justify-end ${isDarkMode ? 'border-gray-700 bg-stone-800' : 'border-gray-200 bg-white'}`}>
            <button 
              onClick={onClose} 
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-stone-700 hover:bg-stone-600 text-white' : 'bg-stone-100 hover:bg-stone-200 text-gray-700'}`}
            >
              Close
            </button>
        </div>
      </div>
    </div>
  );
}