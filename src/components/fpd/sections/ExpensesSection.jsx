import React, { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Eye,
  X,
  Search,
  Download,
  Calendar,
  FileText,
  TrendingDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  Wallet,
  Filter,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Info,
  ToggleLeft,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { ToastContainer } from "../components/main_ui/Toast";
import apiService from "../../../utils/api/api-service";
import { generateExpensesReport } from "../../../utils/reports/ExpensesReport";

import ExpensesBulkCreator from "../components/forms/ExpensesBulkCreator";
import ExpensesEditModal from "../components/forms/ExpensesEditModal";

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  `₱${parseFloat(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getVoucherSourceType = (voucherNumber) => {
  if (typeof voucherNumber !== "string") return null;
  if (voucherNumber.startsWith("PCV-")) return "petty_cash";
  if (voucherNumber.startsWith("CHK-")) return "check";
  return null;
};

const parseProofDocuments = (value) => {
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
};

const MONTH_OPTIONS = [
  { value: "all", label: "All Months" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const QUARTER_OPTIONS = [
  { value: "all", label: "All Quarters (Default: Current Quarter)" },
  { value: "q1", label: "Q1 (Jan - Mar)" },
  { value: "q2", label: "Q2 (Apr - Jun)" },
  { value: "q3", label: "Q3 (Jul - Sep)" },
  { value: "q4", label: "Q4 (Oct - Dec)" },
];

const getYearOptions = () => {
  const cur = new Date().getFullYear();
  const years = [{ value: "all", label: "All Years" }];
  for (let y = cur; y >= cur - 5; y--)
    years.push({ value: y, label: String(y) });
  return years;
};

// ─────────────────────────────────────────────────────────────
//  SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────
function SortIndicator({ field, sortField, sortDirection }) {
  if (sortField !== field)
    return <ArrowUpDown size={13} className="opacity-30 ml-1" />;
  return sortDirection === "asc" ? (
    <ArrowUp size={13} className="text-blue-600 ml-1" />
  ) : (
    <ArrowDown size={13} className="text-blue-600 ml-1" />
  );
}

/**
 * Voucher source badge — shown when an expense originated from a voucher.
 * Clicking it navigates to that voucher (calls onNavigate).
 */
function VoucherSourceBadge({ voucherNumber, onNavigate, isDarkMode }) {
  if (!voucherNumber) return null;
  return (
    <button
      onClick={() => onNavigate && onNavigate(voucherNumber)}
      title={`View source voucher: ${voucherNumber}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors ${
        isDarkMode
          ? "bg-indigo-900/30 text-indigo-300 border-indigo-700 hover:bg-indigo-800/50 hover:text-indigo-200"
          : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
      }`}
    >
      <ExternalLink size={10} />
      {voucherNumber}
    </button>
  );
}

/**
 * Delete confirmation modal — aware of whether the expense came from a voucher.
 * For voucher-sourced expenses it shows a softer warning about toggling visibility.
 */
function DeleteConfirmModal({
  expense,
  isDarkMode,
  onConfirm,
  onCancel,
  isDeleting,
}) {
  if (!expense) return null;

  const sourceType = getVoucherSourceType(expense.voucherNumber);
  const fromVoucher = !!sourceType;
  const sourceLabel = sourceType === "check" ? "check voucher" : "petty cash voucher";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
          isDarkMode ? "bg-stone-900 text-white" : "bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className={`p-3 rounded-full shrink-0 ${
              fromVoucher
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            }`}
          >
            {fromVoucher ? (
              <ToggleLeft size={24} />
            ) : (
              <AlertTriangle size={24} />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg">
              {fromVoucher ? "Remove from Expenses?" : "Delete Expense?"}
            </h3>
            <p
              className={`text-sm mt-0.5 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {fromVoucher
                ? `This expense came from a ${sourceLabel}. It will be hidden from expenses but the voucher line item will remain.`
                : "This action cannot be undone."}
            </p>
          </div>
        </div>

        {fromVoucher && (
          <div
            className={`rounded-xl p-3 mb-4 border flex items-start gap-2 text-xs ${
              isDarkMode
                ? "bg-indigo-900/20 border-indigo-700 text-indigo-300"
                : "bg-indigo-50 border-indigo-200 text-indigo-700"
            }`}
          >
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Source voucher:{" "}
              <span className="font-mono font-bold">
                {expense.voucherNumber}
              </span>
              . To permanently remove this line, edit the source voucher
              directly.
            </span>
          </div>
        )}

        <div
          className={`rounded-xl p-4 mb-5 border text-sm space-y-1 ${
            isDarkMode
              ? "bg-stone-800 border-gray-700 text-gray-300"
              : "bg-stone-50 border-gray-200 text-gray-700"
          }`}
        >
          <p>
            <span className="font-semibold">Date:</span>{" "}
            {formatDate(expense.date)}
          </p>
          <p className="truncate">
            <span className="font-semibold">Particulars:</span>{" "}
            {expense.particulars}
          </p>
          <p>
            <span className="font-semibold">Amount:</span>{" "}
            <span
              className={`font-mono font-bold ${
                fromVoucher
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(expense.totalAmount)}
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
              isDarkMode
                ? "bg-stone-800 hover:bg-stone-700 text-white"
                : "bg-white border border-gray-300 hover:bg-stone-50 text-gray-700"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`px-5 py-2.5 text-white rounded-xl font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all ${
              fromVoucher
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {fromVoucher ? "Hiding…" : "Deleting…"}
              </>
            ) : fromVoucher ? (
              <>
                <ToggleLeft size={15} />
                Hide from Expenses
              </>
            ) : (
              <>
                <Trash2 size={15} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseViewModal({
  expense,
  isDarkMode,
  onClose,
  onNavigateToVoucher,
}) {
  if (!expense) return null;

  const proofDocuments = parseProofDocuments(expense.proof_documents_json);
  const canNavigateToVoucher =
    !!expense.isVoucherExpense &&
    !!expense.voucherNumber &&
    typeof onNavigateToVoucher === "function";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col ${
          isDarkMode ? "bg-stone-900 text-white" : "bg-white text-gray-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "border-gray-700 bg-stone-800" : "border-gray-200 bg-stone-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isDarkMode
                  ? "bg-gray-900/30 text-blue-400"
                  : "bg-gray-100 text-blue-600"
              }`}
            >
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Expense Details</h3>
              <p className="text-xs text-gray-500">Read-only preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode
                ? "hover:bg-stone-700 text-gray-400"
                : "hover:bg-stone-200 text-gray-500"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Date</p>
              <p className="text-sm font-semibold">{formatDate(expense.date)}</p>
            </div>

            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Source</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{expense.voucherType || "Direct Expense"}</p>
                {canNavigateToVoucher && (
                  <button
                    onClick={() => onNavigateToVoucher(expense.voucherNumber)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                      isDarkMode
                        ? "bg-indigo-900/30 border-indigo-700 text-indigo-300 hover:bg-indigo-800/40"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    {expense.voucherNumber}
                  </button>
                )}
              </div>
            </div>

            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Classification</p>
              <p className="text-sm font-semibold">{expense.accountClassification || "N/A"}</p>
            </div>

            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Company / Payee</p>
              <p className="text-sm font-semibold">{expense.companySupplier || "N/A"}</p>
            </div>

            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Address</p>
              <p className="text-sm">{expense.address || "N/A"}</p>
            </div>

            <div className={`rounded-xl p-4 ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">T.I.N / O.R.-C.I.-S.I.</p>
              <p className="text-sm font-mono">{expense.tin || "N/A"} {expense.orCiSi ? `| ${expense.orCiSi}` : ""}</p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-stone-800/30 border-gray-700" : "bg-stone-50 border-gray-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Particulars</p>
            <p className="text-sm">{expense.particulars || "N/A"}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-blue-900/10 border-blue-800" : "bg-blue-50 border-blue-200"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">VAT Amount</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(expense.vatAmount)}</p>
            </div>
            <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-purple-900/10 border-purple-800" : "bg-purple-50 border-purple-200"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">Non-VAT Amount</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(expense.nonVatAmount)}</p>
            </div>
            <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-emerald-900/10 border-emerald-800" : "bg-emerald-50 border-emerald-200"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Total Amount</p>
              <p className="text-sm font-bold font-mono">{formatCurrency(expense.totalAmount)}</p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${isDarkMode ? "bg-stone-800/30 border-gray-700" : "bg-stone-50 border-gray-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Proof Documents</p>
            {proofDocuments.length === 0 ? (
              <p className="text-xs text-gray-500">No proof documents attached.</p>
            ) : (
              <ul className="space-y-2">
                {proofDocuments.map((doc, index) => {
                  const isUrl = /^https?:\/\//i.test(doc.reference);
                  return (
                    <li
                      key={`${doc.label}-${index}`}
                      className={`rounded-lg border px-3 py-2 ${
                        isDarkMode
                          ? "bg-stone-900 border-gray-700"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <p className={`text-xs font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{doc.label}</p>
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
                        <p className={`text-xs break-all ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                          {doc.reference}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          className={`px-6 py-4 border-t flex justify-end ${
            isDarkMode ? "border-gray-700 bg-stone-900" : "border-gray-200 bg-white"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-lg text-sm font-medium ${
              isDarkMode
                ? "bg-stone-800 hover:bg-stone-700 text-white"
                : "bg-stone-100 hover:bg-stone-200 text-gray-700"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ExpensesSection({ onNavigateToVoucher }) {
  const { isDarkMode } = useAuth();
  const { toasts, removeToast, showError, showWarning, showSuccess, showInfo } = useToast();

  // ── Data state ─────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Filters ────────────────────────────────────────────────
  const _curMonth = new Date().getMonth() + 1;
  const _defaultQuarter =
    _curMonth <= 3
      ? "q1"
      : _curMonth <= 6
        ? "q2"
        : _curMonth <= 9
          ? "q3"
          : "q4";

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(_defaultQuarter);
  const [voucherFilter, setVoucherFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  // ── Summary ────────────────────────────────────────────────
  const [summary, setSummary] = useState({
    totalAmount: 0,
    currentAmount: 0,
    targetAmount: 12500000,
    amountNeeded: 0,
    vatAmount: 0,
    nonVatAmount: 0,
    totalCount: 0,
  });

  // ── Modal state ────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [ocrDraftExpense, setOcrDraftExpense] = useState(null);
  const [ocrDraftExpenses, setOcrDraftExpenses] = useState([]);
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Persist quarter in localStorage ───────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("expenses.selectedQuarter");
      if (stored) setSelectedQuarter(stored);
      else localStorage.setItem("expenses.selectedQuarter", _defaultQuarter);
    } catch (err) {
      console.error("Failed reading stored selectedQuarter:", err);
      showWarning?.("Unable to access stored preferences");
    }
  }, []);

  useEffect(() => {
    try {
      if (selectedQuarter)
        localStorage.setItem("expenses.selectedQuarter", selectedQuarter);
    } catch (err) {
      console.error('Failed to persist selectedQuarter:', err);
      showWarning?.('Could not save preferences');
    }
  }, [selectedQuarter]);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'expense') return;

      const drafts = Array.isArray(payload.drafts)
        ? payload.drafts.filter(Boolean)
        : payload.draft
          ? [payload.draft]
          : [];

      setOcrDraftExpense(drafts[0] || null);
      setOcrDraftExpenses(drafts);
      setShowBulkModal(true);
    };

    window.addEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
    return () => window.removeEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
  }, []);

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, selectedYear, selectedQuarter]);

  useEffect(() => {
    loadChartOfAccounts();
  }, []);

  useEffect(() => {
    const handler = async () => {
      try {
        await loadExpenses();
      } catch (err) {
        console.error("expenses:changed handler failed", err);
        showWarning?.("Could not refresh expenses");
      }
    };
    window.addEventListener("expenses:changed", handler);
    return () => window.removeEventListener("expenses:changed", handler);
  }, []);

  useEffect(() => {
    const openAddExpense = () => setShowBulkModal(true);
    window.addEventListener("fpd:quick-add-expense", openAddExpense);
    return () => window.removeEventListener("fpd:quick-add-expense", openAddExpense);
  }, []);

  const loadChartOfAccounts = async () => {
    try {
      const resp = await apiService.finance.getChartOfAccounts();
      setChartOfAccounts(resp.accounts || resp.data || resp || []);
    } catch (err) {
      console.error("Failed to load chart of accounts:", err);
      setChartOfAccounts([]);
      showWarning?.('Unable to load chart of accounts');
    }
  };

  const loadExpenses = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const params = {
        month:
          selectedQuarter === "all"
            ? selectedMonth === "all"
              ? "all"
              : selectedMonth
            : "all",
        year: selectedYear === "all" ? "all" : selectedYear,
        quarter: selectedQuarter,
      };
      const response = await apiService.finance.getExpenseLineItems(params);
      const data = response.data || response;
      let lineItems = data.line_items || [];

      if (selectedQuarter !== "all") {
        const QUARTER_MAP = {
          q1: [1, 2, 3],
          q2: [4, 5, 6],
          q3: [7, 8, 9],
          q4: [10, 11, 12],
        };
        const months = QUARTER_MAP[selectedQuarter] || [];
        lineItems = lineItems.filter((item) => {
          if (!item.date) return false;
          const d = new Date(item.date);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          if (
            selectedYear !== "all" &&
            selectedYear != null &&
            y !== selectedYear
          )
            return false;
          return months.includes(m);
        });
      }

      const serverSum = data.summary || {};
      const processed = lineItems.map((item) => {
        // rawId: numeric expense id from finance_expenses table
        const rawId = item.id?.toString().startsWith("direct-")
          ? parseInt(item.id.replace("direct-", ""), 10)
          : null;

        // voucherNumber: the voucher that generated this expense (if any)
        const voucherNumber =
          item.voucher_number && !item.voucher_number.startsWith("EXP-")
            ? item.voucher_number
            : null;

        const sourceType = getVoucherSourceType(voucherNumber);
        const isVoucherExpense = !!sourceType;
        const fallbackParticulars =
          (item.particulars || "").trim() ||
          (item.or_ci_si ? `Reference: ${item.or_ci_si}` : "Voucher line item");

        return {
          ...item,
          rawId,
          voucherNumber,
          isVoucherExpense,
          date: item.date ? new Date(item.date) : new Date(),
          totalAmount: parseFloat(item.total_amount || 0),
          vatAmount: parseFloat(item.vat_amount || 0),
          nonVatAmount: parseFloat(item.non_vat_amount || 0),
          voucherType:
            sourceType === "petty_cash"
              ? "Petty Cash"
              : sourceType === "check"
                ? "Check Voucher"
                : item.voucher_type === "Petty Cash"
              ? "Petty Cash"
              : item.voucher_type === "Expense"
                ? "Direct Expense"
                : "Check Voucher",
          voucherSourceType: sourceType,
          companySupplier: item.company_supplier,
          accountClassification: item.account_classification || "",
          voucherNumber_raw: item.voucher_number,
          orCiSi: item.or_ci_si,
          particulars: fallbackParticulars,
          proof_documents_json: item.proof_documents_json ?? null,
        };
      });

      setExpenses(processed);

      if (serverSum.total_amount !== undefined) {
        setSummary({
          totalAmount: parseFloat(serverSum.total_amount ?? 0),
          currentAmount: parseFloat(serverSum.current_amount ?? 0),
          targetAmount: parseFloat(serverSum.target_amount ?? 0),
          amountNeeded: parseFloat(serverSum.amount_needed ?? 0),
          vatAmount: parseFloat(serverSum.vat_amount ?? 0),
          nonVatAmount: parseFloat(serverSum.non_vat_amount ?? 0),
          totalCount: parseInt(serverSum.total_count ?? serverSum.total ?? 0),
        });
      } else {
        const vat = processed.reduce((s, e) => s + e.vatAmount, 0);
        const nonVat = processed.reduce((s, e) => s + e.nonVatAmount, 0);
        const total = vat + nonVat;
        const target = 12500000;
        setSummary({
          totalAmount: total,
          currentAmount: total,
          targetAmount: target,
          amountNeeded: Math.max(0, target - total),
          vatAmount: vat,
          nonVatAmount: nonVat,
          totalCount: processed.length,
        });
      }
    } catch (err) {
      console.error("Failed to load expenses:", err);
      setExpenses([]);
      setLoadError(err?.message || "Failed to load expenses.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filtering & Sorting ────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = expenses;

    if (voucherFilter !== "all") {
      list = list.filter((e) =>
        voucherFilter === "check"
          ? e.voucherType === "Check Voucher"
          : voucherFilter === "petty_cash"
            ? e.voucherType === "Petty Cash"
            : voucherFilter === "expense"
              ? e.voucherType === "Direct Expense"
              : true,
      );
    }

    if (q) {
      list = list.filter((e) =>
        [
          e.particulars,
          e.accountClassification,
          e.companySupplier,
          e.address,
          e.tin,
          e.orCiSi,
          e.voucherNumber,
          e.proof_documents_json,
        ].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    return list;
  }, [expenses, searchTerm, voucherFilter]);

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case "date":
          aVal = a.date.getTime();
          bVal = b.date.getTime();
          break;
        case "particulars":
          aVal = (a.particulars || "").toLowerCase();
          bVal = (b.particulars || "").toLowerCase();
          break;
        case "company":
          aVal = (a.companySupplier || "").toLowerCase();
          bVal = (b.companySupplier || "").toLowerCase();
          break;
        case "amount":
          aVal = a.totalAmount;
          bVal = b.totalAmount;
          break;
        case "vat":
          aVal = a.vatAmount;
          bVal = b.vatAmount;
          break;
        case "nonVat":
          aVal = a.nonVatAmount;
          bVal = b.nonVatAmount;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredExpenses, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field)
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // ── Export ─────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      showInfo?.("No expenses to export.");
      return;
    }
    generateExpensesReport(filteredExpenses, {
      year: selectedYear,
      quarter: selectedQuarter,
      month: selectedMonth,
    }, summary.targetAmount);
  };

  // ── Edit / Delete handlers ─────────────────────────────────

  /**
   * Save changes to an expense.
   * If the expense came from a petty cash voucher, the backend will also sync
   * the matching voucher line item (handled server-side).
   */
  const handleEditSave = async (rawId, payload) => {
    await apiService.finance.updateExpense(rawId, payload);
    // Optimistic local update
    setExpenses((prev) =>
      prev.map((e) =>
        e.rawId === rawId
          ? {
              ...e,
              date: new Date(payload.date),
              particulars: payload.particulars,
              accountClassification: payload.account_classification || "",
              companySupplier: payload.company_supplier || "",
              address: payload.address || "",
              tin: payload.tin || "",
              orCiSi: payload.or_ci_si || "",
              vatAmount: payload.vat_amount,
              nonVatAmount: payload.non_vat_amount,
              totalAmount: payload.total_amount,
              proof_documents_json:
                payload.proof_documents_json ?? e.proof_documents_json ?? null,
            }
          : e,
      ),
    );
  };

  /**
   * Confirm deletion / hiding of an expense.
   * For voucher-sourced expenses the backend toggles include_in_expenses = 0
   * instead of permanently removing the record.
   */
  const handleDeleteConfirm = async () => {
    if (!deleteExpense) return;
    setIsDeleting(true);
    try {
      await apiService.finance.deleteExpense(deleteExpense.rawId);
      setExpenses((prev) =>
        prev.filter((e) => e.rawId !== deleteExpense.rawId),
      );
      setDeleteExpense(null);
    } catch (err) {
      console.error("Failed to remove expense:", err);
      showError?.(err.message || "Failed to remove. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  /** Navigate to the source voucher */
  const handleNavigateToVoucher = (voucherNumber) => {
    if (onNavigateToVoucher) {
      onNavigateToVoucher(voucherNumber);
    } else {
      // Fallback: copy to clipboard with a toast-like alert
      navigator.clipboard?.writeText(voucherNumber).catch((err) => {
        console.error('Clipboard copy failed', err);
        showWarning?.('Copy to clipboard failed');
      });
      const _msg = `Voucher: ${voucherNumber}\n\nNavigate to Vouchers and search for this number.`;
      showInfo?.(_msg);
    }
  };

  // ── Derived ────────────────────────────────────────────────
  const progress =
    summary.targetAmount > 0
      ? Math.min(100, (summary.currentAmount / summary.targetAmount) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-20">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* ── 1. SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Expenses */}
        <div className="bg-white dark:bg-stone-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-gray-50 dark:bg-gray-900/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gray-100 dark:bg-gray-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Wallet size={20} />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Total Expenses
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(summary.totalAmount)}
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              {summary.totalCount} transactions
            </p>
          </div>
        </div>

        {/* Target Progress */}
        <div className="bg-white dark:bg-stone-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-600 dark:text-yellow-400">
                <Target size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Target Amount
                </span>
                <span className="text-xs font-mono font-medium text-gray-400">
                  {formatCurrency(summary.targetAmount)}
                </span>
              </div>
            </div>
            <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
              {progress.toFixed(1)}%
            </span>
          </div>
          <div className="mt-4">
            <div className="h-2.5 w-full bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? "bg-green-500" : "bg-yellow-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-medium text-gray-500">
              Current: {formatCurrency(summary.currentAmount)}
            </p>
          </div>
        </div>

        {/* Amount Needed */}
        <div className="bg-white dark:bg-stone-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 dark:bg-orange-900/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                <TrendingDown size={20} />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Amount Needed
              </span>
            </div>
            <p
              className={`text-3xl font-mono font-bold tracking-tight ${summary.amountNeeded === 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}
            >
              {summary.amountNeeded === 0
                ? "Target Hit!"
                : formatCurrency(summary.amountNeeded)}
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              To reach target
            </p>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-xs font-bold uppercase text-gray-500">
                  VAT
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                {formatCurrency(summary.vatAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs font-bold uppercase text-gray-500">
                  Non-VAT
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                {formatCurrency(summary.nonVatAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      <ExpensesBulkCreator
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setOcrDraftExpense(null);
          setOcrDraftExpenses([]);
        }}
        onSuccess={() => {
          setShowBulkModal(false);
          setOcrDraftExpense(null);
          setOcrDraftExpenses([]);
          loadExpenses();
        }}
        isDarkMode={isDarkMode}
        chartOfAccounts={chartOfAccounts}
        initialDraft={ocrDraftExpense}
        initialDrafts={ocrDraftExpenses}
      />

      <ExpensesEditModal
        isOpen={!!editExpense}
        onClose={() => setEditExpense(null)}
        onSuccess={() => setEditExpense(null)}
        expense={editExpense}
        isDarkMode={isDarkMode}
        chartOfAccounts={chartOfAccounts}
        onSave={handleEditSave}
        onNavigateToVoucher={handleNavigateToVoucher}
      />

      <ExpenseViewModal
        expense={viewExpense}
        isDarkMode={isDarkMode}
        onClose={() => setViewExpense(null)}
        onNavigateToVoucher={handleNavigateToVoucher}
      />

      <DeleteConfirmModal
        expense={deleteExpense}
        isDarkMode={isDarkMode}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteExpense(null)}
        isDeleting={isDeleting}
      />

      {/* ── 2. TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white dark:bg-stone-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm sticky top-2 z-20">
        {/* Left: filters */}
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 items-center">
          <div className="relative w-full sm:w-64 group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search expenses or voucher #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Month */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedQuarter("all");
                  setSelectedMonth(
                    e.target.value === "all" ? "all" : parseInt(e.target.value),
                  );
                }}
                className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Filter
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={14}
              />
            </div>

            {/* Quarter */}
            <div className="relative">
              <select
                value={selectedQuarter}
                onChange={(e) => {
                  const q = e.target.value;
                  setSelectedQuarter(q);
                  if (q !== "all") setSelectedMonth("all");
                }}
                className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
              >
                {QUARTER_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
              <Filter
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={14}
              />
            </div>

            {/* Year */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(
                    e.target.value === "all" ? "all" : parseInt(e.target.value),
                  )
                }
                className="w-full sm:w-32 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
              >
                {getYearOptions().map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
              <Filter
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={14}
              />
            </div>

            <button
              onClick={() => {
                setSelectedQuarter(_defaultQuarter);
                setSelectedMonth("all");
                setSelectedYear(new Date().getFullYear());
              }}
              className="px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-xl transition-colors font-medium whitespace-nowrap border border-blue-200 dark:border-blue-800"
            >
              Current Quarter
            </button>

            <div className="h-10 w-px bg-stone-200 dark:bg-stone-700 mx-1 hidden sm:block" />

            {/* Voucher type */}
            <div className="relative">
              <select
                value={voucherFilter}
                onChange={(e) => setVoucherFilter(e.target.value)}
                className="w-full sm:w-40 pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-stone-700 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="check">Check Vouchers</option>
                <option value="petty_cash">Petty Cash</option>
                <option value="expense">Direct Expense</option>
              </select>
              <Filter
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={14}
              />
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={20} />
            Export Excel
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl flex items-center gap-2 text-sm font-medium shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all"
          >
            <FileText size={16} />
            Add New Records
          </button>
        </div>
      </div>

      {/* ── 3. TABLE ── */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        {loadError ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-5 border border-red-200 dark:border-red-800/50">
              <AlertTriangle size={30} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Couldn’t load expenses</h3>
            <p className="text-gray-500 max-w-md mb-6">{loadError}</p>
            <button
              onClick={loadExpenses}
              className="px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-gray-100 dark:border-gray-700" />
              <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            </div>
            <p className="mt-4 text-gray-500 font-medium">Loading expenses...</p>
          </div>
        ) : sortedExpenses.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              No expenses found
            </h3>
            <p className="text-gray-500 max-w-sm mb-6">
              Try adjusting your filters or add a new record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto relative min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50/90 dark:bg-stone-800/90 backdrop-blur-sm sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <tr>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      DATE{" "}
                      <SortIndicator
                        field="date"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50"
                    onClick={() => handleSort("particulars")}
                  >
                    <div className="flex items-center gap-1">
                      PARTICULARS{" "}
                      <SortIndicator
                        field="particulars"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </div>
                  </th>
                  <th rowSpan={2} className="px-4 py-3">
                    CLASSIFICATION
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50"
                    onClick={() => handleSort("company")}
                  >
                    <div className="flex items-center gap-1">
                      COMPANY / PAYEE{" "}
                      <SortIndicator
                        field="company"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </div>
                  </th>
                  <th rowSpan={2} className="px-4 py-3">
                    ADDRESS
                  </th>
                  <th rowSpan={2} className="px-4 py-3">
                    T.I.N
                  </th>
                  <th rowSpan={2} className="px-4 py-3">
                    O.R./C.I./S.I.
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center border-b border-gray-200 dark:border-gray-700"
                  >
                    BREAKDOWN
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 text-right cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700/50"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      TOTAL{" "}
                      <SortIndicator
                        field="amount"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </div>
                  </th>
                  {/* Source column: type badge + voucher link */}
                  <th rowSpan={2} className="px-4 py-3 text-center">
                    SOURCE
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center">
                    ACTIONS
                  </th>
                </tr>
                <tr>
                  <th
                    className="px-4 py-2 text-right text-blue-600 dark:text-blue-400 cursor-pointer"
                    onClick={() => handleSort("vat")}
                  >
                    VAT{" "}
                    <SortIndicator
                      field="vat"
                      sortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </th>
                  <th
                    className="px-4 py-2 text-right text-purple-600 dark:text-purple-400 cursor-pointer"
                    onClick={() => handleSort("nonVat")}
                  >
                    NON-VAT{" "}
                    <SortIndicator
                      field="nonVat"
                      sortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {sortedExpenses.map((exp, idx) => {
                  // Editable: any expense that has a rawId (i.e. lives in finance_expenses)
                  const isEditable = !!exp.rawId;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors text-sm group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300 font-medium">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        <div
                          className="max-w-[200px] truncate"
                          title={exp.particulars}
                        >
                          {exp.particulars}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div
                          className="max-w-[180px] truncate"
                          title={exp.accountClassification}
                        >
                          {exp.accountClassification || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        <div
                          className="max-w-[180px] truncate"
                          title={exp.companySupplier}
                        >
                          {exp.companySupplier}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <div className="max-w-[150px] truncate">
                          {exp.address || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {exp.tin || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {exp.orCiSi || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                        {exp.vatAmount > 0 ? formatCurrency(exp.vatAmount) : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-purple-600 dark:text-purple-400">
                        {exp.nonVatAmount > 0
                          ? formatCurrency(exp.nonVatAmount)
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                        {formatCurrency(exp.totalAmount)}
                      </td>

                      {/* ── SOURCE column: type badge + optional voucher link ── */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          {/* Type badge */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                              exp.voucherType === "Check Voucher"
                                ? "bg-gray-50 text-blue-700 border-blue-100 dark:bg-gray-900/30 dark:text-blue-300 dark:border-blue-800"
                                : exp.voucherType === "Petty Cash"
                                  ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                                  : "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            }`}
                          >
                            {exp.voucherType === "Check Voucher"
                              ? "Check"
                              : exp.voucherType === "Petty Cash"
                                ? "Petty Cash"
                                : "Expense"}
                          </span>

                          {/* Voucher link — shown for voucher-sourced expenses */}
                          {exp.isVoucherExpense && exp.voucherNumber && (
                            <VoucherSourceBadge
                              voucherNumber={exp.voucherNumber}
                              onNavigate={handleNavigateToVoucher}
                              isDarkMode={isDarkMode}
                            />
                          )}
                        </div>
                      </td>

                      {/* ── ACTION buttons ── */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setViewExpense(exp)}
                            title="View details"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/20 transition-colors"
                          >
                            <Eye size={14} />
                          </button>

                          {isEditable && (
                            <>
                            <button
                              onClick={() => setEditExpense(exp)}
                              title={
                                exp.isVoucherExpense
                                  ? "Edit expense (will also update voucher)"
                                  : "Edit expense"
                              }
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteExpense(exp)}
                              title={
                                exp.isVoucherExpense
                                  ? "Hide from expenses (voucher line remains)"
                                  : "Delete expense"
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                exp.isVoucherExpense
                                  ? "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                  : "text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              }`}
                            >
                              {exp.isVoucherExpense ? (
                                <ToggleLeft size={14} />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-stone-50 dark:bg-stone-800 font-bold border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-3 text-right text-xs uppercase tracking-wide text-gray-500"
                  >
                    Page Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                    {formatCurrency(
                      sortedExpenses.reduce((s, e) => s + e.vatAmount, 0),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-purple-600 dark:text-purple-400">
                    {formatCurrency(
                      sortedExpenses.reduce((s, e) => s + e.nonVatAmount, 0),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-900 dark:text-white">
                    {formatCurrency(
                      sortedExpenses.reduce((s, e) => s + e.totalAmount, 0),
                    )}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}