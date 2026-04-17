import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import apiService from "../../../utils/api/api-service";
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  Loader2,
  Lock,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  ArrowRight,
} from "lucide-react";
import PayrollCheckingBulkCreator from "../components/forms/PayrollCheckingBulkCreator";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import { PayrollCheckingReport } from "../../../utils/reports/PayrollCheckingReport";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CUTOFF_PERIODS = ["1st", "2nd"];

const CHECKING_STATUS_COLORS = {
  draft:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  locked:
    "bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-500/10 dark:text-blue-400 dark:border-blue-500/20",
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
};

const REQUEST_STATUS_COLORS = {
  draft:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  submitted:
    "bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-500/10 dark:text-blue-400 dark:border-blue-500/20",
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  released:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  cancelled:
    "bg-stone-50 text-gray-500 border-gray-200 dark:bg-stone-500/10 dark:text-gray-400 dark:border-gray-500/20",
};

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_CONFIRM_DIALOG = {
  title: "Confirm Action",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  type: "danger",
  showInput: false,
  inputLabel: "Reason",
  inputPlaceholder: "",
  inputRequired: false,
  inputMultiline: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SHELL
// ─────────────────────────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children, isDarkMode, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[92vh] overflow-hidden rounded-2xl border shadow-2xl ${
          isDarkMode ? "bg-stone-950 border-gray-800" : "bg-stone-100 border-gray-200"
        }`}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"
          }`}
        >
          <div>
            <h3 className={`font-bold text-xl ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {title}
            </h3>
            {subtitle && (
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              isDarkMode ? "hover:bg-stone-800 text-gray-300" : "hover:bg-stone-100 text-gray-600"
            }`}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(92vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE ITEMS EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function LineItemsEditor({ items, onChange, isDarkMode, labelPlaceholder = "Description" }) {
  const inputClass = `w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${
    isDarkMode
      ? "bg-stone-950 border-gray-700 text-gray-100 focus:border-blue-500"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
  }`;

  const addRow = () =>
    onChange([...items, { id: `li-${Date.now()}`, label: "", amount: "" }]);

  const removeRow = (id) => onChange(items.filter((i) => i.id !== id));

  const updateRow = (id, field, value) =>
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder={labelPlaceholder}
            value={item.label}
            onChange={(e) => updateRow(item.id, "label", e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={item.amount}
            onChange={(e) => updateRow(item.id, "amount", e.target.value)}
            className={`${inputClass} w-36`}
          />
          <button
            type="button"
            onClick={() => removeRow(item.id)}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-all ${
          isDarkMode
            ? "border-gray-800 hover:border-gray-700 text-gray-400 hover:bg-stone-900"
            : "border-gray-300 hover:border-gray-400 text-gray-500 hover:bg-white"
        }`}
      >
        <Plus size={16} /> Add Row
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PayrollCheckingSection({ formatCurrency }) {
  const { isDarkMode, user } = useAuth();

  const mainTab = "checking";

  const [checkingRecords, setCheckingRecords] = useState([]);
  const [cashRequests, setCashRequests]       = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [notice, setNotice]                   = useState({ type: "", message: "" });

  const [expandedChecking, setExpandedChecking] = useState({});
  const [expandedRequest, setExpandedRequest]   = useState({});
  const [loadingCheckingDetails, setLoadingCheckingDetails] = useState({});

  const [showCheckingModal, setShowCheckingModal] = useState(false);
  const [editingChecking, setEditingChecking]     = useState(null);
  const [submittingChecking, setSubmittingChecking] = useState(false);
  const [checkingForm, setCheckingForm] = useState({
    cutoff_date: today(),
    cutoff_period: "1st",
    gross_payroll: "",
    adjustment_cash: "",
    petty_cash_replenishment: "50000",
    canteen: "7000",
    monthly_bills_total: "",
    remarks: "",
  });
  const [checkingFees, setCheckingFees] = useState([]);
  const [checkingReimbs, setCheckingReimbs] = useState([]);
  const [fetchingGross, setFetchingGross] = useState(false);
  const [fetchingBills, setFetchingBills] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editingRequest, setEditingRequest]     = useState(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    cutoff_date: today(),
    cutoff_period: "1st",
    adj_net_payroll: "",
    petty_cash_replenishment: "50000",
    canteen: "7000",
    monthly_bills_total: "",
    remarks: "",
  });
  const [requestReimbs, setRequestReimbs] = useState([]);

  const [actioning, setActioning] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    ...DEFAULT_CONFIRM_DIALOG,
    isOpen: false,
  });
  const confirmActionRef = useRef(null);

  const openConfirm = useCallback((config, onConfirm) => {
    confirmActionRef.current = onConfirm;
    setConfirmDialog({ ...DEFAULT_CONFIRM_DIALOG, ...config, isOpen: true });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    confirmActionRef.current = null;
  }, []);

  // ── Export state ─────────────────────────────────────────────────────────
  // exportingId = record.id for per-row export, "all" for bulk export
  const [exportingId, setExportingId] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // STYLE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const sectionClass = `rounded-xl border p-4 ${
    isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"
  }`;
  const labelClass = `block text-xs font-semibold mb-1.5 ${
    isDarkMode ? "text-gray-400" : "text-gray-500"
  }`;
  const inputClass = `w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all ${
    isDarkMode
      ? "bg-stone-950 border-gray-700 text-gray-100 focus:border-blue-500"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
  }`;

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchChecking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.finance.getPayrollCheckingRecords();
      setCheckingRecords(res?.data || []);
    } catch (err) {
      console.error("Failed to fetch payroll checking:", err);
      setNotice({ type: "error", message: "Failed to load checking records." });
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureCheckingDetails = useCallback(async (record) => {
    if (!record?.id) return;
    const alreadyLoaded =
      Array.isArray(record.additional_fees) && Array.isArray(record.reimbursements);
    if (alreadyLoaded) return;

    setLoadingCheckingDetails((prev) => ({ ...prev, [record.id]: true }));
    try {
      const res = await apiService.finance.getPayrollCheckingRecord(record.id);
      const detail = res?.data;
      if (detail) {
        setCheckingRecords((prev) =>
          prev.map((r) => (r.id === record.id ? { ...r, ...detail } : r))
        );
      }
    } catch (err) {
      console.error("Failed to load checking detail lines:", err);
    } finally {
      setLoadingCheckingDetails((prev) => ({ ...prev, [record.id]: false }));
    }
  }, []);

  const toggleCheckingExpanded = useCallback((record) => {
    const willExpand = !expandedChecking[record.id];
    setExpandedChecking((prev) => ({ ...prev, [record.id]: !prev[record.id] }));
    if (willExpand) {
      ensureCheckingDetails(record);
    }
  }, [expandedChecking, ensureCheckingDetails]);

  const fetchCashRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.finance.getCashRequests();
      setCashRequests(res?.data || []);
    } catch (err) {
      console.error("Failed to fetch cash requests:", err);
      setNotice({ type: "error", message: "Failed to load cash requests." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChecking();
  }, [fetchChecking]);

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT EXPORT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleExportRecord = useCallback(async (record) => {
    if (exportingId) return;
    setExportingId(record.id);
    try {
      await PayrollCheckingReport(record.id);
    } catch (err) {
      console.error("Export failed:", err);
      setNotice({ type: "error", message: `Export failed: ${err?.message || "Unknown error"}` });
    } finally {
      setExportingId(null);
    }
  }, [exportingId]);

  const handleExportAll = useCallback(async () => {
    if (exportingId) return;
    if (!checkingRecords.length) {
      setNotice({ type: "error", message: "No records to export." });
      return;
    }
    setExportingId("all");
    try {
      await PayrollCheckingReport(); // no id = fetches & exports all
      setNotice({ type: "success", message: `Exported ${checkingRecords.length} record(s) successfully.` });
    } catch (err) {
      console.error("Bulk export failed:", err);
      setNotice({ type: "error", message: `Export failed: ${err?.message || "Unknown error"}` });
    } finally {
      setExportingId(null);
    }
  }, [exportingId, checkingRecords.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY METRICS
  // ─────────────────────────────────────────────────────────────────────────

  const checkingMetrics = useMemo(() => {
    const approved = checkingRecords.filter((r) => r.status === "approved").length;
    const draft    = checkingRecords.filter((r) => r.status === "draft").length;
    const totalGross = checkingRecords.reduce((s, r) => s + Number(r.gross_payroll || r.gross_payroll_total || 0), 0);
    return { approved, draft, totalGross, total: checkingRecords.length };
  }, [checkingRecords]);

  const requestMetrics = useMemo(() => {
    const released   = cashRequests.filter((r) => r.status === "released").length;
    const pending    = cashRequests.filter((r) => ["draft", "submitted"].includes(r.status)).length;
    const totalNeed  = cashRequests.reduce((s, r) => s + Number(r.total_cash_needed || 0), 0);
    return { released, pending, totalNeed, total: cashRequests.length };
  }, [cashRequests]);

  const summaryCards = mainTab === "checking"
    ? [
        {
          title: "Total Records",
          value: String(checkingMetrics.total),
          subtitle: `${checkingMetrics.draft} draft · ${checkingMetrics.approved} approved`,
          icon: ClipboardList,
          iconWrap: "bg-gray-500/10",
          iconColor: "text-blue-500",
        },
        {
          title: "Total Gross Payroll",
          value: formatCurrency(checkingMetrics.totalGross),
          subtitle: "across all cutoffs",
          icon: Banknote,
          iconWrap: "bg-emerald-500/10",
          iconColor: "text-emerald-500",
        },
        {
          title: "Approved",
          value: String(checkingMetrics.approved),
          subtitle: `${checkingMetrics.draft} still in draft`,
          icon: FileCheck2,
          iconWrap: "bg-purple-500/10",
          iconColor: "text-purple-500",
        },
      ]
    : [
        {
          title: "Total Requests",
          value: String(requestMetrics.total),
          subtitle: `${requestMetrics.pending} pending · ${requestMetrics.released} released`,
          icon: FileClock,
          iconWrap: "bg-amber-500/10",
          iconColor: "text-amber-500",
        },
        {
          title: "Total Cash Needed",
          value: formatCurrency(requestMetrics.totalNeed),
          subtitle: "across all cutoffs",
          icon: Wallet,
          iconWrap: "bg-rose-500/10",
          iconColor: "text-rose-500",
        },
        {
          title: "Released",
          value: String(requestMetrics.released),
          subtitle: `${requestMetrics.pending} awaiting approval`,
          icon: ShieldCheck,
          iconWrap: "bg-emerald-500/10",
          iconColor: "text-emerald-500",
        },
      ];

  // ─────────────────────────────────────────────────────────────────────────
  // CHECKING SHEET — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const openCheckingModal = async (record = null) => {
    if (record?.id) {
      try {
        const res = await apiService.finance.getPayrollCheckingRecord(record.id);
        setEditingChecking(res?.data || record);
      } catch (err) {
        console.error("Failed to load checking record details:", err);
        setEditingChecking(record);
      }
    } else {
      setEditingChecking(null);
    }
    setShowCheckingModal(true);
  };

  const handleCheckingBulkSave = async (payload) => {
    setSubmittingChecking(true);
    setNotice({ type: "", message: "" });
    try {
      if (editingChecking) {
        await apiService.finance.updatePayrollCheckingRecord(editingChecking.id, payload);
        setNotice({ type: "success", message: "Checking record updated successfully." });
      } else {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows) {
          await apiService.finance.createPayrollCheckingRecord({
            ...row,
            created_by: user?.id || null,
          });
        }
        setNotice({
          type: "success",
          message: rows.length > 1
            ? `Created ${rows.length} checking records successfully.`
            : "Checking record created successfully.",
        });
      }
      setShowCheckingModal(false);
      setEditingChecking(null);
      await fetchChecking();
    } catch (err) {
      console.error("Checking submit error:", err);
      setNotice({ type: "error", message: err?.message || "Failed to save checking record." });
    } finally {
      setSubmittingChecking(false);
    }
  };

  const handleCheckingDelete = (record) => {
    openConfirm(
      {
        title: "Delete Checking Record",
        message: `Delete checking record for ${record.cutoff_date} (${record.cutoff_period})?`,
        confirmText: "Delete",
        type: "danger",
      },
      async () => {
        try {
          await apiService.finance.deletePayrollCheckingRecord(record.id);
          setNotice({ type: "success", message: "Checking record deleted." });
          await fetchChecking();
        } catch (err) {
          setNotice({ type: "error", message: err?.message || "Failed to delete." });
        }
      }
    );
  };

  const handleCheckingAction = async (record, action) => {
    setActioning(record.id);
    try {
      if (action === "lock") {
        await apiService.finance.lockPayrollCheckingRecord(record.id, user?.id || null);
      } else if (action === "approve") {
        await apiService.finance.approvePayrollCheckingRecord(record.id, user?.id || null);
      } else if (action === "revert") {
        await apiService.finance.revertPayrollCheckingToDraft(record.id, user?.id || null);
      }
      const labels = { lock: "locked", approve: "approved", revert: "reverted to draft" };
      setNotice({ type: "success", message: `Record ${labels[action] || action} successfully.` });
      await fetchChecking();
    } catch (err) {
      setNotice({ type: "error", message: err?.message || `Failed to ${action}.` });
    } finally {
      setActioning(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CASH REQUEST — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const openRequestModal = (record = null) => {
    if (record) {
      setEditingRequest(record);
      setRequestForm({
        cutoff_date:              record.cutoff_date              || today(),
        cutoff_period:            record.cutoff_period            || "1st",
        adj_net_payroll:          record.adj_net_payroll          || "",
        petty_cash_replenishment: record.petty_cash_replenishment || "50000",
        canteen:                  record.canteen                  || "7000",
        monthly_bills_total:      record.monthly_bills_total      || "",
        remarks:                  record.remarks                  || "",
      });
      const reimbs = (record.reimbursements || []).map((r) => ({
        id: `li-${r.id || Date.now()}-${Math.random()}`,
        label:  r.label  || "",
        amount: r.amount || "",
      }));
      setRequestReimbs(reimbs);
    } else {
      setEditingRequest(null);
      setRequestForm({
        cutoff_date: today(), cutoff_period: "1st",
        adj_net_payroll: "", petty_cash_replenishment: "50000",
        canteen: "7000", monthly_bills_total: "", remarks: "",
      });
      setRequestReimbs([]);
    }
    setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRequest(true);
    setNotice({ type: "", message: "" });
    try {
      const reimbs = requestReimbs
        .filter((r) => r.label && Number(r.amount) > 0)
        .map((r) => ({ label: r.label, amount: Number(r.amount) }));
      const payload = {
        ...requestForm,
        adj_net_payroll:          Number(requestForm.adj_net_payroll          || 0),
        petty_cash_replenishment: Number(requestForm.petty_cash_replenishment || 50000),
        canteen:                  Number(requestForm.canteen                  || 7000),
        monthly_bills_total:      Number(requestForm.monthly_bills_total      || 0),
        reimbursements: reimbs,
        requested_by: user?.id || null,
      };
      if (editingRequest) {
        await apiService.finance.updateCashRequest(editingRequest.id, payload);
        setNotice({ type: "success", message: "Cash request updated successfully." });
      } else {
        await apiService.finance.createCashRequest(payload);
        setNotice({ type: "success", message: "Cash request created successfully." });
      }
      setShowRequestModal(false);
      setEditingRequest(null);
      await fetchCashRequests();
    } catch (err) {
      console.error("Request submit error:", err);
      setNotice({ type: "error", message: err?.message || "Failed to save cash request." });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleRequestDelete = (record) => {
    openConfirm(
      {
        title: "Delete Cash Request",
        message: `Delete cash request ${record.request_number}?`,
        confirmText: "Delete",
        type: "danger",
      },
      async () => {
        try {
          await apiService.finance.deleteCashRequest(record.id);
          setNotice({ type: "success", message: "Cash request deleted." });
          await fetchCashRequests();
        } catch (err) {
          setNotice({ type: "error", message: err?.message || "Failed to delete." });
        }
      }
    );
  };

  const handleRequestAction = async (record, action) => {
    if (action === "cancel") {
      openConfirm(
        {
          title: "Cancel Cash Request",
          message: `Enter cancellation reason for cash request ${record.request_number}.`,
          confirmText: "Cancel Request",
          cancelText: "Back",
          type: "warning",
          showInput: true,
          inputLabel: "Cancellation Reason",
          inputPlaceholder: "Reason...",
          inputRequired: true,
          inputMultiline: true,
        },
        async (reason) => {
          const trimmed = String(reason || "").trim();
          if (!trimmed) return;
          setActioning(record.id);
          try {
            await apiService.finance.cancelCashRequest(record.id, trimmed, user?.id || null);
            setNotice({ type: "success", message: "Cash request cancelled." });
            await fetchCashRequests();
          } catch (err) {
            setNotice({ type: "error", message: err?.message || "Failed to cancel." });
          } finally {
            setActioning(null);
          }
        }
      );
      return;
    }
    setActioning(record.id);
    try {
      if (action === "submit") {
        await apiService.finance.submitCashRequest(record.id, user?.id || null);
      } else if (action === "approve") {
        await apiService.finance.approveCashRequest(record.id, user?.id || null);
      } else if (action === "release") {
        await apiService.finance.releaseCashRequest(record.id, user?.id || null);
      }
      const labels = { submit: "submitted", approve: "approved", release: "released" };
      setNotice({ type: "success", message: `Request ${labels[action] || action} successfully.` });
      await fetchCashRequests();
    } catch (err) {
      setNotice({ type: "error", message: err?.message || `Failed to ${action}.` });
    } finally {
      setActioning(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────

  const getCheckingComputed = (record) => {
    const fees = Number(record.total_additional_fees || 0);
    const reimbs = Number(record.total_reimbursements || 0);
    const grossPayroll = Number(record.gross_payroll || record.gross_payroll_total || 0);
    const adjustment = Number(record.adjustment_cash || 0);
    const petty = Number(record.petty_cash_replenishment || 50000);
    const canteen = Number(record.canteen || 7000);
    const monthlyBills = Number(record.monthly_bills_total || 0);
    const adjustedGross = grossPayroll + fees + adjustment;
    const fixedCosts = petty + canteen + monthlyBills;
    const totalCashNeeded = adjustedGross + fixedCosts + reimbs;
    return { fees, reimbs, cashAndCoins: adjustedGross, grossPayroll, adjustment, petty, canteen, monthlyBills, adjustedGross, fixedCosts, totalCashNeeded };
  };

  const getRequestComputed = (record) => {
    const reimbs   = Number(record.total_reimbursements || 0);
    const total    = Number(record.adj_net_payroll || 0)
                   + Number(record.petty_cash_replenishment || 0)
                   + Number(record.canteen || 0)
                   + Number(record.monthly_bills_total || 0)
                   + reimbs;
    return { reimbs, total };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const StatusBadge = ({ status, map }) => {
    const cls = (map || {})[status] || "bg-stone-50 text-gray-500 border-gray-200";
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${cls}`}>
        {status}
      </span>
    );
  };

  const DataRow = ({ label, value, accent, muted }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-xs ${muted ? (isDarkMode ? "text-gray-600" : "text-gray-400") : (isDarkMode ? "text-gray-400" : "text-gray-500")}`}>
        {label}
      </span>
      <span className={`text-sm font-bold font-mono ${accent || (isDarkMode ? "text-white" : "text-gray-900")}`}>
        {value}
      </span>
    </div>
  );

  const LineRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-1">
      <span className={`text-xs pl-2 border-l-2 ${isDarkMode ? "text-gray-500 border-gray-700" : "text-gray-400 border-gray-200"}`}>
        {label}
      </span>
      <span className={`text-xs font-mono font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
        {value}
      </span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CHECKING TABLE ROW
  // ─────────────────────────────────────────────────────────────────────────

  const CheckingRow = ({ record }) => {
    const isExpanded  = !!expandedChecking[record.id];
    const computed    = getCheckingComputed(record);
    const isActioning = actioning === record.id;
    const isExporting = exportingId === record.id;

    const panelBase = `rounded-xl border p-4 ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`;
    const sectionLabel = `text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5`;
    const divider = `my-2 border-t ${isDarkMode ? "border-gray-800" : "border-gray-100"}`;

    return (
      <React.Fragment>
        <tr className="group hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors">
          {/* Period */}
          <td className="px-6 py-4">
            <button
              onClick={() => toggleCheckingExpanded(record)}
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{record.cutoff_date}</span>
            </button>
            <p className={`text-xs mt-0.5 ml-6 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {record.cutoff_period} cutoff
            </p>
          </td>

          {/* Adjusted Gross Pay */}
          <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(computed.cashAndCoins)}
          </td>

          {/* Gross Payroll */}
          <td className="px-6 py-4 font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(computed.grossPayroll)}
          </td>

          {/* Total Cash Needed */}
          <td className="px-6 py-4">
            <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(computed.totalCashNeeded)}
            </span>
          </td>

          {/* Status */}
          <td className="px-6 py-4 text-center">
            <StatusBadge status={record.status} map={CHECKING_STATUS_COLORS} />
          </td>

          {/* Actions */}
          <td className="px-6 py-4 text-right">
            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
              {record.status === "draft" && (
                <>
                  <button
                    onClick={() => openCheckingModal(record)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 dark:hover:bg-stone-700 transition-colors inline-flex items-center gap-1"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    disabled={isActioning}
                    onClick={() => handleCheckingAction(record, "lock")}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-blue-700 hover:bg-gray-100 dark:bg-gray-500/10 dark:text-blue-400 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isActioning ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                    Lock
                  </button>
                  <button
                    onClick={() => handleCheckingDelete(record)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {record.status === "locked" && (
                <>
                  <button
                    disabled={isActioning}
                    onClick={() => handleCheckingAction(record, "approve")}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isActioning ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Approve
                  </button>
                  <button
                    disabled={isActioning}
                    onClick={() => handleCheckingAction(record, "revert")}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-600 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isActioning ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                    Back to Draft
                  </button>
                </>
              )}
              {record.status === "approved" && (
                <button
                  disabled={isActioning}
                  onClick={() => handleCheckingAction(record, "revert")}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-600 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {isActioning ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                  Back to Draft
                </button>
              )}
              <button
                onClick={() => toggleCheckingExpanded(record)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 dark:hover:bg-stone-700 transition-colors"
              >
                {isExpanded ? "Hide" : "Details"}
              </button>

              {/* ── Per-record Export button ─────────────────────────────── */}
              <button
                disabled={isExporting || !!exportingId}
                onClick={() => handleExportRecord(record)}
                title="Export this record to Excel"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDarkMode
                    ? "bg-teal-500/10 text-teal-400 hover:bg-teal-500/20"
                    : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                  }`}
              >
                {isExporting
                  ? <><Loader2 size={11} className="animate-spin" /> Exporting…</>
                  : <><Download size={11} /> Export</>
                }
              </button>
            </div>
          </td>
        </tr>

        {/* ── EXPANDED DETAIL PANEL (RESTRUCTURED) ────────────────────────── */}
        {isExpanded && (
          <tr>
            <td colSpan={6} className={`px-6 py-5 ${isDarkMode ? "bg-stone-900/50" : "bg-stone-50/60"}`}>

              {/* ── STEP HEADER ── */}
              <div className="flex items-center gap-2 mb-4">
                {[
                  { n: "1", label: "Payroll Computation" },
                  { n: "2", label: "Additional Cash" },
                  { n: "3", label: "Total Cash Needed" },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.n}>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                        isDarkMode ? "bg-stone-700 text-gray-300" : "bg-stone-200 text-gray-600"
                      }`}>
                        {step.n}
                      </span>
                      <span className={`text-xs font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight size={13} className={isDarkMode ? "text-gray-700" : "text-gray-300"} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* ── THREE PANELS ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* ── PANEL 1: PAYROLL COMPUTATION ── */}
                <div className={panelBase}>
                  <p className={`${sectionLabel} ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                    <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${isDarkMode ? "bg-gray-500/20 text-blue-400" : "bg-gray-100 text-blue-600"}`}>1</span>
                    Payroll Computation
                  </p>

                  {/* Gross base */}
                  <DataRow label="Gross Payroll" value={formatCurrency(computed.grossPayroll)} />

                  {/* Adjustments */}
                  {(computed.fees > 0 || computed.adjustment !== 0) && (
                    <>
                      <div className={divider} />
                      {computed.fees > 0 && (
                        <DataRow label="+ Additional Fees" value={formatCurrency(computed.fees)} accent="text-amber-500" />
                      )}
                      {computed.adjustment !== 0 && (
                        <DataRow
                          label={`${computed.adjustment >= 0 ? "+" : "−"} Adjustment Cash`}
                          value={formatCurrency(Math.abs(computed.adjustment))}
                          accent={computed.adjustment >= 0 ? "text-amber-500" : "text-red-400"}
                        />
                      )}
                    </>
                  )}

                  {/* Additional fees line items */}
                  {loadingCheckingDetails[record.id] ? (
                    <p className={`text-xs mt-2 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>Loading...</p>
                  ) : (record.additional_fees || []).length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {(record.additional_fees || []).map((f, i) => (
                        <LineRow key={i} label={f.label} value={formatCurrency(Number(f.amount || 0))} />
                      ))}
                    </div>
                  )}

                  {/* Result */}
                  <div className={`mt-3 pt-3 border-t-2 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                        = Adjusted Gross Pay
                      </span>
                      <span className="text-base font-black font-mono text-blue-500">
                        {formatCurrency(computed.adjustedGross)}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                      Cash &amp; coins for payroll disbursement
                    </p>
                  </div>
                </div>

                {/* ── PANEL 2: ADDITIONAL CASH NEEDS ── */}
                <div className={panelBase}>
                  <p className={`${sectionLabel} ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                    <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${isDarkMode ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"}`}>2</span>
                    Additional Cash Needs
                  </p>

                  {/* Fixed operational costs */}
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                    Fixed / Operational
                  </p>
                  <DataRow label="Petty Cash Replenishment" value={formatCurrency(computed.petty)} />
                  <DataRow label="Canteen" value={formatCurrency(computed.canteen)} />
                  <DataRow label="Monthly Bills" value={formatCurrency(computed.monthlyBills)} />

                  <div className={`${divider}`} />

                  {/* Reimbursements */}
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                      Reimbursements
                    </p>
                    <span className={`text-xs font-bold font-mono ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                      {formatCurrency(computed.reimbs)}
                    </span>
                  </div>

                  {loadingCheckingDetails[record.id] ? (
                    <p className={`text-xs ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>Loading items...</p>
                  ) : (record.reimbursements || []).length > 0 ? (
                    <div className="space-y-0.5">
                      {(record.reimbursements || []).map((r, i) => (
                        <LineRow key={i} label={r.label} value={formatCurrency(Number(r.amount || 0))} />
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs italic ${isDarkMode ? "text-gray-700" : "text-gray-400"}`}>
                      No reimbursement items
                    </p>
                  )}

                  {/* Fixed costs subtotal */}
                  <div className={`mt-3 pt-3 border-t-2 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                        = Subtotal
                      </span>
                      <span className="text-base font-black font-mono text-amber-500">
                        {formatCurrency(computed.fixedCosts + computed.reimbs)}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                      Fixed costs + reimbursements
                    </p>
                  </div>
                </div>

                {/* ── PANEL 3: TOTAL CASH NEEDED ── */}
                <div className={`${panelBase} flex flex-col`}>
                  <p className={`${sectionLabel} ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                    <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}>3</span>
                    Cash Needed Summary
                  </p>

                  {/* Component breakdown */}
                  <div className="space-y-0.5 flex-1">
                    <div className={`rounded-lg px-3 py-2 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                          Payroll (Step 1)
                        </span>
                        <span className="text-sm font-bold font-mono text-blue-500">
                          {formatCurrency(computed.adjustedGross)}
                        </span>
                      </div>
                    </div>

                    <div className={`text-center text-lg font-black leading-none py-0.5 ${isDarkMode ? "text-gray-700" : "text-gray-300"}`}>+</div>

                    <div className={`rounded-lg px-3 py-2 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                          Add'l Cash (Step 2)
                        </span>
                        <span className="text-sm font-bold font-mono text-amber-500">
                          {formatCurrency(computed.fixedCosts + computed.reimbs)}
                        </span>
                      </div>
                      {/* Sub-breakdown */}
                      <div className={`mt-1.5 pt-1.5 border-t space-y-0.5 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                        <div className="flex justify-between text-[10px]">
                          <span className={isDarkMode ? "text-gray-600" : "text-gray-400"}>Petty Cash</span>
                          <span className={`font-mono ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{formatCurrency(computed.petty)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className={isDarkMode ? "text-gray-600" : "text-gray-400"}>Canteen</span>
                          <span className={`font-mono ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{formatCurrency(computed.canteen)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className={isDarkMode ? "text-gray-600" : "text-gray-400"}>Monthly Bills</span>
                          <span className={`font-mono ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{formatCurrency(computed.monthlyBills)}</span>
                        </div>
                        {computed.reimbs > 0 && (
                          <div className="flex justify-between text-[10px]">
                            <span className={isDarkMode ? "text-gray-600" : "text-gray-400"}>Reimbursements</span>
                            <span className={`font-mono ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{formatCurrency(computed.reimbs)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grand total */}
                  <div className={`mt-3 pt-3 border-t-2 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <div className={`rounded-xl px-4 py-3 ${isDarkMode ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-emerald-50 border border-emerald-200"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? "text-emerald-500" : "text-emerald-600"}`}>
                        Total Cash Needed
                      </p>
                      <p className="text-2xl font-black font-mono text-emerald-500">
                        {formatCurrency(computed.totalCashNeeded)}
                      </p>
                    </div>

                    {/* ── Inline export shortcut inside expanded panel ───── */}
                    <button
                      disabled={isExporting || !!exportingId}
                      onClick={() => handleExportRecord(record)}
                      className={`mt-3 w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${isDarkMode
                          ? "bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20"
                          : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                        }`}
                    >
                      {isExporting
                        ? <><Loader2 size={13} className="animate-spin" /> Exporting…</>
                        : <><FileSpreadsheet size={13} /> Export this cutoff to Excel</>
                      }
                    </button>

                    {record.remarks && (
                      <p className={`mt-2.5 text-xs italic ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                        📝 {record.remarks}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CASH REQUEST TABLE ROW
  // ─────────────────────────────────────────────────────────────────────────

  const RequestRow = ({ record }) => {
    const isExpanded  = !!expandedRequest[record.id];
    const computed    = getRequestComputed(record);
    const isActioning = actioning === record.id;

    return (
      <React.Fragment>
        <tr className="group hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors">
          <td className="px-6 py-4">
            <button
              onClick={() => setExpandedRequest((p) => ({ ...p, [record.id]: !p[record.id] }))}
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white font-mono"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {record.request_number}
            </button>
            <p className={`text-xs mt-0.5 ml-6 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {record.cutoff_date} · {record.cutoff_period} cutoff
            </p>
          </td>
          <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(Number(record.adj_net_payroll || 0))}
          </td>
          <td className="px-6 py-4">
            <div className="text-xs space-y-0.5">
              <div className="flex gap-2">
                <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>Petty:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(Number(record.petty_cash_replenishment || 0))}
                </span>
              </div>
              <div className="flex gap-2">
                <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>Canteen:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(Number(record.canteen || 0))}
                </span>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white">
            {formatCurrency(Number(record.monthly_bills_total || 0))}
          </td>
          <td className="px-6 py-4 font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(Number(record.total_cash_needed || 0))}
          </td>
          <td className="px-6 py-4 text-center">
            <StatusBadge status={record.status} map={REQUEST_STATUS_COLORS} />
          </td>
          <td className="px-6 py-4 text-right">
            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
              {record.status === "draft" && (
                <>
                  <button onClick={() => openRequestModal(record)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 transition-colors inline-flex items-center gap-1">
                    <Pencil size={11} /> Edit
                  </button>
                  <button disabled={isActioning} onClick={() => handleRequestAction(record, "submit")} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-blue-700 hover:bg-gray-100 dark:bg-gray-500/10 dark:text-blue-400 transition-colors inline-flex items-center gap-1">
                    {isActioning ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    Submit
                  </button>
                  <button onClick={() => handleRequestDelete(record)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {record.status === "submitted" && (
                <button disabled={isActioning} onClick={() => handleRequestAction(record, "approve")} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors inline-flex items-center gap-1">
                  {isActioning ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  Approve
                </button>
              )}
              {record.status === "approved" && (
                <button disabled={isActioning} onClick={() => handleRequestAction(record, "release")} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors inline-flex items-center gap-1">
                  {isActioning ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                  Release
                </button>
              )}
              {!["released", "cancelled"].includes(record.status) && (
                <button disabled={isActioning} onClick={() => handleRequestAction(record, "cancel")} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-stone-700/60 dark:text-gray-400 transition-colors">
                  Cancel
                </button>
              )}
              <button onClick={() => setExpandedRequest((p) => ({ ...p, [record.id]: !p[record.id] }))} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 transition-colors">
                {isExpanded ? "Hide" : "Details"}
              </button>
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr>
            <td colSpan={7} className={`px-6 py-4 ${isDarkMode ? "bg-stone-900/50" : "bg-stone-50/60"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Cash Need Summary</p>
                  <DataRow label="Payroll (Adjusted Net)"    value={formatCurrency(Number(record.adj_net_payroll           || 0))} />
                  <DataRow label="Petty Cash Replenishment"  value={formatCurrency(Number(record.petty_cash_replenishment  || 0))} />
                  <DataRow label="Canteen"                   value={formatCurrency(Number(record.canteen                   || 0))} />
                  <DataRow label="Monthly Bills"             value={formatCurrency(Number(record.monthly_bills_total       || 0))} />
                  <DataRow label="Additional Reimbursements" value={formatCurrency(computed.reimbs)} />
                  <div className={`mt-2 pt-2 border-t ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                    <DataRow label="TOTAL CASH NEEDED" value={formatCurrency(Number(record.total_cash_needed || 0))} accent="text-rose-500" />
                  </div>
                </div>
                <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Additional Reimbursements</p>
                  {(record.reimbursements || []).length === 0 ? (
                    <p className={`text-xs ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>None recorded.</p>
                  ) : (
                    <div className="space-y-1">
                      {(record.reimbursements || []).map((r, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>{r.label}</span>
                          <span className={`font-mono font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{formatCurrency(Number(r.amount || 0))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {record.remarks && (
                    <p className={`mt-3 text-xs italic ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{record.remarks}</p>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-[1920px] mx-auto pb-10">

      {notice.message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border flex items-center justify-between gap-3 ${
          notice.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
        }`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice({ type: "", message: "" })} className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.title}</p>
                <h3 className={`text-2xl font-bold font-mono ${isDarkMode ? "text-white" : "text-gray-800"}`}>{card.value}</h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">{card.subtitle}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.iconWrap}`}>
                <Icon className={card.iconColor} size={22} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center sticky top-2 z-20">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <ClipboardList size={16} className="text-blue-500" /> Payroll Checking
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end items-center">
          <button onClick={fetchChecking} disabled={loading} className="p-2.5 rounded-xl text-blue-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:text-blue-400 transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          {/* ── Export All button ──────────────────────────────────────────── */}
          <button
            onClick={handleExportAll}
            disabled={!!exportingId || !checkingRecords.length}
            title="Export all records to Excel (one sheet per cutoff)"
            className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${isDarkMode
                ? "bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20"
                : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
              }`}
          >
            {exportingId === "all"
              ? <><Loader2 size={15} className="animate-spin" /> Exporting…</>
              : <><FileSpreadsheet size={15} /> Export All</>
            }
          </button>

          <button onClick={() => openCheckingModal()} className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95">
            <PlusCircle size={16} /> New Checking Record
          </button>
        </div>
      </div>

      {/* Checking Table */}
      {mainTab === "checking" && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto relative min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50/50 dark:bg-stone-900/50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4">Cutoff Date</th>
                  <th className="px-6 py-4">Adjusted Gross Pay</th>
                  <th className="px-6 py-4">Gross Payroll</th>
                  <th className="px-6 py-4">Total Cash Needed</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading records...
                    </td>
                  </tr>
                ) : checkingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-4 bg-stone-50 dark:bg-stone-700 rounded-full mb-4">
                          <ClipboardList size={28} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Checking Records Found</h3>
                        <p className="text-gray-500 text-sm mb-4">Create a new checking record for the current cutoff.</p>
                        <button onClick={() => openCheckingModal()} className="px-5 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium">
                          New Checking Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  checkingRecords.map((record) => <CheckingRow key={record.id} record={record} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollCheckingBulkCreator
        isOpen={showCheckingModal}
        onClose={() => { setShowCheckingModal(false); setEditingChecking(null); }}
        onSubmit={handleCheckingBulkSave}
        editMode={!!editingChecking}
        initialData={editingChecking}
        isDarkMode={isDarkMode}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        onConfirm={(val) => confirmActionRef.current?.(val)}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        showInput={confirmDialog.showInput}
        inputLabel={confirmDialog.inputLabel}
        inputPlaceholder={confirmDialog.inputPlaceholder}
        inputRequired={confirmDialog.inputRequired}
        inputMultiline={confirmDialog.inputMultiline}
      />
    </div>
  );
}