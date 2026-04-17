import React, { useState, useEffect, useRef } from 'react';
import { FileDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { generateCombinedReport } from '../../../../utils/reports/CombinedReportBuilder';
import apiService from '../../../../utils/api/api-service';

const REPORT_TYPES = [
  { key: 'invoices',      label: 'Sales Invoices',  dataKey: 'invoices' },
  { key: 'cashVouchers',  label: 'Cash Vouchers',   dataKey: 'cashVouchers' },
  { key: 'checkVouchers', label: 'Check Vouchers',  dataKey: 'checkVouchers' },
  { key: 'expenses',      label: 'Expenses',         dataKey: 'expenses' },
  { key: 'pettyCash',     label: 'Petty Cash',       dataKey: 'pettyCash' },
  { key: 'vales',         label: 'Vales',            dataKey: 'vales' },
];

/**
 * CombinedReportExport
 *
 * Drop this anywhere in the FPD dashboard. It fetches data fresh from the API
 * on export so it never shows zero records regardless of what the dashboard
 * summary state looks like.
 *
 * Props (all optional — used only as hints/fallbacks for the record counts):
 *   invoices, cashVouchers, checkVouchers, expenses, pettyCash, vales  – data arrays
 *   dateRange      – { start, end, year, quarter, month }
 *   summaryMetrics – petty cash summary metrics
 *   expensesTarget – target amount for expenses footer (default 12,500,000)
 */
export default function CombinedReportExport({
  dateRange = {},
  summaryMetrics = {},
  expensesTarget = 12500000,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(
    Object.fromEntries(REPORT_TYPES.map(r => [r.key, true]))
  );
  // Live data fetched on mount for accurate count badges + used on export.
  const [liveData, setLiveData] = useState({
    invoices: [], cashVouchers: [], checkVouchers: [], expenses: [], pettyCash: [], vales: [],
  });
  const [countsLoading, setCountsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const safe = (result, extractor) => {
      if (result.status !== 'fulfilled' || !result.value) return [];
      const val = extractor(result.value);
      return Array.isArray(val) ? val : [];
    };
    Promise.allSettled([
      apiService.finance.getInvoices(),
      apiService.finance.getCashVouchers(),
      apiService.finance.getCheckVouchers(),
      apiService.finance.getExpenseLineItems(),
      apiService.finance.getPettyCashVouchers(),
      apiService.finance.getVales(),
    ]).then(([inv, cash, check, exp, pc, val]) => {
      setLiveData({
        invoices:      safe(inv,   r => r.invoices  || r.data || r),
        cashVouchers:  safe(cash,  r => r.vouchers  || r.data || r),
        checkVouchers: safe(check, r => r.vouchers  || r.data || r),
        expenses:      safe(exp,   r => r.data      || r),
        pettyCash:     safe(pc,    r => r.vouchers  || r.data || r),
        vales:         safe(val,   r => r.vales     || r.data || r),
      });
    }).finally(() => setCountsLoading(false));
  }, []);

  const toggleAll = (v) =>
    setSelected(Object.fromEntries(REPORT_TYPES.map(r => [r.key, v])));

  const includedKeys = REPORT_TYPES.filter(r => selected[r.key]).map(r => r.key);
  const totalRecords = includedKeys.reduce((sum, key) => sum + (liveData[key]?.length || 0), 0);

  const handleExport = async () => {
    if (includedKeys.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await generateCombinedReport(
        {
          invoices:      liveData.invoices,
          cashVouchers:  liveData.cashVouchers,
          checkVouchers: liveData.checkVouchers,
          expenses:      liveData.expenses,
          pettyCash:     liveData.pettyCash,
          vales:         liveData.vales,
        },
        { dateRange, summaryMetrics, expensesTarget, include: includedKeys },
      );
    } catch (err) {
      setError(err?.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
            <FileDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              Combined Report Export
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Export all reports as one Excel file with multiple sheets
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Sheet selector (collapsible) */}
      {expanded && (
        <div className="border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Select sheets to include
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                All
              </button>
              <span className="text-neutral-300">|</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-xs text-neutral-400 hover:underline"
              >
                None
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {REPORT_TYPES.map(r => {
              const count = liveData[r.key]?.length || 0;
              return (
                <label
                  key={r.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    selected[r.key]
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected[r.key]}
                    onChange={e => setSelected(prev => ({ ...prev, [r.key]: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  <span className="font-medium">{r.label}</span>
                  <span className="ml-auto tabular-nums text-[10px] opacity-60">
                    {countsLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
        <span className="text-xs text-neutral-400">
          {includedKeys.length} sheet{includedKeys.length !== 1 ? 's' : ''} · {countsLoading ? '…' : totalRecords.toLocaleString()} records
        </span>
        <div className="flex items-center gap-3">
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <button
            type="button"
            disabled={loading || includedKeys.length === 0}
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
            ) : (
              <><FileDown className="h-3.5 w-3.5" /> Export All</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
