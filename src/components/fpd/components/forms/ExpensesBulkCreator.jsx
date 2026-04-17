import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Save,
  Upload,
  Loader2,
  Trash2,
  FileText,
  MapPin,
  Hash,
  DollarSign,
  Calendar,
  Briefcase,
  Building,
  CreditCard,
  Tag,
  Layers,
} from "lucide-react";
import apiService from "../../../../utils/api/api-service";
import { useAuth } from "../../../../contexts/AuthContext";

function proofDocumentsJsonToText(value) {
  if (value == null || value === "") return "";

  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return "";
    }
  }

  if (!Array.isArray(parsed)) return "";

  return parsed
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (!entry || typeof entry !== "object") return "";
      const label = String(entry.label || entry.name || "").trim();
      const reference = String(entry.reference || entry.url || entry.path || "").trim();
      if (label && reference && label !== reference) return `${label} | ${reference}`;
      return label || reference;
    })
    .filter(Boolean)
    .join("\n");
}

function proofDocumentsTextToJson(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (lines.length === 0) return JSON.stringify([]);

  const docs = lines.map((line, index) => {
    const parts = line.split("|");
    if (parts.length > 1) {
      const label = (parts.shift() || "").trim();
      const reference = parts.join("|").trim();
      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label || `Document ${index + 1}`,
      };
    }
    return {
      label: line,
      reference: line,
    };
  });

  return JSON.stringify(docs);
}

function uploadedProofDocumentToLine(uploaded, fallbackName) {
  const label = String(
    uploaded?.original_name || uploaded?.originalName || fallbackName || "Document",
  ).trim();
  const reference = String(
    uploaded?.reference || uploaded?.url || uploaded?.path || "",
  ).trim();

  if (!reference) return "";
  if (label && label !== reference) return `${label} | ${reference}`;
  return reference;
}

/**
 * Modern, Compact Card-Based Bulk Creator for Direct Expenses.
 */
export default function ExpensesBulkCreator({
  isOpen,
  onClose,
  onSuccess,
  isDarkMode: propIsDarkMode,
  chartOfAccounts = [],
  initialDraft = null,
  initialDrafts = [],
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  // --- STATE MANAGEMENT ---
  const [expenses, setExpenses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingProofExpenseId, setUploadingProofExpenseId] = useState(null);

  // Ref for scrolling to bottom when adding items
  const bottomRef = useRef(null);

  // Initialize with one empty expense card
  useEffect(() => {
    if (isOpen) {
      if (Array.isArray(initialDrafts) && initialDrafts.length > 0) {
        setExpenses(
          initialDrafts.map((draft) => ({
            ...createEmptyExpense(),
            ...draft,
            proof_documents_text:
              draft.proof_documents_text ??
              proofDocumentsJsonToText(draft.proof_documents_json),
            id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          })),
        );
      } else if (initialDraft) {
        setExpenses([
          {
            ...createEmptyExpense(),
            ...initialDraft,
            proof_documents_text:
              initialDraft.proof_documents_text ??
              proofDocumentsJsonToText(initialDraft.proof_documents_json),
          },
        ]);
      } else {
        setExpenses([createEmptyExpense()]);
      }
    }
  }, [isOpen, initialDraft, initialDrafts]);

  // Scroll to bottom when expenses array grows
  useEffect(() => {
    if (bottomRef.current && expenses.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [expenses.length]);

  // Factory for new expense item
  const createEmptyExpense = () => ({
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString().split("T")[0],
    account_classification: "",
    particulars: "",
    company_supplier: "",
    address: "",
    tin: "",
    or_ci_si: "",
    vat_amount: "",
    non_vat_amount: "",
    proof_documents_text: "",
  });

  // --- HANDLERS ---

  const handleAddMultiple = (count) => {
    const newItems = Array.from({ length: count }, createEmptyExpense);
    setExpenses((prev) => [...prev, ...newItems]);
  };

  const handleRemoveExpense = (id) => {
    if (expenses.length > 1) {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleChange = (id, field, value) => {
    setExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleProofUpload = async (expenseId, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setUploadingProofExpenseId(expenseId);
    try {
      const uploadedLines = [];

      for (const file of files) {
        const response = await apiService.finance.uploadProofDocument(file, {
          module: "expenses",
        });

        const uploaded = response?.uploaded || response?.data?.uploaded || null;
        const line = uploadedProofDocumentToLine(uploaded, file.name);
        if (line) uploadedLines.push(line);
      }

      if (!uploadedLines.length) return;

      setExpenses((prev) =>
        prev.map((item) => {
          if (item.id !== expenseId) return item;
          const existing = String(item.proof_documents_text || "").trim();
          const nextText = existing
            ? `${existing}\n${uploadedLines.join("\n")}`
            : uploadedLines.join("\n");
          return { ...item, proof_documents_text: nextText };
        }),
      );
    } catch (err) {
      console.error("Failed to upload proof document:", err);
      setError(err?.message || "Failed to upload proof document.");
    } finally {
      setUploadingProofExpenseId(null);
    }
  };

  // Calculate totals
  const totals = expenses.reduce(
    (acc, item) => {
      const vat = parseFloat(item.vat_amount || 0);
      const nonVat = parseFloat(item.non_vat_amount || 0);
      return {
        vat: acc.vat + vat,
        nonVat: acc.nonVat + nonVat,
        total: acc.total + (vat + nonVat),
      };
    },
    { vat: 0, nonVat: 0, total: 0 },
  );

  const handleSubmit = async () => {
    const isValid = expenses.every(
      (item) =>
        item.date &&
        item.particulars &&
        parseFloat(item.vat_amount || 0) +
          parseFloat(item.non_vat_amount || 0) >
          0,
    );

    if (!isValid) {
      setError(
        "Please fill in Date, Particulars, and at least one Amount for all expenses.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = expenses.map(({ id, proof_documents_text, ...rest }) => {
        const vat_amount = parseFloat(rest.vat_amount || 0);
        const non_vat_amount = parseFloat(rest.non_vat_amount || 0);
        let account_id = null;

        if (rest.account_classification && chartOfAccounts?.length > 0) {
          const found = chartOfAccounts.find(
            (a) => a.account_name === rest.account_classification,
          );
          account_id = found ? found.id : null;
        }

        return {
          ...rest,
          account_classification: rest.account_classification || null,
          account_id,
          vat_amount,
          non_vat_amount,
          total_amount: vat_amount + non_vat_amount,
          status: "approved",
          proof_documents_json: proofDocumentsTextToJson(proof_documents_text),
        };
      });

      await apiService.finance.createExpensesBulk(payload);

      if (onSuccess) onSuccess();

      try {
        window.dispatchEvent(
          new CustomEvent("expenses:changed", {
            detail: { count: payload.length },
          }),
        );
      } catch (e) {
        console.warn("Failed to dispatch expenses:changed event", e);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save expenses:", err);
      setError(err.message || "Failed to save expenses. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Reusable styling strings to keep JSX cleaner
  const inputClass = `w-full pl-8 pr-3 py-1.5 h-9 rounded-md text-xs border focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${
    isDarkMode
      ? "bg-stone-900 border-gray-600 text-white placeholder-gray-500"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
  }`;

  const labelClass =
    "block text-[10px] font-bold uppercase text-gray-500 mb-1 tracking-wider";
  const iconClass = "absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl shadow-2xl ${isDarkMode ? "bg-stone-900 text-gray-100" : "bg-white text-gray-900"}`}
      >
        {/* --- HEADER --- */}
        <div
          className={`px-5 py-3 border-b flex justify-between items-center ${isDarkMode ? "border-gray-700 bg-stone-800/50" : "border-gray-200 bg-stone-50/80"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${isDarkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"}`}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight leading-tight">
                Bulk Expense Creator
              </h2>
              <p
                className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
              >
                Add multiple direct expenses efficiently
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${isDarkMode ? "hover:bg-stone-700 text-gray-400" : "hover:bg-stone-200 text-gray-500"}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* --- ERROR MESSAGE --- */}
        {error && (
          <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/20">
            <p className="text-xs text-red-500 flex items-center gap-2 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          </div>
        )}

        {/* --- BODY (SCROLLABLE CARD LIST) --- */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50 dark:bg-black/20">
          {expenses.map((expense, index) => (
            <div
              key={expense.id}
              className={`relative rounded-xl border shadow-sm transition-all duration-200 
                ${isDarkMode ? "bg-stone-800 border-gray-700 hover:border-gray-600" : "bg-white border-gray-200 hover:border-blue-300"}`}
            >
              {/* Card Header Strip */}
              <div
                className={`px-4 py-2 border-b flex justify-between items-center rounded-t-xl ${isDarkMode ? "border-gray-700 bg-stone-800/80" : "border-gray-100 bg-stone-50/80"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isDarkMode ? "bg-stone-700 text-gray-300 border-gray-600" : "bg-stone-200 text-gray-600 border-gray-300"}`}
                  >
                    #{index + 1}
                  </span>
                </div>
                {expenses.length > 1 && (
                  <button
                    onClick={() => handleRemoveExpense(expense.id)}
                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remove Entry"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Card Content Grid (More Compact & Reorganized) */}
              <div className="p-4 grid grid-cols-12 gap-3">
                {/* Row 1: Date, Classification, Payee */}
                <div className="col-span-12 md:col-span-3">
                  <label className={labelClass}>
                    Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className={iconClass} size={14} />
                    <input
                      type="date"
                      value={expense.date}
                      onChange={(e) =>
                        handleChange(expense.id, "date", e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <label className={labelClass}>Classification</label>
                  <div className="relative">
                    <Briefcase className={iconClass} size={14} />
                    <select
                      value={expense.account_classification || ""}
                      onChange={(e) =>
                        handleChange(
                          expense.id,
                          "account_classification",
                          e.target.value,
                        )
                      }
                      className={`${inputClass} appearance-none pr-8`}
                    >
                      <option value="">Select account...</option>
                      {chartOfAccounts.map((acc) => (
                        <option key={acc.id} value={acc.account_name}>
                          {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-5">
                  <label className={labelClass}>Company / Payee</label>
                  <div className="relative">
                    <Building className={iconClass} size={14} />
                    <input
                      type="text"
                      placeholder="Who was this paid to?"
                      value={expense.company_supplier}
                      onChange={(e) =>
                        handleChange(
                          expense.id,
                          "company_supplier",
                          e.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Row 2: Particulars, Address, TIN */}
                <div className="col-span-12 md:col-span-5">
                  <label className={labelClass}>
                    Particulars <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag className={iconClass} size={14} />
                    <input
                      type="text"
                      placeholder="Description of expense"
                      value={expense.particulars}
                      onChange={(e) =>
                        handleChange(expense.id, "particulars", e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <label className={labelClass}>Address</label>
                  <div className="relative">
                    <MapPin className={iconClass} size={14} />
                    <input
                      type="text"
                      placeholder="Payee Address"
                      value={expense.address}
                      onChange={(e) =>
                        handleChange(expense.id, "address", e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <label className={labelClass}>T.I.N.</label>
                  <div className="relative">
                    <CreditCard className={iconClass} size={14} />
                    <input
                      type="text"
                      placeholder="000-000-000"
                      value={expense.tin}
                      onChange={(e) =>
                        handleChange(expense.id, "tin", e.target.value)
                      }
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                {/* Row 3: Financials (Ref, VAT, Non-VAT, Total) */}
                <div className="col-span-12 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1 mb-0.5"></div>

                <div className="col-span-6 md:col-span-3">
                  <label className={labelClass}>O.R./C.I./S.I.</label>
                  <div className="relative">
                    <Hash className={iconClass} size={14} />
                    <input
                      type="text"
                      placeholder="Receipt/Invoice #"
                      value={expense.or_ci_si}
                      onChange={(e) =>
                        handleChange(expense.id, "or_ci_si", e.target.value)
                      }
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-9">
                  <label className={labelClass}>Proof Documents (one per line)</label>
                  <textarea
                    rows={2}
                    placeholder="Receipt #12345 | https://..."
                    value={expense.proof_documents_text || ""}
                    onChange={(e) =>
                      handleChange(
                        expense.id,
                        "proof_documents_text",
                        e.target.value,
                      )
                    }
                    className={`w-full px-3 py-1.5 rounded-md text-xs border focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-y ${
                      isDarkMode
                        ? "bg-stone-900 border-gray-600 text-white placeholder-gray-500"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <label
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                        isDarkMode
                          ? "bg-stone-900 border-gray-700 text-gray-200 hover:bg-stone-800"
                          : "bg-stone-50 border-gray-300 text-gray-700 hover:bg-stone-100"
                      } ${uploadingProofExpenseId === expense.id ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {uploadingProofExpenseId === expense.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Upload size={12} />
                      )}
                      {uploadingProofExpenseId === expense.id
                        ? "Uploading..."
                        : "Attach Files"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploadingProofExpenseId === expense.id}
                        onChange={(e) => handleProofUpload(expense.id, e)}
                      />
                    </label>
                    <span className="text-[11px] text-gray-500">
                      Upload adds link entries automatically.
                    </span>
                  </div>
                </div>

                <div className="col-span-6 md:col-span-3">
                  <label
                    className={`block text-[10px] font-bold uppercase text-blue-500 mb-1 tracking-wider`}
                  >
                    VAT Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={expense.vat_amount}
                      onChange={(e) =>
                        handleChange(expense.id, "vat_amount", e.target.value)
                      }
                      className={`${inputClass} font-mono text-right pl-6 text-blue-600 dark:text-blue-400 font-medium`}
                    />
                  </div>
                </div>

                <div className="col-span-6 md:col-span-3">
                  <label
                    className={`block text-[10px] font-bold uppercase text-purple-500 mb-1 tracking-wider`}
                  >
                    Non-VAT Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={expense.non_vat_amount}
                      onChange={(e) =>
                        handleChange(
                          expense.id,
                          "non_vat_amount",
                          e.target.value,
                        )
                      }
                      className={`${inputClass} font-mono text-right pl-6 text-purple-600 dark:text-purple-400 font-medium`}
                    />
                  </div>
                </div>

                <div className="col-span-6 md:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 text-right tracking-wider">
                    Entry Total
                  </label>
                  <div
                    className={`flex items-center justify-end h-9 px-3 rounded-md border bg-stone-50 dark:bg-stone-800/50 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}
                  >
                    <span
                      className={`font-mono font-bold text-xs ${isDarkMode ? "text-white" : "text-gray-900"}`}
                    >
                      ₱
                      {(
                        parseFloat(expense.vat_amount || 0) +
                        parseFloat(expense.non_vat_amount || 0)
                      ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* --- ADD BUTTON STRIP (1 or 5) --- */}
        <div
          className={`px-4 py-3 border-t flex flex-col sm:flex-row gap-3 ${isDarkMode ? "border-gray-700 bg-stone-800/80" : "border-gray-200 bg-stone-50"}`}
        >
          <button
            onClick={() => handleAddMultiple(1)}
            className={`flex-1 py-2 rounded-lg border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all
               ${
                 isDarkMode
                   ? "border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 hover:bg-gray-900/20"
                   : "border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-gray-50"
               }`}
          >
            <Plus size={14} /> Add 1 Row
          </button>

          <button
            onClick={() => handleAddMultiple(5)}
            className={`flex-1 py-2 rounded-lg border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all
               ${
                 isDarkMode
                   ? "border-gray-600 text-gray-300 hover:border-purple-500 hover:text-purple-400 hover:bg-purple-900/20"
                   : "border-gray-300 text-gray-600 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50"
               }`}
          >
            <Layers size={14} /> Add 5 Rows
          </button>
        </div>

        {/* --- FOOTER (TOTALS & ACTIONS) --- */}
        <div
          className={`px-5 py-4 border-t flex flex-col lg:flex-row justify-between items-center gap-4 ${isDarkMode ? "border-gray-700 bg-stone-900" : "border-gray-300 bg-white"}`}
        >
          <div className="flex gap-5 text-xs w-full lg:w-auto justify-between lg:justify-start">
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">
                VAT Total
              </span>
              <span className="font-mono font-bold text-blue-500 text-sm">
                ₱
                {totals.vat.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">
                Non-VAT Total
              </span>
              <span className="font-mono font-bold text-purple-500 text-sm">
                ₱
                {totals.nonVat.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="pl-5 border-l border-gray-300 dark:border-gray-700">
              <span className="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">
                Grand Total
              </span>
              <span
                className={`font-mono font-bold text-base ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                ₱
                {totals.total.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="flex gap-2 w-full lg:w-auto">
            <button
              onClick={onClose}
              className={`flex-1 lg:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? "bg-stone-800 hover:bg-stone-700 text-white" : "bg-stone-100 hover:bg-stone-200 text-gray-700"}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 lg:flex-none px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} /> Save {expenses.length} Entries
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
