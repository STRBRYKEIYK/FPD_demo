import React, { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Wallet,
  X,
  AlertCircle,
  CheckCircle2,
  SplitSquareHorizontal,
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import apiService from "../../../../utils/api/api-service";
import { ToastContainer } from "../main_ui/Toast";
import { useToast } from "../../hooks/useToast";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUTOFF_PERIODS = ["1st", "2nd"];
const today = () => new Date().toISOString().slice(0, 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createLineItem() {
  return { id: `li-${Date.now()}-${Math.random()}`, label: "", amount: "" };
}

function createEmptyEntry() {
  return {
    id: `pc-${Date.now()}-${Math.random()}`,
    cutoff_date: today(),
    cutoff_period: "1st",
    gross_payroll: "",
    adjustment_cash: "",
    petty_cash_replenishment: "50000",
    canteen: "7000",
    monthly_bills_total: "",
    additional_fees: [],
    reimbursements: [],
    remarks: "",
    expanded: true,
  };
}

function mapRecordToEntry(record = {}) {
  return {
    id: `pc-${record.id || Date.now()}-${Math.random()}`,
    cutoff_date: record.cutoff_date || today(),
    cutoff_period: record.cutoff_period || "1st",
    gross_payroll: String(record.gross_payroll || record.gross_payroll_total || ""),
    adjustment_cash: String(record.adjustment_cash || ""),
    petty_cash_replenishment: String(record.petty_cash_replenishment || "50000"),
    canteen: String(record.canteen || "7000"),
    monthly_bills_total: String(record.monthly_bills_total || ""),
    additional_fees: (record.additional_fees || []).map((f) => ({
      id: `li-${f.id || Date.now()}-${Math.random()}`,
      label: f.label || "",
      amount: String(f.amount || ""),
    })),
    reimbursements: (record.reimbursements || []).map((r) => ({
      id: `li-${r.id || Date.now()}-${Math.random()}`,
      label: r.label || "",
      amount: String(r.amount || ""),
    })),
    remarks: record.remarks || "",
    expanded: true,
  };
}

function compute(entry) {
  const gross = Number(entry.gross_payroll || 0);
  const adjustment = Number(entry.adjustment_cash || 0);
  const petty = Number(entry.petty_cash_replenishment || 50000);
  const canteen = Number(entry.canteen || 7000);
  const monthlyBills = Number(entry.monthly_bills_total || 0);
  const fees = (entry.additional_fees || []).reduce((s, f) => s + Number(f.amount || 0), 0);
  const reimbursements = (entry.reimbursements || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const adjustedGross = gross + fees + adjustment;
  const totalCashNeeded = adjustedGross + petty + canteen + monthlyBills + reimbursements;
  return { gross, adjustment, petty, canteen, monthlyBills, fees, reimbursements, adjustedGross, totalCashNeeded };
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isEntryValid(entry) {
  return entry.cutoff_date && entry.cutoff_period && Number(entry.gross_payroll) > 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children, isDarkMode }) {
  return (
    <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, placeholder = "0.00", isDarkMode, className = "" }) {
  const base = isDarkMode
    ? "bg-stone-900 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
    : "bg-stone-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20";
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${base} ${className}`}
    />
  );
}

function FetchButton({ onClick, loading, label, loadingLabel, variant = "blue", isDarkMode }) {
  const styles = {
    blue: isDarkMode
      ? "bg-gray-500/10 text-blue-400 hover:bg-gray-500/20 border-blue-500/20"
      : "bg-gray-50 text-blue-600 hover:bg-gray-100 border-blue-200",
    rose: isDarkMode
      ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20"
      : "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-50 ${styles[variant]}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      {loading ? loadingLabel : label}
    </button>
  );
}

function LineItemsEditor({ items, onChange, isDarkMode, labelPlaceholder = "Description" }) {
  const inputBase = isDarkMode
    ? "bg-stone-900 border-gray-700 text-gray-100 focus:border-blue-500"
    : "bg-stone-50 border-gray-200 text-gray-900 focus:border-blue-500";

  const addRow = () => onChange([...(items || []), createLineItem()]);
  const removeRow = (id) => onChange((items || []).filter((i) => i.id !== id));
  const updateRow = (id, field, value) =>
    onChange((items || []).map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  return (
    <div className="space-y-2">
      {(items || []).map((item, idx) => (
        <div key={item.id} className="flex gap-2 items-center">
          <span className={`text-xs font-mono w-5 text-center shrink-0 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
            {idx + 1}
          </span>
          <input
            type="text"
            placeholder={labelPlaceholder}
            value={item.label}
            onChange={(e) => updateRow(item.id, "label", e.target.value)}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputBase}`}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={item.amount}
            onChange={(e) => updateRow(item.id, "amount", e.target.value)}
            className={`w-32 px-3 py-2 text-sm rounded-lg border outline-none transition-all text-right ${inputBase}`}
          />
          <button
            type="button"
            onClick={() => removeRow(item.id)}
            className={`p-1.5 rounded-md transition-colors shrink-0 ${isDarkMode ? "text-gray-600 hover:text-red-400 hover:bg-red-500/10" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-dashed ${
          isDarkMode
            ? "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400 hover:bg-stone-800/50"
            : "border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-stone-50"
        }`}
      >
        <Plus size={12} /> Add Row
      </button>
    </div>
  );
}

function BreakdownRow({ label, value, isDarkMode, highlight = false, muted = false }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight ? `border-t mt-1 pt-2.5 ${isDarkMode ? "border-gray-700" : "border-gray-200"}` : ""}`}>
      <span className={`text-xs ${highlight ? `font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}` : muted ? (isDarkMode ? "text-gray-600" : "text-gray-400") : (isDarkMode ? "text-gray-400" : "text-gray-500")}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${highlight ? `font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}` : isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
        ₱ {fmt(value)}
      </span>
    </div>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  index,
  isDarkMode,
  editMode,
  isFetchingGross,
  isFetchingBills,
  onUpdate,
  onSetItems,
  onFetchGross,
  onFetchBills,
  onRemove,
  onToggle,
}) {
  const totals = compute(entry);
  const valid = isEntryValid(entry);

  const borderCol = isDarkMode ? "border-gray-800" : "border-gray-200";
  const bgCard = isDarkMode ? "bg-stone-900" : "bg-white";
  const bgSubtle = isDarkMode ? "bg-stone-800/50" : "bg-stone-50";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";
  const inputBase = isDarkMode
    ? "bg-stone-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
    : "bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20";

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${bgCard} ${borderCol} ${entry.expanded ? "shadow-sm" : ""}`}>

      {/* ── Card Header ── */}
      <button
        type="button"
        onClick={() => onToggle(entry.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isDarkMode ? "hover:bg-stone-800/50" : "hover:bg-stone-50"}`}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${valid ? "bg-emerald-500" : "bg-amber-400"}`} />

        {/* Entry label */}
        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${isDarkMode ? "bg-stone-800 text-blue-400" : "bg-gray-50 text-blue-600"}`}>
          #{String(index + 1).padStart(2, "0")}
        </span>

        {/* Summary info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>
            {entry.cutoff_date || "No date"} · <span className={`${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{entry.cutoff_period} Cutoff</span>
          </span>
          {Number(entry.gross_payroll) > 0 && (
            <span className={`text-xs hidden sm:inline ${textSecondary}`}>
              Gross: <span className={`font-mono font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>₱ {fmt(totals.adjustedGross)}</span>
            </span>
          )}
          {totals.totalCashNeeded > 0 && (
            <span className={`ml-auto text-xs font-bold font-mono ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
              ₱ {fmt(totals.totalCashNeeded)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!editMode && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              onKeyDown={(e) => e.key === "Enter" && onRemove(entry.id)}
              className={`p-1.5 rounded-md transition-colors ${isDarkMode ? "text-gray-600 hover:text-red-400 hover:bg-red-500/10" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
            >
              <Trash2 size={14} />
            </span>
          )}
          <span className={`p-1.5 rounded-md ${textSecondary}`}>
            {entry.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {/* ── Expanded Body ── */}
      {entry.expanded && (
        <div className={`border-t ${borderCol}`}>
          <div
            className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x"
            style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}
          >
            {/* Left: Inputs (3 cols) */}
            <div className="lg:col-span-3 p-4 space-y-5">

              {/* Row 1: Date + Period + Adjustment */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                  Cutoff Info
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <FieldLabel isDarkMode={isDarkMode}>
                      <Calendar size={10} className="inline mr-1" />Cutoff Date
                    </FieldLabel>
                    <input
                      type="date"
                      value={entry.cutoff_date}
                      onChange={(e) => onUpdate(entry.id, { cutoff_date: e.target.value })}
                      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputBase}`}
                    />
                  </div>
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>Period</FieldLabel>
                    <div className={`flex rounded-lg border overflow-hidden ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                      {CUTOFF_PERIODS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onUpdate(entry.id, { cutoff_period: p })}
                          className={`flex-1 py-2 text-xs font-bold transition-colors ${
                            entry.cutoff_period === p
                              ? "bg-gray-600 text-white"
                              : isDarkMode
                              ? "bg-stone-800 text-gray-400 hover:bg-stone-700"
                              : "bg-white text-gray-500 hover:bg-stone-50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>Adj. Cash</FieldLabel>
                    <NumberInput
                      value={entry.adjustment_cash}
                      onChange={(e) => onUpdate(entry.id, { adjustment_cash: e.target.value })}
                      isDarkMode={isDarkMode}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Gross Payroll */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                  Payroll
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>
                      <Banknote size={10} className="inline mr-1" />Monthly Gross Payroll
                    </FieldLabel>
                    <NumberInput
                      value={entry.gross_payroll}
                      onChange={(e) => onUpdate(entry.id, { gross_payroll: e.target.value })}
                      isDarkMode={isDarkMode}
                    />
                    <FetchButton
                      onClick={() => onFetchGross(entry)}
                      loading={isFetchingGross}
                      label="Auto-fill from Payroll"
                      loadingLabel="Fetching…"
                      variant="blue"
                      isDarkMode={isDarkMode}
                    />
                  </div>
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>Monthly Bills</FieldLabel>
                    <NumberInput
                      value={entry.monthly_bills_total}
                      onChange={(e) => onUpdate(entry.id, { monthly_bills_total: e.target.value })}
                      isDarkMode={isDarkMode}
                    />
                    <FetchButton
                      onClick={() => onFetchBills(entry)}
                      loading={isFetchingBills}
                      label="Auto-fill from Bills"
                      loadingLabel="Fetching…"
                      variant="rose"
                      isDarkMode={isDarkMode}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Fixed Costs */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                  Fixed Costs
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>Petty Cash Replenishment</FieldLabel>
                    <NumberInput
                      value={entry.petty_cash_replenishment}
                      onChange={(e) => onUpdate(entry.id, { petty_cash_replenishment: e.target.value })}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                  <div>
                    <FieldLabel isDarkMode={isDarkMode}>Canteen</FieldLabel>
                    <NumberInput
                      value={entry.canteen}
                      onChange={(e) => onUpdate(entry.id, { canteen: e.target.value })}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Additional Fees */}
              <div className={`rounded-lg border p-3 ${isDarkMode ? "border-gray-800 bg-stone-800/30" : "border-gray-100 bg-stone-50"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  Additional Fees
                </p>
                <LineItemsEditor
                  items={entry.additional_fees}
                  onChange={(items) => onSetItems(entry.id, "additional_fees", items)}
                  isDarkMode={isDarkMode}
                  labelPlaceholder="Fee description"
                />
              </div>

              {/* Row 5: Reimbursements */}
              <div className={`rounded-lg border p-3 ${isDarkMode ? "border-gray-800 bg-stone-800/30" : "border-gray-100 bg-stone-50"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  Reimbursements
                </p>
                <LineItemsEditor
                  items={entry.reimbursements}
                  onChange={(items) => onSetItems(entry.id, "reimbursements", items)}
                  isDarkMode={isDarkMode}
                  labelPlaceholder="Reimbursement description"
                />
              </div>

              {/* Remarks */}
              <div>
                <FieldLabel isDarkMode={isDarkMode}>
                  <FileText size={10} className="inline mr-1" />Remarks
                </FieldLabel>
                <textarea
                  rows={2}
                  value={entry.remarks}
                  onChange={(e) => onUpdate(entry.id, { remarks: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all resize-none ${inputBase}`}
                  placeholder="Optional notes…"
                />
              </div>
            </div>

            {/* Right: Breakdown (2 cols) */}
            <div className={`lg:col-span-2 p-4 ${bgSubtle}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                Cash Breakdown
              </p>

              <div className={`rounded-lg border p-3 space-y-0.5 ${isDarkMode ? "bg-stone-900 border-gray-700" : "bg-white border-gray-200"}`}>
                <BreakdownRow label="Gross Payroll" value={totals.gross} isDarkMode={isDarkMode} />
                {totals.adjustment !== 0 && (
                  <BreakdownRow label="± Adjustment Cash" value={totals.adjustment} isDarkMode={isDarkMode} />
                )}
                {totals.fees > 0 && (
                  <BreakdownRow label="+ Additional Fees" value={totals.fees} isDarkMode={isDarkMode} />
                )}
                <div className={`border-t my-1 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`} />
                <BreakdownRow label="Adjusted Gross (Cash & Coins)" value={totals.adjustedGross} isDarkMode={isDarkMode} />
                <div className={`border-t my-1 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`} />
                <BreakdownRow label="Petty Cash Replenishment" value={totals.petty} isDarkMode={isDarkMode} muted />
                <BreakdownRow label="Canteen" value={totals.canteen} isDarkMode={isDarkMode} muted />
                <BreakdownRow label="Monthly Bills" value={totals.monthlyBills} isDarkMode={isDarkMode} muted />
                <BreakdownRow label="Reimbursements" value={totals.reimbursements} isDarkMode={isDarkMode} muted />

                <div className={`border-t mt-1 pt-2 ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                    Reimbursement Details
                  </p>
                  {(entry.reimbursements || []).length > 0 ? (
                    <div className="space-y-1">
                      {(entry.reimbursements || []).map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs">
                          <span className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                            {r.label || "(No label)"}
                          </span>
                          <span className={`font-mono font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                            ₱ {fmt(r.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                      No reimbursement items.
                    </p>
                  )}
                </div>
              </div>

              <div className={`rounded-lg border p-3 mt-3 space-y-0.5 ${isDarkMode ? "bg-stone-900 border-gray-700" : "bg-white border-gray-200"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  Totals
                </p>
                <BreakdownRow label="Adjusted Gross Pay" value={totals.adjustedGross} isDarkMode={isDarkMode} />
                <BreakdownRow label="Reimbursements" value={totals.reimbursements} isDarkMode={isDarkMode} />
                <BreakdownRow label="TOTAL CASH NEEDED" value={totals.totalCashNeeded} isDarkMode={isDarkMode} highlight />
              </div>

              {/* Validation hint */}
              <div className={`mt-3 flex items-center gap-2 text-xs ${valid ? (isDarkMode ? "text-emerald-500" : "text-emerald-600") : (isDarkMode ? "text-amber-500" : "text-amber-600")}`}>
                {valid
                  ? <><CheckCircle2 size={13} /> Entry is complete</>
                  : <><AlertCircle size={13} /> Fill date, period & gross pay</>
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function PayrollCheckingBulkCreator({
  isOpen,
  onClose,
  onSubmit,
  isDarkMode: propIsDarkMode,
  editMode = false,
  initialData = null,
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== "undefined" ? propIsDarkMode : authIsDarkMode;
  const { toasts, showError, showWarning, removeToast } = useToast();

  const [entries, setEntries] = useState(() =>
    editMode && initialData ? [mapRecordToEntry(initialData)] : [createEmptyEntry()]
  );
  const [saving, setSaving] = useState(false);
  const [fetchingGrossById, setFetchingGrossById] = useState({});
  const [fetchingBillsById, setFetchingBillsById] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (editMode && initialData) {
      setEntries([mapRecordToEntry(initialData)]);
      return;
    }
    setEntries([createEmptyEntry()]);
  }, [isOpen, editMode, initialData?.id]);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const totalCashAll = entries.reduce((s, e) => s + compute(e).totalCashNeeded, 0);
  const allValid = entries.every(isEntryValid);
  const validCount = entries.filter(isEntryValid).length;

  const borderCol = isDarkMode ? "border-gray-800" : "border-gray-200";
  const bgBase = isDarkMode ? "bg-stone-950" : "bg-stone-50";
  const bgCard = isDarkMode ? "bg-stone-900" : "bg-white";
  const textPrimary = isDarkMode ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-gray-400" : "text-gray-500";

  const updateEntry = (id, updates) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

  const setEntryItems = (id, key, items) => updateEntry(id, { [key]: items });

  const toggleExpanded = (id) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)));

  const collapseAll = () => setEntries((prev) => prev.map((e) => ({ ...e, expanded: false })));
  const expandAll = () => setEntries((prev) => prev.map((e) => ({ ...e, expanded: true })));

  const fetchGross = async (entry) => {
    if (!entry.cutoff_date || !entry.cutoff_period) return;
    const period = String(entry.cutoff_date).slice(0, 7);
    const cutoff = entry.cutoff_period === "1st" ? 15 : 30;
    setFetchingGrossById((p) => ({ ...p, [entry.id]: true }));
    try {
      const res = await apiService.payroll.getPayrollRecords({ period, cutoff, limit: 5000, offset: 0 });
      const rows = res?.data || [];
      const grossTotal = rows.reduce((sum, row) => sum + Number(row?.earnings?.grossPay || 0), 0);
      updateEntry(entry.id, { gross_payroll: String(Number(grossTotal.toFixed(2))) });
    } catch (err) {
      console.error("Failed to pull gross payroll from Payroll Masterlist.", err);
      showError?.("Failed to pull gross payroll from Payroll Masterlist.");
    } finally {
      setFetchingGrossById((p) => ({ ...p, [entry.id]: false }));
    }
  };

  const fetchBills = async (entry) => {
    if (!entry.cutoff_date || !entry.cutoff_period) return;
    setFetchingBillsById((p) => ({ ...p, [entry.id]: true }));
    try {
      const d = new Date(`${entry.cutoff_date}T00:00:00`);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const bills = await apiService.monthlyBills.getMonthlyBills({ year });
      const target = (bills || []).find((b) => Number(b.month) === month && Number(b.year) === year);
      let total = 0;
      if (target?.id) {
        const detail = await apiService.monthlyBills.getBillBreakdown(target.id);
        const items = detail?.items || [];
        total = items.reduce((sum, item) => {
          const due = item?.due_date;
          if (!due) return sum;
          const day = new Date(`${due}T00:00:00`).getDate();
          const include = entry.cutoff_period === "1st" ? day <= 15 : day > 15;
          return include ? sum + Number(item.amount || 0) : sum;
        }, 0);
        if (total <= 0) {
          total = Number(detail?.totals?.net_total || target?.net_total || target?.total_amount || 0) / 2;
        }
      }
      updateEntry(entry.id, { monthly_bills_total: String(Number((total || 0).toFixed(2))) });
    } catch (err) {
      console.error("Failed to auto-fill monthly bills for this cutoff.", err);
      showError?.("Failed to auto-fill monthly bills for this cutoff.");
    } finally {
      setFetchingBillsById((p) => ({ ...p, [entry.id]: false }));
    }
  };

  const addEntry = () => {
    setEntries((prev) => {
      const newEntries = prev.map((e) => ({ ...e, expanded: false }));
      return [...newEntries, createEmptyEntry()];
    });
  };

  const removeEntry = (id) => {
    if (entries.length === 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    const mapped = entries.map((entry) => ({
      cutoff_date: entry.cutoff_date,
      cutoff_period: entry.cutoff_period,
      gross_payroll: Number(entry.gross_payroll || 0),
      adjustment_cash: Number(entry.adjustment_cash || 0),
      petty_cash_replenishment: Number(entry.petty_cash_replenishment || 50000),
      canteen: Number(entry.canteen || 7000),
      monthly_bills_total: Number(entry.monthly_bills_total || 0),
      additional_fees: (entry.additional_fees || [])
        .filter((f) => f.label && Number(f.amount) > 0)
        .map((f) => ({ label: f.label, amount: Number(f.amount) })),
      reimbursements: (entry.reimbursements || [])
        .filter((r) => r.label && Number(r.amount) > 0)
        .map((r) => ({ label: r.label, amount: Number(r.amount) })),
      remarks: entry.remarks || "",
    }));

    const invalid = mapped.find((item) => !item.cutoff_date || !item.cutoff_period || item.gross_payroll <= 0);
    if (invalid) {
      showWarning?.("Please provide cutoff date, period, and a valid gross payroll for all entries.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(editMode ? mapped[0] : mapped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div
        className={`w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase}`}
      >
        {/* ── Header ── */}
        <div className={`px-5 py-3.5 border-b ${borderCol} ${bgCard} flex items-center gap-4 shrink-0`}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-gray-500/10" : "bg-gray-50"}`}>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold ${textPrimary} leading-tight`}>
                {editMode ? "Edit Payroll Checking" : "Bulk Create — Payroll Checking"}
              </h2>
              <p className={`text-xs ${textSecondary} leading-tight`}>
                {entries.length} {entries.length === 1 ? "entry" : "entries"} · {validCount}/{entries.length} valid
              </p>
            </div>
          </div>

          {/* Global totals */}
          {!editMode && entries.length > 1 && (
            <div className={`hidden sm:flex flex-col items-end px-3 py-1.5 rounded-lg ${isDarkMode ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? "text-emerald-600" : "text-emerald-600"}`}>
                Grand Total
              </span>
              <span className={`text-sm font-bold font-mono ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                ₱ {fmt(totalCashAll)}
              </span>
            </div>
          )}

          {/* Collapse/Expand + actions */}
          <div className="flex items-center gap-1.5">
            {!editMode && entries.length > 1 && (
              <div className={`hidden sm:flex items-center rounded-lg border overflow-hidden ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                <button
                  onClick={expandAll}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${isDarkMode ? "text-gray-400 hover:bg-stone-800" : "text-gray-500 hover:bg-stone-50"}`}
                >
                  Expand All
                </button>
                <div className={`w-px h-4 ${isDarkMode ? "bg-stone-700" : "bg-stone-200"}`} />
                <button
                  onClick={collapseAll}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${isDarkMode ? "text-gray-400 hover:bg-stone-800" : "text-gray-500 hover:bg-stone-50"}`}
                >
                  Collapse All
                </button>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !allValid}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-600/50 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-blue-500/20"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {editMode ? "Update" : "Save All"}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-stone-800 text-gray-500" : "hover:bg-stone-100 text-gray-400"}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Validation banner ── */}
        {!allValid && (
          <div className={`px-5 py-2 flex items-center gap-2 text-xs border-b ${isDarkMode ? "bg-amber-500/5 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            <AlertCircle size={12} />
            {entries.length - validCount} {entries.length - validCount === 1 ? "entry is" : "entries are"} incomplete — fill in cutoff date, period, and gross payroll to save.
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={index}
              isDarkMode={isDarkMode}
              editMode={editMode}
              isFetchingGross={!!fetchingGrossById[entry.id]}
              isFetchingBills={!!fetchingBillsById[entry.id]}
              onUpdate={updateEntry}
              onSetItems={setEntryItems}
              onFetchGross={fetchGross}
              onFetchBills={fetchBills}
              onRemove={removeEntry}
              onToggle={toggleExpanded}
            />
          ))}

          {!editMode && (
            <button
              onClick={addEntry}
              className={`w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                isDarkMode
                  ? "border-gray-800 hover:border-gray-700 text-gray-600 hover:text-gray-400 hover:bg-stone-900/50"
                  : "border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600 hover:bg-white"
              }`}
            >
              <Plus size={16} /> Add Another Checking Record
            </button>
          )}
        </div>

        {/* ── Footer (mobile grand total) ── */}
        {!editMode && entries.length > 1 && (
          <div className={`sm:hidden px-5 py-3 border-t ${borderCol} ${bgCard} flex items-center justify-between`}>
            <span className={`text-xs font-semibold ${textSecondary}`}>Grand Total</span>
            <span className={`text-sm font-bold font-mono ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
              ₱ {fmt(totalCashAll)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}