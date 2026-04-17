import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Save, ChevronDown, ChevronRight,
  Trash2, FileText, Hash, DollarSign, Calendar,
  User, Tag, ReceiptText
} from "lucide-react";
import apiService from "../../../../utils/api/api-service";
import { useAuth } from "../../../../contexts/AuthContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatInvoiceNumber = (num) => String(num).padStart(6, "0");

const getQuarterFromDate = (dateString) => {
  if (!dateString) return "Q1";
  const month = new Date(dateString).getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
};

const calculateVATBreakdown = (totalAmount, saleType) => {
  const total = parseFloat(totalAmount) || 0;
  if (saleType === "vatable") {
    const vatableSales = total / 1.12;
    const vatAmount = vatableSales * 0.12;
    return {
      total_amount: total.toFixed(2),
      vatable_sales: vatableSales.toFixed(2),
      vat_amount: vatAmount.toFixed(2),
      zero_rated_sales: "0.00",
      vat_exempt_sales: "0.00",
    };
  }
  return {
    total_amount: total.toFixed(2),
    vatable_sales: "0.00",
    vat_amount: "0.00",
    zero_rated_sales: total.toFixed(2),
    vat_exempt_sales: "0.00",
  };
};

// ─── Empty factory ───────────────────────────────────────────────────────────

function createEmptyInvoice(seedNumber = "") {
  return {
    id: `inv-${Date.now()}-${Math.random()}`,
    invoice_number: seedNumber,
    invoice_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    customer_name: "",
    is_new_customer: false,
    total_amount: "",
    sale_type: "vatable",
    quarter: getQuarterFromDate(new Date().toISOString().split("T")[0]),
    remarks: "",
    expanded: true,
    // validation
    numberStatus: "idle", // idle | checking | valid | invalid
    numberMessage: "",
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SalesInvoiceBulkCreator({
  isOpen,
  onClose,
  onSubmit,
  customers = [],
  isDarkMode: propIsDarkMode,
  createdBy,
  initialDraft = null,
  initialDrafts = [],
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== "undefined" ? propIsDarkMode : authIsDarkMode;

  const [invoices, setInvoices] = useState([createEmptyInvoice()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const modalRef = useRef(null);

  // Esc to close
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      if (Array.isArray(initialDrafts) && initialDrafts.length > 0) {
        setInvoices(
          initialDrafts.map((draft) => ({
            ...createEmptyInvoice(),
            ...draft,
            id: `inv-${Date.now()}-${Math.random()}`,
          })),
        );
      } else if (initialDraft) {
        setInvoices([
          {
            ...createEmptyInvoice(),
            ...initialDraft,
          },
        ]);
      } else {
        setInvoices([createEmptyInvoice()]);
      }
      setSaveError("");
    }
  }, [isOpen, initialDraft, initialDrafts]);

  if (!isOpen) return null;

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totals = invoices.reduce(
    (acc, inv) => {
      const bd = calculateVATBreakdown(inv.total_amount, inv.sale_type);
      acc.grand += parseFloat(bd.total_amount) || 0;
      acc.vat += parseFloat(bd.vat_amount) || 0;
      acc.zero += parseFloat(bd.zero_rated_sales) || 0;
      return acc;
    },
    { grand: 0, vat: 0, zero: 0 }
  );

  // ── Invoice number validation (debounced per card) ────────────────────────
  const validateNumber = async (localId, rawNum) => {
    if (!rawNum) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === localId
            ? { ...inv, numberStatus: "idle", numberMessage: "" }
            : inv
        )
      );
      return;
    }
    const formatted = formatInvoiceNumber(rawNum);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === localId
          ? { ...inv, numberStatus: "checking", numberMessage: "Checking…" }
          : inv
      )
    );

    try {
      // First check the fully formatted (padded) number
      const resFormatted = await apiService.finance.request(
        `/api/finance-payroll/invoices/validate-number?number=${formatted}`
      );

      if (resFormatted?.available === false) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === localId
              ? {
                  ...inv,
                  numberStatus: "invalid",
                  numberMessage: `✗ ${formatted} already exists`,
                }
              : inv
          )
        );
        return;
      }

      // Also check the unpadded/raw number in case backend stored it without leading zeros
      const resRaw = await apiService.finance.request(
        `/api/finance-payroll/invoices/validate-number?number=${rawNum}`
      );

      if (resRaw?.available === false) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === localId
              ? {
                  ...inv,
                  numberStatus: "invalid",
                  numberMessage: `✗ Conflicts with existing ${formatInvoiceNumber(rawNum)}`,
                }
              : inv
          )
        );
        return;
      }

      // If neither check reported the number as taken, mark as valid
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === localId
            ? {
                ...inv,
                numberStatus: "valid",
                numberMessage: `✓ Will save as ${formatted}`,
              }
            : inv
        )
      );
    } catch {
      // If validation endpoint is missing or fails, fall back to optimistic valid state
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === localId
            ? { ...inv, numberStatus: "valid", numberMessage: `Will save as ${formatted}` }
            : inv
        )
      );
    }
  };

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const updateInvoice = (localId, updates) =>
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === localId ? { ...inv, ...updates } : inv))
    );

  const addInvoice = (count = 1) => {
    const last = invoices[invoices.length - 1];
    const lastNum = parseInt(last?.invoice_number || "0", 10);
    setInvoices((prev) => [
      ...prev,
      ...Array.from({ length: count }, (_, i) =>
        createEmptyInvoice(
          lastNum ? String(lastNum + i + 1) : ""
        )
      ),
    ]);
  };

  const deleteInvoice = (localId) => {
    if (invoices.length === 1) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== localId));
  };

  const toggleExpanded = (localId) =>
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === localId ? { ...inv, expanded: !inv.expanded } : inv
      )
    );

  // ── Save all ──────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaveError("");

    // Validate
    for (const inv of invoices) {
      if (!inv.invoice_number) {
        setSaveError("All invoices must have an invoice number.");
        return;
      }
      if (!inv.invoice_date) {
        setSaveError("All invoices must have a date.");
        return;
      }
      if (!inv.customer_id && !inv.customer_name.trim()) {
        setSaveError("All invoices must have a customer.");
        return;
      }
      if (!inv.total_amount || parseFloat(inv.total_amount) <= 0) {
        setSaveError("All invoices must have a total amount greater than 0.");
        return;
      }
      if (inv.numberStatus === "invalid") {
        setSaveError(`Invoice number ${formatInvoiceNumber(inv.invoice_number)} already exists.`);
        return;
      }
    }

    // Check for duplicate numbers within this batch
    const nums = invoices.map((inv) => formatInvoiceNumber(inv.invoice_number));
    if (new Set(nums).size !== nums.length) {
      setSaveError("Duplicate invoice numbers within this batch.");
      return;
    }

    setIsSaving(true);
    try {
      for (const inv of invoices) {
        const bd = calculateVATBreakdown(inv.total_amount, inv.sale_type);
        const submitData = {
          invoice_number: formatInvoiceNumber(inv.invoice_number),
          invoice_date: inv.invoice_date,
          customer_id: inv.is_new_customer ? null : inv.customer_id || null,
          customer_name: inv.customer_name.trim(),
          quarter: inv.quarter,
          sale_type: inv.sale_type,
          remarks: inv.remarks || "",
          is_new_customer: inv.is_new_customer,
          account_receivables: parseFloat(bd.total_amount),
          vatable_sales: parseFloat(bd.vatable_sales),
          vat_amount: parseFloat(bd.vat_amount),
          zero_rated_sales: parseFloat(bd.zero_rated_sales),
          vat_exempt_sales: parseFloat(bd.vat_exempt_sales),
          total_amount: parseFloat(bd.total_amount),
          created_by: createdBy,
        };
        await onSubmit(submitData);
      }
      onClose();
    } catch (err) {
      setSaveError(err?.message || "Failed to save invoices.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg = isDarkMode ? "bg-stone-950" : "bg-stone-100";
  const card = isDarkMode ? "bg-stone-900" : "bg-white";
  const border = isDarkMode ? "border-gray-800" : "border-gray-200";
  const textPrimary = isDarkMode ? "text-gray-100" : "text-gray-900";
  const textSub = isDarkMode ? "text-gray-400" : "text-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <div
        ref={modalRef}
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${border} ${bg}`}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className={`sticky top-0 z-20 px-6 py-4 border-b ${border} ${card} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}
        >
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <ReceiptText className="w-5 h-5 text-emerald-500" />
              Bulk Create Sales Invoices
            </h2>
            <div className={`mt-1 flex flex-wrap items-center gap-3 text-xs ${textSub}`}>
              <span>
                Invoices:{" "}
                <strong className={textPrimary}>{invoices.length}</strong>
              </span>
              <span className="hidden sm:inline">|</span>
              <span>
                VAT:{" "}
                <strong className="text-emerald-500">
                  ₱{totals.vat.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </strong>
              </span>
              <span>
                Zero-Rated:{" "}
                <strong className="text-blue-500">
                  ₱{totals.zero.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </strong>
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                Total:{" "}
                <strong>
                  ₱{totals.grand.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} /> {isSaving ? "Saving…" : "Save All"}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? "hover:bg-stone-800 text-gray-400"
                  : "hover:bg-stone-200 text-gray-500"
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {saveError && (
          <div className="mx-4 mt-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span>⚠</span> {saveError}
          </div>
        )}

        {/* ── Scrollable list ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {invoices.map((invoice, index) => (
            <InvoiceCard
              key={invoice.id}
              index={index}
              invoice={invoice}
              customers={customers}
              isDarkMode={isDarkMode}
              onUpdate={(updates) => updateInvoice(invoice.id, updates)}
              onDelete={() => deleteInvoice(invoice.id)}
              onToggle={() => toggleExpanded(invoice.id)}
              onValidateNumber={(raw) => validateNumber(invoice.id, raw)}
            />
          ))}

          <button
            onClick={() => addInvoice(1)}
            className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all opacity-60 hover:opacity-100 ${
              isDarkMode
                ? "border-gray-800 hover:border-gray-700 text-gray-400 hover:bg-stone-900"
                : "border-gray-300 hover:border-gray-400 text-gray-500 hover:bg-white"
            }`}
          >
            <Plus size={20} /> Add Another Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  index,
  customers,
  isDarkMode,
  onUpdate,
  onDelete,
  onToggle,
  onValidateNumber,
}) {
  const debounceRef = useRef(null);

  const bd = calculateVATBreakdown(invoice.total_amount, invoice.sale_type);
  const total = parseFloat(bd.total_amount) || 0;

  // Theme
  const cardBg = isDarkMode ? "bg-stone-900" : "bg-white";
  const borderCol = isDarkMode ? "border-gray-800" : "border-gray-200";
  const inputCls = `w-full bg-transparent px-2 py-1.5 rounded-lg text-sm border transition-all outline-none ${
    isDarkMode
      ? "border-gray-700 focus:border-emerald-500 text-white placeholder-gray-600"
      : "border-gray-300 focus:border-emerald-500 text-gray-900 placeholder-gray-400"
  }`;
  const labelCls = `block text-xs font-medium mb-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`;
  const iconCls = isDarkMode ? "text-gray-500" : "text-gray-400";

  const handleNumberChange = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    onUpdate({ invoice_number: digits, numberStatus: "idle", numberMessage: "" });
    clearTimeout(debounceRef.current);
    if (digits) {
      debounceRef.current = setTimeout(() => onValidateNumber(digits), 600);
    }
  };

  const handleDateChange = (date) => {
    onUpdate({ invoice_date: date, quarter: getQuarterFromDate(date) });
  };

  const handleCustomerChange = (customerId) => {
    const cust = customers.find((c) => String(c.id) === String(customerId));
    onUpdate({
      customer_id: customerId,
      customer_name: cust ? cust.customer_name : "",
    });
  };

  const statusColor =
    invoice.numberStatus === "valid"
      ? "text-emerald-500"
      : invoice.numberStatus === "invalid"
      ? "text-red-500"
      : invoice.numberStatus === "checking"
      ? "text-amber-500"
      : isDarkMode ? "text-gray-500" : "text-gray-400";

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 ${cardBg} ${borderCol}`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggle}
              className={`p-1 rounded-md transition-colors ${isDarkMode ? "hover:bg-stone-800" : "hover:bg-stone-100"}`}
            >
              {invoice.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            <div className="flex flex-col leading-tight">
              <span
                className={`text-sm font-mono font-bold px-2 py-1 rounded ${
                  isDarkMode
                    ? "bg-stone-800 text-emerald-400"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {invoice.invoice_number
                  ? formatInvoiceNumber(invoice.invoice_number)
                  : `Invoice #${index + 1}`}
              </span>
              <span className={`text-xs truncate max-w-[220px] mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                {invoice.customer_name || "No customer selected"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <p className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                Total Amount
              </p>
              <p className="text-lg font-bold font-mono text-emerald-500">
                ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={onDelete}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Top fields: invoice number + date + quarter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Invoice Number */}
          <div>
            <label className={labelCls}>Invoice Number *</label>
            <div className="relative">
              <Hash size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
              <input
                type="text"
                value={invoice.invoice_number}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="501"
                className={`${inputCls} pl-7`}
              />
            </div>
            {invoice.numberStatus !== "idle" && (
              <p className={`text-[10px] mt-0.5 ${statusColor}`}>{invoice.numberMessage}</p>
            )}
          </div>

          {/* Invoice Date */}
          <div>
            <label className={labelCls}>Invoice Date *</label>
            <div className="relative">
              <Calendar size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
              <input
                type="date"
                value={invoice.invoice_date}
                onChange={(e) => handleDateChange(e.target.value)}
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>

          {/* Quarter (auto + overridable) */}
          <div>
            <label className={labelCls}>Quarter</label>
            <select
              value={invoice.quarter}
              onChange={(e) => onUpdate({ quarter: e.target.value })}
              className={`${inputCls} appearance-none`}
            >
              <option value="Q1">Q1 (Jan–Mar)</option>
              <option value="Q2">Q2 (Apr–Jun)</option>
              <option value="Q3">Q3 (Jul–Sep)</option>
              <option value="Q4">Q4 (Oct–Dec)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {invoice.expanded && (
        <div className={`border-t ${borderCol} p-4 space-y-4`}>
          {/* Customer */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Customer *</label>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    is_new_customer: !invoice.is_new_customer,
                    customer_id: "",
                    customer_name: "",
                  })
                }
                className={`text-[11px] font-medium ${isDarkMode ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-700"}`}
              >
                {invoice.is_new_customer ? "← Select Existing" : "+ New Customer"}
              </button>
            </div>

            {invoice.is_new_customer ? (
              <div className="relative">
                <User size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
                <input
                  type="text"
                  value={invoice.customer_name}
                  onChange={(e) => onUpdate({ customer_name: e.target.value })}
                  placeholder="Enter new customer name"
                  className={`${inputCls} pl-7`}
                />
              </div>
            ) : (
              <div className="relative">
                <User size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
                <select
                  value={invoice.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className={`${inputCls} pl-7 appearance-none`}
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Amount + Sale Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Amount */}
            <div>
              <label className={labelCls}>Total Amount *</label>
              <div className="relative">
                <DollarSign size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
                <input
                  type="number"
                  value={invoice.total_amount}
                  onChange={(e) => onUpdate({ total_amount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`${inputCls} pl-7 font-mono`}
                />
              </div>
            </div>

            {/* Sale Type toggle */}
            <div>
              <label className={labelCls}>Sale Type *</label>
              <div className="flex gap-2">
                {[
                  { value: "vatable", label: "Vatable", sub: "12% VAT" },
                  { value: "zero-rated", label: "Zero-Rated", sub: "0% VAT" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdate({ sale_type: opt.value })}
                    className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                      invoice.sale_type === opt.value
                        ? isDarkMode
                          ? "border-emerald-500 bg-emerald-900/20 text-emerald-300"
                          : "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : isDarkMode
                        ? "border-gray-700 text-gray-400 hover:border-gray-600"
                        : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="opacity-70 font-normal">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* VAT Breakdown preview */}
          {total > 0 && (
            <div
              className={`rounded-lg p-3 text-xs space-y-1 ${
                isDarkMode
                  ? "bg-stone-800/60 border border-gray-700"
                  : "bg-emerald-50/60 border border-emerald-100"
              }`}
            >
              <p className={`font-semibold mb-1 ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                VAT Breakdown
              </p>
              {invoice.sale_type === "vatable" ? (
                <>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>Vatable Sales</span>
                    <span className={`font-mono ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                      ₱{parseFloat(bd.vatable_sales).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>VAT (12%)</span>
                    <span className={`font-mono ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                      ₱{parseFloat(bd.vat_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>Zero-Rated Sales</span>
                  <span className={`font-mono ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                    ₱{parseFloat(bd.zero_rated_sales).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className={`flex justify-between pt-1 border-t font-semibold ${isDarkMode ? "border-gray-700" : "border-emerald-200"}`}>
                <span>Total</span>
                <span className="font-mono">
                  ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className={labelCls}>Remarks (optional)</label>
            <div className="relative">
              <Tag size={13} className={`absolute left-2 top-2.5 ${iconCls}`} />
              <input
                type="text"
                value={invoice.remarks}
                onChange={(e) => onUpdate({ remarks: e.target.value })}
                placeholder="Notes or remarks…"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}