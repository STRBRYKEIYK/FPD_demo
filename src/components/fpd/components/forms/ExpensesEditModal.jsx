import React, { useState, useEffect } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import apiService from "../../../../utils/api/api-service";
import {
  X,
  Save,
  FileText,
  MapPin,
  Hash,
  Calendar,
  Briefcase,
  Building,
  CreditCard,
  Tag,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Info,
  Upload,
} from "lucide-react";

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

function proofDocumentsTextToList(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line, index) => {
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
        label: `Document ${index + 1}`,
        reference: line,
      };
    });
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
 * ExpensesEditModal
 *
 * Backward-compatible: when the expense originated from a voucher
 * (isVoucherExpense = true), a prominent info banner is shown explaining that
 * saving will also sync the matching line item on the source voucher.
 */
export default function ExpensesEditModal({
  isOpen,
  onClose,
  onSuccess,
  expense,
  isDarkMode: propIsDarkMode,
  chartOfAccounts = [],
  onSave,
  onNavigateToVoucher,
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode =
    typeof propIsDarkMode !== "undefined" ? propIsDarkMode : authIsDarkMode;

  const [form, setForm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Determine whether this expense came from a voucher
  const isVoucherExpense = !!expense?.isVoucherExpense;
  const sourceVoucherNumber = expense?.voucherNumber || null;
  const sourceLabel = sourceVoucherNumber?.startsWith("CHK-")
    ? "check voucher"
    : "petty cash voucher";

  // Populate form whenever the target expense changes
  useEffect(() => {
    if (!expense || !isOpen) return;

    setError(null);
    setForm({
      date:
        expense.date instanceof Date
          ? expense.date.toISOString().split("T")[0]
          : (expense.date ?? ""),
      particulars: expense.particulars ?? "",
      account_classification: expense.accountClassification ?? "",
      company_supplier: expense.companySupplier ?? "",
      address: expense.address ?? "",
      tin: expense.tin ?? "",
      or_ci_si: expense.orCiSi ?? "",
      vat_amount: expense.vatAmount != null ? String(expense.vatAmount) : "",
      non_vat_amount:
        expense.nonVatAmount != null ? String(expense.nonVatAmount) : "",
      proof_documents_text: proofDocumentsJsonToText(
        expense.proof_documents_json,
      ),
    });
  }, [expense, isOpen]);

  if (!isOpen || !form) return null;

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const entryTotal =
    parseFloat(form.vat_amount || 0) + parseFloat(form.non_vat_amount || 0);
  const proofDocumentsPreview = proofDocumentsTextToList(
    form.proof_documents_text,
  );

  const handleSubmit = async () => {
    if (!form.date) {
      setError("Date is required.");
      return;
    }
    if (!form.particulars) {
      setError("Particulars / Description is required.");
      return;
    }
    if (entryTotal <= 0) {
      setError(
        "At least one amount (VAT or Non-VAT) must be greater than 0.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        date: form.date,
        particulars: form.particulars,
        account_classification: form.account_classification || null,
        company_supplier: form.company_supplier || null,
        address: form.address || null,
        tin: form.tin || null,
        or_ci_si: form.or_ci_si || null,
        vat_amount: parseFloat(form.vat_amount || 0),
        non_vat_amount: parseFloat(form.non_vat_amount || 0),
        total_amount: entryTotal,
        proof_documents_json: proofDocumentsTextToJson(form.proof_documents_text),
      };

      await onSave(expense.rawId, payload);
      if (onSuccess) onSuccess(payload);
      onClose();
    } catch (err) {
      console.error("Failed to update expense:", err);
      setError(err.message || "Failed to save changes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProofUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setIsUploadingProof(true);
    setError(null);

    try {
      const uploadedLines = [];

      for (const file of files) {
        const response = await apiService.finance.uploadProofDocument(file, {
          module: "expenses",
          record_id: expense?.rawId,
        });

        const uploaded = response?.uploaded || response?.data?.uploaded || null;
        const line = uploadedProofDocumentToLine(uploaded, file.name);
        if (line) uploadedLines.push(line);
      }

      if (!uploadedLines.length) return;

      setForm((prev) => {
        const existing = String(prev?.proof_documents_text || "").trim();
        const nextText = existing
          ? `${existing}\n${uploadedLines.join("\n")}`
          : uploadedLines.join("\n");
        return { ...prev, proof_documents_text: nextText };
      });
    } catch (err) {
      console.error("Failed to upload proof document:", err);
      setError(err?.message || "Failed to upload proof document.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Shared compact styles
  const inputBase = `w-full pl-8 pr-3 py-1.5 h-9 rounded-md text-xs border focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${
    isDarkMode
      ? "bg-stone-900 border-gray-600 text-white placeholder-gray-500"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
  }`;

  const labelClass =
    "block text-[10px] font-bold uppercase text-gray-500 mb-1 tracking-wider";
  const iconClass = "absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl flex flex-col rounded-2xl shadow-2xl ${
          isDarkMode ? "bg-stone-900 text-gray-100" : "bg-white text-gray-900"
        }`}
      >
        {/* ── Header ── */}
        <div
          className={`px-5 py-3 border-b flex justify-between items-center rounded-t-2xl ${
            isDarkMode
              ? "border-gray-700 bg-stone-800/50"
              : "border-gray-200 bg-stone-50/80"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isDarkMode
                  ? "bg-gray-900/30 text-blue-400"
                  : "bg-gray-100 text-blue-600"
              }`}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight leading-tight">
                Edit Expense
              </h2>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {isVoucherExpense
                  ? "Changes will also sync to the source voucher"
                  : "Update expense record"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${
              isDarkMode
                ? "hover:bg-stone-700 text-gray-400"
                : "hover:bg-stone-200 text-gray-500"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Voucher Source Banner ── */}
        {isVoucherExpense && sourceVoucherNumber && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between gap-3 ${
              isDarkMode
                ? "bg-indigo-900/20 border-indigo-800"
                : "bg-indigo-50 border-indigo-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Info
                size={15}
                className={
                  isDarkMode ? "text-indigo-400 shrink-0" : "text-indigo-600 shrink-0"
                }
              />
              <p
                className={`text-xs font-medium ${
                  isDarkMode ? "text-indigo-300" : "text-indigo-700"
                }`}
              >
                This expense was generated from {sourceLabel}{" "}
                <span className="font-mono font-bold">{sourceVoucherNumber}</span>.
                Saving will update this expense record and sync the amounts back
                to the corresponding voucher line item.
              </p>
            </div>
            {onNavigateToVoucher && (
              <button
                onClick={() => onNavigateToVoucher(sourceVoucherNumber)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isDarkMode
                    ? "bg-indigo-900/40 border-indigo-700 text-indigo-300 hover:bg-indigo-800/60"
                    : "bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                <ExternalLink size={12} />
                View Voucher
              </button>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/20">
            <p className="text-xs text-red-500 flex items-center gap-2 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {error}
            </p>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-5 grid grid-cols-12 gap-3 overflow-y-auto max-h-[70vh]">
          {/* Row 1: Date, Classification, Payee */}
          <div className="col-span-12 md:col-span-3">
            <label className={labelClass}>
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className={iconClass} size={14} />
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className={inputBase}
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className={labelClass}>Account Classification</label>
            <div className="relative">
              <Briefcase className={iconClass} size={14} />
              <select
                value={form.account_classification || ""}
                onChange={(e) =>
                  handleChange("account_classification", e.target.value)
                }
                className={`${inputBase} appearance-none pr-8`}
              >
                <option value="">Select classification...</option>
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
                value={form.company_supplier}
                onChange={(e) =>
                  handleChange("company_supplier", e.target.value)
                }
                className={inputBase}
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
                placeholder="What was this expense for?"
                value={form.particulars}
                onChange={(e) => handleChange("particulars", e.target.value)}
                className={inputBase}
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className={labelClass}>Address</label>
            <div className="relative">
              <MapPin className={iconClass} size={14} />
              <input
                type="text"
                placeholder="Payee address"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className={inputBase}
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
                value={form.tin}
                onChange={(e) => handleChange("tin", e.target.value)}
                className={`${inputBase} font-mono`}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="col-span-12 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1 mb-0.5" />

          {/* Row 3: Financials */}
          <div className="col-span-6 md:col-span-3">
            <label className={labelClass}>O.R./C.I./S.I.</label>
            <div className="relative">
              <Hash className={iconClass} size={14} />
              <input
                type="text"
                placeholder="Receipt / Invoice #"
                value={form.or_ci_si}
                onChange={(e) => handleChange("or_ci_si", e.target.value)}
                className={`${inputBase} font-mono`}
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-9">
            <label className={labelClass}>Proof Documents (one per line)</label>
            <textarea
              rows={2}
              placeholder="Receipt #12345 | https://..."
              value={form.proof_documents_text || ""}
              onChange={(e) =>
                handleChange("proof_documents_text", e.target.value)
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
                  } ${isUploadingProof ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {isUploadingProof ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {isUploadingProof ? "Uploading..." : "Attach Files"}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={isUploadingProof}
                    onChange={handleProofUpload}
                  />
                </label>
                <span className="text-[11px] text-gray-500">
                  Upload adds link entries automatically.
                </span>
              </div>

              <div
                className={`mt-2 rounded-md border px-3 py-2 ${
                  isDarkMode
                    ? "bg-stone-800/40 border-gray-700"
                    : "bg-stone-50 border-gray-200"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Read-only Preview
                </p>
                {proofDocumentsPreview.length === 0 ? (
                  <p className="text-xs text-gray-500">No proof documents entered.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {proofDocumentsPreview.map((doc, index) => {
                      const isUrl = /^https?:\/\//i.test(doc.reference);
                      return (
                        <li
                          key={`${doc.label}-${index}`}
                          className={`rounded border px-2.5 py-1.5 ${
                            isDarkMode
                              ? "bg-stone-900 border-gray-700"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <p
                            className={`text-[11px] font-semibold ${
                              isDarkMode ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {doc.label}
                          </p>
                          {isUrl ? (
                            <a
                              href={doc.reference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] break-all underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              {doc.reference}
                            </a>
                          ) : (
                            <p
                              className={`text-[11px] break-all ${
                                isDarkMode ? "text-gray-300" : "text-gray-600"
                              }`}
                            >
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

          <div className="col-span-6 md:col-span-3">
            <label className="block text-[10px] font-bold uppercase text-blue-500 mb-1 tracking-wider">
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
                value={form.vat_amount}
                onChange={(e) => handleChange("vat_amount", e.target.value)}
                className={`${inputBase} pl-6 text-right font-mono font-medium ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
          </div>

          <div className="col-span-6 md:col-span-3">
            <label className="block text-[10px] font-bold uppercase text-purple-500 mb-1 tracking-wider">
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
                value={form.non_vat_amount}
                onChange={(e) => handleChange("non_vat_amount", e.target.value)}
                className={`${inputBase} pl-6 text-right font-mono font-medium ${
                  isDarkMode ? "text-purple-400" : "text-purple-600"
                }`}
              />
            </div>
          </div>

          <div className="col-span-6 md:col-span-3">
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 text-right tracking-wider">
              Total
            </label>
            <div
              className={`flex items-center justify-end h-9 px-3 rounded-md border ${
                isDarkMode
                  ? "bg-stone-800/50 border-gray-700"
                  : "bg-stone-50 border-gray-200"
              }`}
            >
              <span
                className={`font-mono font-bold text-xs ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                ₱
                {entryTotal.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Voucher sync note — only for voucher-sourced expenses */}
          {isVoucherExpense && (
            <div className="col-span-12">
              <div
                className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
                  isDarkMode
                    ? "bg-yellow-900/10 border-yellow-800/50 text-yellow-400"
                    : "bg-yellow-50 border-yellow-200 text-yellow-700"
                }`}
              >
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Voucher sync:</strong> When you save, the matching
                  line item on voucher{" "}
                  <span className="font-mono font-bold">
                    {sourceVoucherNumber}
                  </span>{" "}
                  will be updated to reflect the new amounts and description.
                  The voucher header totals will also be recalculated.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className={`px-5 py-4 border-t flex justify-end gap-2 rounded-b-2xl ${
            isDarkMode
              ? "border-gray-700 bg-stone-900"
              : "border-gray-300 bg-white"
          }`}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? "bg-stone-800 hover:bg-stone-700 text-white"
                : "bg-stone-100 hover:bg-stone-200 text-gray-700"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isVoucherExpense ? "Saving & Syncing…" : "Saving…"}
              </>
            ) : (
              <>
                <Save size={16} />
                {isVoucherExpense ? "Save & Sync to Voucher" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}