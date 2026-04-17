import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import apiService from "../../../utils/api/api-service";
import {
  AlertCircle,
  Wallet,
  Banknote,
  ShieldCheck,
  TrendingDown,
  FileWarning,
  ArrowUpRight,
  PlusCircle,
  Search,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
  Edit2,
  Trash2,
  History,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ValesBulkCreator from "../components/forms/ValesBulkCreator";
import ValesImportModal from "../components/modals/ValesImportModal";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import { generateValesReport } from "../../../utils/reports/ValesReport";

const STATUS_COLORS = {
  "Fully Paid":
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  Disbursed:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  Pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  Approved:
    "bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-500/10 dark:text-blue-400 dark:border-blue-500/20",
  Defaulted:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  Cancelled:
    "bg-stone-50 text-gray-700 border-gray-200 dark:bg-stone-500/10 dark:text-gray-400 dark:border-gray-500/20",
  Rejected:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
};

const TYPE_META = {
  emergency_vale: {
    label: "Emergency Vales",
    icon: AlertCircle,
    bar: "bg-rose-500",
    iconWrap: "bg-rose-50 dark:bg-rose-500/10",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  regular_cash_advance: {
    label: "Regular Cash Advance",
    icon: Wallet,
    bar: "bg-gray-500",
    iconWrap: "bg-gray-50 dark:bg-gray-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  salary_advance: {
    label: "Salary Advance",
    icon: Banknote,
    bar: "bg-emerald-500",
    iconWrap: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  calamity_loan: {
    label: "Calamity Loan",
    icon: FileWarning,
    bar: "bg-amber-500",
    iconWrap: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
};

function parseProofDocuments(value) {
  if (value == null || value === "") return [];

  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry, index) => {
      if (typeof entry === "string") {
        const text = entry.trim();
        if (!text) return null;
        return { label: `Document ${index + 1}`, reference: text };
      }

      if (!entry || typeof entry !== "object") return null;

      const label = String(entry.label || entry.name || `Document ${index + 1}`).trim();
      const reference = String(entry.reference || entry.url || entry.path || "").trim();
      if (!label && !reference) return null;

      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function ModalShell({ title, onClose, children, isDarkMode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        className={`w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl border shadow-2xl ${isDarkMode ? "bg-stone-950 border-gray-800" : "bg-stone-100 border-gray-200"}`}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`}
        >
          <h3
            className={`font-bold text-xl ${isDarkMode ? "text-white" : "text-gray-900"}`}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDarkMode ? "hover:bg-stone-800 text-gray-300" : "hover:bg-stone-100 text-gray-600"}`}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(92vh-76px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ValesSection({ financeData, formatCurrency }) {
  const { isDarkMode, user } = useAuth();

  const [tableTab, setTableTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [valesData, setValesData] = useState([]);
  const [loadingVales, setLoadingVales] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [expandedBills, setExpandedBills] = useState({});
  const [billHistoryByValeId, setBillHistoryByValeId] = useState({});
  const [billHistoryLoadingByValeId, setBillHistoryLoadingByValeId] = useState(
    {},
  );
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingVale, setEditingVale] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [deletingValeId, setDeletingValeId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkPrefillType, setBulkPrefillType] = useState(
    "regular_cash_advance",
  );
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_source: "manual",
    reference_no: "",
    notes: "",
  });

  const mapValeTypeLabel = (type) => {
    switch (type) {
      case "regular_cash_advance":
        return "Regular Cash Advance";
      case "emergency_vale":
        return "Emergency Vale";
      case "salary_advance":
        return "Salary Advance";
      case "calamity_loan":
        return "Calamity Loan";
      default:
        return "Other";
    }
  };

  const mapValeStatusLabel = (status) => {
    switch ((status || "").toLowerCase()) {
      case "fully_paid":
        return "Fully Paid";
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "released":
      case "active":
        return "Disbursed";
      case "defaulted":
        return "Defaulted";
      case "cancelled":
        return "Cancelled";
      case "rejected":
        return "Rejected";
      default:
        return "Disbursed";
    }
  };

  const fetchVales = useCallback(async () => {
    setLoadingVales(true);
    try {
      const response = await apiService.finance.getVales();
      const rows = (response?.vales || []).map((vale) => {
        const statusRaw = String(vale.status || "").toLowerCase();
        const amount = Number(vale.principal_amount || 0);
        const balance = Number(vale.balance_amount || 0);
        const installmentValue = Number(vale.installment_per_cutoff || 0);

        return {
          id: vale.id,
          valeId: vale.vale_number || `VAL-${vale.id}`,
          employee: vale.employee_name || "Unknown Employee",
          employeeUid: vale.employee_uid,
          employeeIdNumber: vale.employee_id_number || "",
          type: mapValeTypeLabel(vale.vale_type),
          typeRaw: vale.vale_type,
          amount,
          balance,
          installmentValue,
          disbursementDate: vale.disbursement_date
            ? new Date(vale.disbursement_date).toLocaleDateString("en-PH", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })
            : "-",
          installments: `${formatCurrency(installmentValue)} / cut-off`,
          status: mapValeStatusLabel(statusRaw),
          statusRaw,
          employee_uid: vale.employee_uid,
          employee_id_number: vale.employee_id_number || "",
          vale_type: vale.vale_type,
          principal_amount: amount,
          installment_per_cutoff: installmentValue,
          disbursement_date: vale.disbursement_date || "",
          first_deduction_date: vale.first_deduction_date || "",
          terms_cutoffs: vale.terms_cutoffs || "",
          remarks: vale.remarks || "",
          proof_documents_json: vale.proof_documents_json || null,
        };
      });

      setValesData(rows);
    } catch (error) {
      console.error("Failed to fetch vales:", error);
      setValesData([]);
      setNotice({ type: "error", message: "Failed to load vales." });
    } finally {
      setLoadingVales(false);
    }
  }, [formatCurrency]);

  useEffect(() => {
    fetchVales();
  }, [fetchVales]);

  const filteredTableData = useMemo(
    () =>
      valesData
        .filter((row) => {
          if (tableTab === "active")
            return !["fully_paid", "cancelled", "rejected"].includes(
              row.statusRaw,
            );
          if (tableTab === "completed") return row.statusRaw === "fully_paid";
          return true;
        })
        .filter((row) => {
          if (!searchTerm.trim()) return true;
          const q = searchTerm.toLowerCase();
          return (
            row.valeId.toLowerCase().includes(q) ||
            row.employee.toLowerCase().includes(q) ||
            row.type.toLowerCase().includes(q) ||
            String(row.employeeIdNumber || "")
              .toLowerCase()
              .includes(q)
          );
        }),
    [valesData, tableTab, searchTerm],
  );

  const typeBreakdown = useMemo(() => {
    const total = valesData.reduce((sum, row) => sum + row.amount, 0);
    const aggregate = {
      emergency_vale: 0,
      regular_cash_advance: 0,
      salary_advance: 0,
      calamity_loan: 0,
    };

    valesData.forEach((row) => {
      const key = row.typeRaw;
      if (aggregate[key] !== undefined) aggregate[key] += row.amount;
    });

    return Object.entries(TYPE_META).map(([key, meta]) => {
      const value = aggregate[key] || 0;
      const percent = total > 0 ? Math.round((value / total) * 100) : 0;
      return { key, ...meta, value, percent };
    });
  }, [valesData]);

  const valeMetrics = useMemo(() => {
    const terminalStatuses = new Set(["fully_paid", "cancelled", "rejected"]);

    return valesData.reduce(
      (acc, row) => {
        const status = String(row.statusRaw || "").toLowerCase();
        const balance = Number(row.balance || 0);

        if (status === "pending") acc.pending += 1;
        if (status === "approved") acc.approved += 1;
        if (status === "defaulted") acc.defaulted += 1;

        if (!terminalStatuses.has(status) && balance > 0) {
          acc.active += 1;
          acc.totalOutstanding += balance;
        }

        return acc;
      },
      {
        pending: 0,
        approved: 0,
        active: 0,
        defaulted: 0,
        totalOutstanding: 0,
      },
    );
  }, [valesData]);

  const activeCount = valeMetrics.active;
  const defaultedCount = valeMetrics.defaulted;
  const outstandingAmount = valeMetrics.totalOutstanding;
  const violationRate =
    activeCount > 0 ? Math.round((defaultedCount / activeCount) * 100) : 0;

  const summaryCards = [
    {
      title: "Total Outstanding",
      value: formatCurrency(outstandingAmount),
      subtitle: `${activeCount} active vales`,
      icon: Wallet,
      iconWrap: "bg-rose-500/10",
      iconColor: "text-rose-500",
    },
    {
      title: "Pending Approval",
      value: String(valeMetrics.pending),
      subtitle: `${valeMetrics.approved} approved`,
      icon: AlertCircle,
      iconWrap: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
    {
      title: "Collections Health",
      value: `${violationRate}%`,
      subtitle: `${defaultedCount} defaulted cases`,
      icon: ShieldCheck,
      iconWrap: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
    },
  ];

  const openPaymentModal = (row) => {
    setPaymentTarget(row);
    setPaymentForm((prev) => ({
      ...prev,
      amount: row.installmentValue > 0 ? String(row.installmentValue) : "",
    }));
    setShowPaymentModal(true);
  };

  const handleBulkCreateVales = async (payload) => {
    setBulkSubmitting(true);
    setNotice({ type: "", message: "" });

    try {
      const entries = Array.isArray(payload) ? payload : [payload];
      await Promise.all(
        entries.map((vale) =>
          apiService.finance.createVale({
            ...vale,
            status: vale.status || "pending",
            created_by: user?.id || null,
            requested_by: user?.id || null,
          }),
        ),
      );

      setShowBulkModal(false);
      setNotice({
        type: "success",
        message: `${entries.length} vale(s) created successfully.`,
      });
      await fetchVales();
    } catch (error) {
      console.error("Bulk create vales failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to bulk create vales.",
      });
      throw error;
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openEditModal = (row) => {
    setEditingVale(row);
    setShowEditModal(true);
  };

  const handleEditVale = async (payload) => {
    if (!editingVale?.id) return;
    setBulkSubmitting(true);
    setNotice({ type: "", message: "" });

    try {
      await apiService.finance.updateVale(editingVale.id, {
        ...payload,
        updated_by: user?.id || null,
      });

      setShowEditModal(false);
      setEditingVale(null);
      setNotice({ type: "success", message: "Vale updated successfully." });
      await fetchVales();
    } catch (error) {
      console.error("Edit vale failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to update vale.",
      });
      throw error;
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleImportVales = async (valesToImport) => {
    setBulkSubmitting(true);
    setNotice({ type: "", message: "" });

    try {
      await Promise.all(
        (valesToImport || []).map((vale) =>
          apiService.finance.createVale({
            ...vale,
            status: vale.status || "pending",
            created_by: user?.id || null,
            requested_by: user?.id || null,
          }),
        ),
      );

      setNotice({
        type: "success",
        message: `Import completed: ${(valesToImport || []).length} vale(s) created.`,
      });
      await fetchVales();
    } catch (error) {
      console.error("Import vales failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to import vales.",
      });
      throw error;
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleExportReport = async () => {
    try {
      if (valesData.length === 0) {
        setNotice({ type: "error", message: "No vales available to export." });
        return;
      }
      const ordered = [...valesData].sort(
        (a, b) =>
          new Date(a.disbursement_date || 0).getTime() -
          new Date(b.disbursement_date || 0).getTime(),
      );
      const start = ordered[0]?.disbursement_date;
      const end = ordered[ordered.length - 1]?.disbursement_date;
      await generateValesReport(valesData, { start, end });
      setNotice({
        type: "success",
        message: "Vales report generated successfully.",
      });
    } catch (error) {
      console.error("Export vales report failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to generate vales report.",
      });
    }
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!paymentTarget) return;

    setRecordingPayment(true);
    setNotice({ type: "", message: "" });

    try {
      await apiService.finance.recordValePayment(paymentTarget.id, {
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_source: paymentForm.payment_source,
        reference_no: paymentForm.reference_no || null,
        notes: paymentForm.notes || null,
        created_by: user?.id || null,
      });

      setShowPaymentModal(false);
      setPaymentTarget(null);
      setPaymentForm({
        amount: "",
        payment_date: new Date().toISOString().slice(0, 10),
        payment_source: "manual",
        reference_no: "",
        notes: "",
      });
      setNotice({ type: "success", message: "Payment recorded successfully." });
      await fetchVales();
    } catch (error) {
      console.error("Record payment failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to record payment.",
      });
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDeleteVale = (row) => {
    if (!row?.id) return;
    if (String(row.statusRaw || "").toLowerCase() !== "fully_paid") {
      setNotice({
        type: "error",
        message: "Only completed cash advance records can be deleted.",
      });
      return;
    }

    setDeleteTarget(row);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteVale = async () => {
    const row = deleteTarget;
    if (!row?.id) return;

    setDeletingValeId(row.id);
    setNotice({ type: "", message: "" });

    try {
      await apiService.finance.deleteVale(row.id);
      setValesData((prev) => prev.filter((item) => item.id !== row.id));
      setNotice({
        type: "success",
        message: "Completed cash advance record deleted.",
      });
    } catch (error) {
      console.error("Delete vale failed:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to delete completed record.",
      });
    } finally {
      setDeletingValeId(null);
    }
  };

  const openHistoryModal = async (row) => {
    setHistoryTarget(row);
    setPaymentHistory([]);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const response = await apiService.finance.getVale(row.id);
      const payments = Array.isArray(response?.vale?.payments)
        ? response.vale.payments
        : [];
      setPaymentHistory(payments);
    } catch (error) {
      console.error("Failed to load vale payment history:", error);
      setPaymentHistory([]);
      setNotice({
        type: "error",
        message: error?.message || "Failed to load payment history.",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBillHistory = useCallback(
    async (valeId) => {
      if (!valeId) return;
      if (billHistoryByValeId[valeId]) return;

      setBillHistoryLoadingByValeId((prev) => ({ ...prev, [valeId]: true }));
      try {
        const response = await apiService.finance.getVale(valeId);
        const payments = Array.isArray(response?.vale?.payments)
          ? response.vale.payments
          : [];
        setBillHistoryByValeId((prev) => ({ ...prev, [valeId]: payments }));
      } catch (error) {
        console.error("Failed to load bill payment history:", error);
        setBillHistoryByValeId((prev) => ({ ...prev, [valeId]: [] }));
        setNotice({
          type: "error",
          message: error?.message || "Failed to load payment history.",
        });
      } finally {
        setBillHistoryLoadingByValeId((prev) => ({ ...prev, [valeId]: false }));
      }
    },
    [billHistoryByValeId],
  );

  const toggleEmployeeExpand = (employeeKey) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [employeeKey]: !prev[employeeKey],
    }));
  };

  const toggleBillExpand = async (valeId) => {
    const nextExpanded = !expandedBills[valeId];
    setExpandedBills((prev) => ({ ...prev, [valeId]: nextExpanded }));

    if (nextExpanded) {
      await loadBillHistory(valeId);
    }
  };

  const employeeStatements = useMemo(() => {
    const grouped = new Map();

    filteredTableData.forEach((row) => {
      const key = `emp-${row.employeeUid || row.employeeIdNumber || row.employee}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          employeeKey: key,
          employee: row.employee,
          employeeUid: row.employeeUid,
          employeeIdNumber: row.employeeIdNumber || "-",
          totalPrincipal: 0,
          totalBalance: 0,
          activeBills: 0,
          latestDisbursement: null,
          bills: [],
        });
      }

      const entry = grouped.get(key);
      entry.totalPrincipal += Number(row.amount || 0);
      entry.totalBalance += Number(row.balance || 0);
      if (
        Number(row.balance || 0) > 0 &&
        !["cancelled", "rejected", "fully_paid"].includes(
          String(row.statusRaw || "").toLowerCase(),
        )
      ) {
        entry.activeBills += 1;
      }

      const rowTime = row.disbursement_date
        ? new Date(row.disbursement_date).getTime()
        : 0;
      const latestTime = entry.latestDisbursement
        ? new Date(entry.latestDisbursement).getTime()
        : 0;
      if (!entry.latestDisbursement || rowTime > latestTime) {
        entry.latestDisbursement = row.disbursement_date;
      }

      entry.bills.push(row);
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        bills: [...entry.bills].sort(
          (a, b) =>
            new Date(b.disbursement_date || 0).getTime() -
            new Date(a.disbursement_date || 0).getTime(),
        ),
      }))
      .sort(
        (a, b) =>
          new Date(b.latestDisbursement || 0).getTime() -
          new Date(a.latestDisbursement || 0).getTime(),
      );
  }, [filteredTableData]);

  const sectionClass = `rounded-xl border p-4 ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`;
  const labelClass = `block text-xs font-semibold mb-1.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`;
  const inputClass = `w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all ${
    isDarkMode
      ? "bg-stone-950 border-gray-700 text-gray-100 focus:border-blue-500"
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
  }`;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-[1920px] mx-auto pb-10">
      {notice.message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium border ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between"
            >
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {card.title}
                </p>
                <h3
                  className={`text-2xl font-bold font-mono ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  {card.value}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  {card.subtitle}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.iconWrap}`}>
                <Icon className={card.iconColor} size={22} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center sticky top-2 z-20">
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:min-w-[300px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search employees or vale #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex p-1 space-x-1 bg-stone-100 dark:bg-stone-900/50 rounded-lg max-w-fit">
            <button
              onClick={() => setTableTab("active")}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${tableTab === "active" ? "bg-white dark:bg-stone-800 text-rose-600 dark:text-rose-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <AlertCircle size={16} /> Active Vales
            </button>
            <button
              onClick={() => setTableTab("completed")}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${tableTab === "completed" ? "bg-white dark:bg-stone-800 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <CheckCircle2 size={16} /> Completed
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end items-center">
          <button
            onClick={fetchVales}
            className="p-2.5 rounded-xl text-blue-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:text-blue-400 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={18} />
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="p-2.5 rounded-xl text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
            title="Import Excel"
          >
            <Upload size={18} />
          </button>

          <button
            onClick={handleExportReport}
            className="p-2.5 rounded-xl text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors"
            title="Export Report"
          >
            <Download size={18} />
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-colors inline-flex items-center gap-2"
            disabled={bulkSubmitting}
          >
            <PlusCircle size={16} /> Bulk Creator
          </button>

          <button
            onClick={() => {
              setBulkPrefillType("emergency_vale");
              setShowBulkModal(true);
            }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 transition-colors inline-flex items-center gap-2"
          >
            <AlertCircle size={16} /> Emergency
          </button>

          <button
            onClick={() => {
              setBulkPrefillType("regular_cash_advance");
              setShowBulkModal(true);
            }}
            className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95"
          >
            <PlusCircle size={16} /> New Vale
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto relative min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50/50 dark:bg-stone-900/50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4">Employee Statement</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Latest CA</th>
                <th className="px-6 py-4 text-right">Total CA</th>
                <th className="px-6 py-4 text-right">Outstanding</th>
                <th className="px-6 py-4 text-center">Open Bills</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loadingVales ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Loading vales...
                  </td>
                </tr>
              ) : employeeStatements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-stone-50 dark:bg-stone-700 rounded-full mb-4">
                        <Wallet size={28} className="text-gray-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        No Employee Statements Found
                      </h3>
                      <p className="text-gray-500 text-sm mb-4">
                        Try adjusting your filters or create a new cash advance.
                      </p>
                      <button
                        onClick={() => {
                          setBulkPrefillType("regular_cash_advance");
                          setShowBulkModal(true);
                        }}
                        className="px-5 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium"
                      >
                        Create Vale
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                employeeStatements.map((statement) => {
                  const isExpanded = !!expandedEmployees[statement.employeeKey];
                  const latestDisbursementLabel = statement.latestDisbursement
                    ? new Date(statement.latestDisbursement).toLocaleDateString(
                        "en-PH",
                        {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        },
                      )
                    : "-";

                  const nextPayableBill = statement.bills.find(
                    (bill) =>
                      ["active", "released", "approved", "pending"].includes(
                        bill.statusRaw,
                      ) && bill.balance > 0,
                  );

                  return (
                    <React.Fragment key={statement.employeeKey}>
                      <tr className="group hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              toggleEmployeeExpand(statement.employeeKey)
                            }
                            className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            <span>Statement</span>
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            {statement.bills.length} cash advance bill(s)
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${tableTab === "active" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"}`}
                            >
                              {statement.employee.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                                {statement.employee}
                              </p>
                              <p className="text-xs text-gray-500">
                                ID#: {statement.employeeIdNumber || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {latestDisbursementLabel}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-mono font-bold text-gray-900 dark:text-white">
                            {formatCurrency(statement.totalPrincipal)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(statement.totalBalance)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-500/10 dark:text-blue-400 dark:border-blue-500/20">
                            {statement.activeBills}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                toggleEmployeeExpand(statement.employeeKey)
                              }
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 dark:hover:bg-stone-700 transition-colors"
                            >
                              {isExpanded ? "Hide Bills" : "View Bills"}
                            </button>
                            <button
                              disabled={!nextPayableBill}
                              onClick={() =>
                                nextPayableBill &&
                                openPaymentModal(nextPayableBill)
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                nextPayableBill
                                  ? "bg-gray-600 hover:bg-gray-700 text-white"
                                  : "bg-stone-200 text-gray-500 dark:bg-stone-700 dark:text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              Record Payment
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-4 bg-stone-50/50 dark:bg-stone-900/30"
                          >
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-stone-100/70 dark:bg-stone-800/70 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                  <tr>
                                    <th className="px-4 py-3">Bill / CA #</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Disbursement</th>
                                    <th className="px-4 py-3 text-right">
                                      Principal
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                      Balance
                                    </th>
                                    <th className="px-4 py-3 text-center">
                                      Status
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                      Action
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {statement.bills.map((bill) => {
                                    const statusClass =
                                      STATUS_COLORS[bill.status] ||
                                      STATUS_COLORS.Cancelled;
                                    const canPay =
                                      [
                                        "active",
                                        "released",
                                        "approved",
                                        "pending",
                                      ].includes(bill.statusRaw) &&
                                      bill.balance > 0;
                                    const isBillExpanded =
                                      !!expandedBills[bill.id];
                                    const billHistory =
                                      billHistoryByValeId[bill.id] || [];
                                    const billHistoryLoading =
                                      !!billHistoryLoadingByValeId[bill.id];
                                    const proofDocuments = parseProofDocuments(
                                      bill.proof_documents_json,
                                    );

                                    return (
                                      <React.Fragment key={bill.id}>
                                        <tr className="hover:bg-white/70 dark:hover:bg-stone-800/40 transition-colors">
                                          <td className="px-4 py-3">
                                            <button
                                              onClick={() =>
                                                toggleBillExpand(bill.id)
                                              }
                                              className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white font-mono"
                                            >
                                              {isBillExpanded ? (
                                                <ChevronDown size={14} />
                                              ) : (
                                                <ChevronRight size={14} />
                                              )}
                                              {bill.valeId}
                                            </button>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                            {bill.type}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                            {bill.disbursementDate}
                                          </td>
                                          <td className="px-4 py-3 text-right text-sm font-mono font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(bill.amount)}
                                          </td>
                                          <td className="px-4 py-3 text-right text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                                            {formatCurrency(bill.balance)}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span
                                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusClass}`}
                                            >
                                              {bill.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                              <button
                                                onClick={() =>
                                                  toggleBillExpand(bill.id)
                                                }
                                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-gray-700 hover:bg-stone-200 dark:bg-stone-700/60 dark:text-gray-300 dark:hover:bg-stone-700 transition-colors"
                                              >
                                                History
                                              </button>
                                              <button
                                                onClick={() =>
                                                  openEditModal(bill)
                                                }
                                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors inline-flex items-center gap-1"
                                              >
                                                <Edit2 size={12} /> Edit
                                              </button>
                                              {tableTab === "completed" &&
                                                String(
                                                  bill.statusRaw || "",
                                                ).toLowerCase() ===
                                                  "fully_paid" && (
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteVale(bill)
                                                    }
                                                    disabled={
                                                      deletingValeId === bill.id
                                                    }
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
                                                      deletingValeId === bill.id
                                                        ? "bg-stone-200 text-gray-500 dark:bg-stone-700 dark:text-gray-400 cursor-not-allowed"
                                                        : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                                                    }`}
                                                  >
                                                    <Trash2 size={12} />
                                                    {deletingValeId === bill.id
                                                      ? "Deleting..."
                                                      : "Delete"}
                                                  </button>
                                                )}
                                              <button
                                                disabled={!canPay}
                                                onClick={() =>
                                                  openPaymentModal(bill)
                                                }
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                  canPay
                                                    ? "bg-gray-600 hover:bg-gray-700 text-white"
                                                    : "bg-stone-200 text-gray-500 dark:bg-stone-700 dark:text-gray-400 cursor-not-allowed"
                                                }`}
                                              >
                                                Record Payment
                                              </button>
                                            </div>
                                          </td>
                                        </tr>

                                        {isBillExpanded && (
                                          <tr>
                                            <td
                                              colSpan={7}
                                              className="px-4 py-3 bg-stone-50 dark:bg-stone-900/40"
                                            >
                                              <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-stone-900/50 p-3">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                                  Proof Documents
                                                </p>
                                                {proofDocuments.length === 0 ? (
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    No proof documents attached.
                                                  </p>
                                                ) : (
                                                  <ul className="space-y-2">
                                                    {proofDocuments.map((doc, docIndex) => {
                                                      const isUrl = /^https?:\/\//i.test(
                                                        doc.reference,
                                                      );
                                                      return (
                                                        <li
                                                          key={`${doc.label}-${docIndex}`}
                                                          className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-stone-50 dark:bg-stone-950"
                                                        >
                                                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                                            {doc.label}
                                                          </p>
                                                          {isUrl ? (
                                                            <a
                                                              href={doc.reference}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="text-xs break-all underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                                            >
                                                              {doc.reference}
                                                            </a>
                                                          ) : (
                                                            <p className="text-xs break-all text-gray-600 dark:text-gray-300">
                                                              {doc.reference}
                                                            </p>
                                                          )}
                                                        </li>
                                                      );
                                                    })}
                                                  </ul>
                                                )}
                                              </div>

                                              {billHistoryLoading ? (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                  Loading payment history...
                                                </div>
                                              ) : billHistory.length === 0 ? (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                  No payment records yet for
                                                  this bill.
                                                </div>
                                              ) : (
                                                <div className="space-y-2">
                                                  {billHistory.map(
                                                    (payment) => (
                                                      <div
                                                        key={payment.id}
                                                        className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                                                          isDarkMode
                                                            ? "bg-stone-950 border-gray-800"
                                                            : "bg-white border-gray-200"
                                                        }`}
                                                      >
                                                        <div>
                                                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            {payment.payment_date
                                                              ? new Date(
                                                                  payment.payment_date,
                                                                ).toLocaleDateString(
                                                                  "en-PH",
                                                                  {
                                                                    month:
                                                                      "short",
                                                                    day: "2-digit",
                                                                    year: "numeric",
                                                                  },
                                                                )
                                                              : "-"}
                                                          </p>
                                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Source:{" "}
                                                            {String(
                                                              payment.payment_source ||
                                                                "manual",
                                                            ).replace(
                                                              /_/g,
                                                              " ",
                                                            )}
                                                            {payment.reference_no
                                                              ? ` • Ref: ${payment.reference_no}`
                                                              : ""}
                                                          </p>
                                                          {payment.notes ? (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                              {payment.notes}
                                                            </p>
                                                          ) : null}
                                                        </div>
                                                        <p className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                                                          {formatCurrency(
                                                            Number(
                                                              payment.amount ||
                                                                0,
                                                            ),
                                                          )}
                                                        </p>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Vales by Type
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {typeBreakdown.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="group relative overflow-hidden flex justify-between items-center p-4 bg-white dark:bg-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-all rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm"
                >
                  <div
                    className={`absolute left-0 bottom-0 h-1 ${item.bar} opacity-80 rounded-r-full transition-all`}
                    style={{ width: `${Math.max(item.percent, 2)}%` }}
                  />
                  <div className="flex items-center gap-4 relative z-10">
                    <div
                      className={`p-2.5 rounded-xl ${item.iconWrap} ${item.iconColor}`}
                    >
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {item.label}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.percent}% of total vales
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white text-lg relative z-10">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-full">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              DOLE Compliance & Collections
            </h3>
          </div>
          <div className="p-6 space-y-4 flex flex-col flex-1">
            <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl border border-emerald-400/30 relative overflow-hidden shadow-lg shadow-emerald-500/20 text-white flex-1 min-h-[160px]">
              <div className="absolute -top-6 -right-6 p-4 opacity-20 transform rotate-12">
                <ShieldCheck size={140} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-emerald-50 mb-3">
                  <ShieldCheck size={20} />
                  <p className="text-sm font-semibold tracking-wider opacity-90">
                    COMPLIANCE RISK
                  </p>
                </div>
                <div className="flex items-end gap-3 mb-2">
                  <p className="text-5xl font-black tracking-tight">
                    {violationRate}%
                  </p>
                  <p className="text-sm font-medium opacity-80 pb-1">At-risk</p>
                </div>
                <p className="text-sm font-medium opacity-90 leading-relaxed max-w-[85%]">
                  Derived from{" "}
                  <span className="font-bold text-white">
                    defaulted vs active
                  </span>{" "}
                  vales. Link payroll-net-pay rules next for strict DOLE
                  validation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-auto">
              <div className="p-4 bg-white dark:bg-stone-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 transition-colors shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Collectibles
                  </p>
                  <div className="p-1.5 bg-stone-50 dark:bg-stone-700 rounded-md">
                    <TrendingDown
                      className="text-gray-500 dark:text-gray-400"
                      size={14}
                    />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(outstandingAmount)}
                </p>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                  From {activeCount} active vales
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-stone-800/50 rounded-xl border border-rose-100 dark:border-rose-900/30 hover:border-rose-200 transition-colors shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-rose-500 dark:text-rose-400">
                    Defaulted
                  </p>
                  <div className="p-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-md">
                    <AlertCircle
                      className="text-rose-500 dark:text-rose-400"
                      size={14}
                    />
                  </div>
                </div>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
                  {defaultedCount}
                </p>
                <p className="text-xs font-medium text-rose-500/70 dark:text-rose-400/70 mt-1 flex items-center gap-1">
                  <ArrowUpRight size={12} /> Needs follow-up
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && paymentTarget && (
        <ModalShell
          title={`Record Payment • ${paymentTarget.valeId}`}
          onClose={() => setShowPaymentModal(false)}
          isDarkMode={isDarkMode}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div
              className={`${sectionClass} flex items-center justify-between`}
            >
              <div>
                <p className={labelClass}>Remaining Balance</p>
                <p className="mt-1 font-bold text-2xl text-rose-600 dark:text-rose-400 font-mono">
                  {formatCurrency(paymentTarget.balance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {paymentTarget.employee}
                </p>
              </div>
            </div>

            <div className={sectionClass}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Payment Amount *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    max={paymentTarget.balance}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Payment Date *</label>
                  <input
                    required
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        payment_date: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Source</label>
                  <select
                    value={paymentForm.payment_source}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        payment_source: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="manual">Manual</option>
                    <option value="payroll">Payroll</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Reference No.</label>
                  <input
                    type="text"
                    value={paymentForm.reference_no}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        reference_no: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <label className={labelClass}>Notes</label>
              <textarea
                rows={3}
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className={`px-4 py-2 rounded-lg border font-medium ${isDarkMode ? "border-gray-700 text-gray-300 hover:bg-stone-800" : "border-gray-300 text-gray-700 hover:bg-stone-100"}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {recordingPayment && (
                  <Loader2 size={14} className="animate-spin" />
                )}{" "}
                Save Payment
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showHistoryModal && historyTarget && (
        <ModalShell
          title={`Payment History • ${historyTarget.valeId}`}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryTarget(null);
            setPaymentHistory([]);
          }}
          isDarkMode={isDarkMode}
        >
          <div className="space-y-4">
            {(() => {
              const proofDocuments = parseProofDocuments(
                historyTarget.proof_documents_json,
              );
              return (
                <div className={sectionClass}>
                  <p className={labelClass}>Proof Documents</p>
                  {proofDocuments.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No proof documents attached.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {proofDocuments.map((doc, index) => {
                        const isUrl = /^https?:\/\//i.test(doc.reference);
                        return (
                          <li
                            key={`${doc.label}-${index}`}
                            className={`rounded-lg border px-3 py-2 ${
                              isDarkMode
                                ? "bg-stone-950 border-gray-800"
                                : "bg-stone-50 border-gray-200"
                            }`}
                          >
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">
                              {doc.label}
                            </p>
                            {isUrl ? (
                              <a
                                href={doc.reference}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs break-all underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                {doc.reference}
                              </a>
                            ) : (
                              <p className="text-xs break-all text-gray-600 dark:text-gray-300">
                                {doc.reference}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}

            <div
              className={`${sectionClass} flex items-center justify-between`}
            >
              <div>
                <p className={labelClass}>Employee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {historyTarget.employee}
                </p>
              </div>
              <div className="text-right">
                <p className={labelClass}>Current Balance</p>
                <p className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                  {formatCurrency(historyTarget.balance)}
                </p>
              </div>
            </div>

            <div className={sectionClass}>
              {historyLoading ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading payment history...
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No payment records yet for this vale.
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                        isDarkMode
                          ? "bg-stone-950 border-gray-800"
                          : "bg-stone-50 border-gray-200"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {payment.payment_date
                            ? new Date(payment.payment_date).toLocaleDateString(
                                "en-PH",
                                {
                                  month: "short",
                                  day: "2-digit",
                                  year: "numeric",
                                },
                              )
                            : "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Source:{" "}
                          {String(payment.payment_source || "manual").replace(
                            /_/g,
                            " ",
                          )}
                          {payment.reference_no
                            ? ` • Ref: ${payment.reference_no}`
                            : ""}
                        </p>
                        {payment.notes ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {payment.notes}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(Number(payment.amount || 0))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      <ValesBulkCreator
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSubmit={handleBulkCreateVales}
        isDarkMode={isDarkMode}
        defaultValeType={bulkPrefillType}
      />

      <ValesBulkCreator
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingVale(null);
        }}
        onSubmit={handleEditVale}
        isDarkMode={isDarkMode}
        editMode={true}
        initialData={editingVale}
      />

      <ValesImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportVales}
        isDarkMode={isDarkMode}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteVale}
        title="Delete Completed Record"
        message={
          deleteTarget
            ? `Delete completed cash advance record ${deleteTarget.valeId}? This action cannot be undone.`
            : "Delete this record? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
