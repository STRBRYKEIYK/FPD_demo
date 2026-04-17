import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { financeDocumentSchema } from '../schemas/financeDocumentSchema';
import { ConfidenceBadge } from './ConfidenceBadge';

function cloneDraft(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function setPathValue(source, path, nextValue) {
  if (!path.length) {
    return nextValue;
  }

  const [head, ...rest] = path;

  if (Array.isArray(source)) {
    return source.map((item, index) => (index === head ? setPathValue(item, rest, nextValue) : item));
  }

  return {
    ...source,
    [head]: setPathValue(source?.[head], rest, nextValue),
  };
}

function toLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPathValue(source, path) {
  return path.reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, source);
}

function normalizeNumberInput(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

const REQUIRED_DRAFT_FIELD_MAP = {
  sales_invoice: [
    { path: ['invoice_number'], label: 'Invoice Number', type: 'text' },
    { path: ['invoice_date'], label: 'Invoice Date', type: 'date' },
    { path: ['customer_name'], label: 'Customer Name', type: 'text' },
    { path: ['total_amount'], label: 'Total Amount', type: 'number' },
  ],
  monthly_bill: [
    { path: ['month'], label: 'Month', type: 'number' },
    { path: ['year'], label: 'Year', type: 'number' },
    { path: ['items', 0, 'provider_name'], label: 'Provider Name', type: 'text' },
    { path: ['items', 0, 'account_number'], label: 'Account Number', type: 'text' },
    { path: ['items', 0, 'soa_number'], label: 'SOA Number', type: 'text' },
    { path: ['items', 0, 'due_date'], label: 'Due Date', type: 'date' },
    { path: ['items', 0, 'amount'], label: 'Amount', type: 'text' },
  ],
  expense: [
    { path: ['date'], label: 'Date', type: 'date' },
    { path: ['company_supplier'], label: 'Company / Supplier', type: 'text' },
    { path: ['or_ci_si'], label: 'OR/CI/SI', type: 'text' },
    { path: ['non_vat_amount'], label: 'Non-VAT Amount', type: 'text' },
    { path: ['particulars'], label: 'Particulars', type: 'text' },
  ],
  cash_voucher: [
    { path: ['voucher_date'], label: 'Voucher Date', type: 'date' },
    { path: ['company_payee_payor'], label: 'Company / Payee / Payor', type: 'text' },
    { path: ['invoice_number'], label: 'Invoice Number', type: 'text' },
    { path: ['lineItems', 0, 'amount'], label: 'Line Item Amount', type: 'number' },
  ],
  check_voucher: [
    { path: ['voucher_date'], label: 'Voucher Date', type: 'date' },
    { path: ['company_payee_payor'], label: 'Company / Payee / Payor', type: 'text' },
    { path: ['lineItems', 0, 'si_number'], label: 'SI Number', type: 'text' },
    { path: ['lineItems', 0, 'amount'], label: 'Line Item Amount', type: 'number' },
  ],
  petty_cash_voucher: [
    { path: ['voucher_date'], label: 'Voucher Date', type: 'date' },
    { path: ['company_supplier'], label: 'Company / Supplier', type: 'text' },
    { path: ['lineItems', 0, 'reference'], label: 'Reference', type: 'text' },
    { path: ['lineItems', 0, 'amount'], label: 'Line Item Amount', type: 'number' },
    { path: ['lineItems', 0, 'particulars'], label: 'Particulars', type: 'text' },
  ],
};

function getRequiredDraftFields(target) {
  if (!target) return [];
  return REQUIRED_DRAFT_FIELD_MAP[target] || [];
}

function DraftFieldEditor({ fieldKey, value, path = [], onChange }) {
  const nextPath = [...path, fieldKey];

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{toLabel(fieldKey)}</p>
        {value.map((item, index) => (
          <div key={`${fieldKey}-${index}`} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Item {index + 1}</p>
            {Object.entries(item || {}).map(([nestedKey, nestedValue]) => (
              <DraftFieldEditor
                key={`${fieldKey}-${index}-${nestedKey}`}
                fieldKey={nestedKey}
                value={nestedValue}
                path={[...nextPath, index]}
                onChange={onChange}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{toLabel(fieldKey)}</p>
        {Object.entries(value).map(([nestedKey, nestedValue]) => (
          <DraftFieldEditor
            key={`${fieldKey}-${nestedKey}`}
            fieldKey={nestedKey}
            value={nestedValue}
            path={nextPath}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }

  const fieldPath = [...path, fieldKey];
  const inputLabel = toLabel(fieldKey);

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(fieldPath, event.target.checked)}
          className="h-4 w-4"
        />
        <span>{inputLabel}</span>
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{inputLabel}</span>
        <input
          type="number"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(fieldPath, Number(event.target.value || 0))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
        />
      </label>
    );
  }

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{inputLabel}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(fieldPath, event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
      />
    </label>
  );
}

export function ValidationForm({
  extractedData,
  confidence,
  onConfirm,
  isSaving = false,
  draftTarget = null,
  draftData = null,
}) {
  const defaultValues = useMemo(
    () => ({
      total_amount: extractedData?.total_amount ?? null,
      invoice_date: extractedData?.invoice_date ?? '',
      vendor_name: extractedData?.vendor_name ?? '',
      invoice_number: extractedData?.invoice_number ?? '',
    }),
    [extractedData],
  );

  const [editableDraft, setEditableDraft] = useState(() => (draftData ? cloneDraft(draftData) : null));
  const requiredDraftFields = useMemo(() => getRequiredDraftFields(draftTarget), [draftTarget]);

  useEffect(() => {
    setEditableDraft(draftData ? cloneDraft(draftData) : null);
  }, [draftData]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(financeDocumentSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleDraftChange = (path, nextValue) => {
    setEditableDraft((current) => {
      if (!current) return current;
      return setPathValue(current, path, nextValue);
    });
  };

  const submitWithDraft = (formData) => {
    onConfirm({
      ...formData,
      __target: draftTarget,
      __draft: editableDraft,
    });
  };

  const showRequiredDraftEditor = !!(draftTarget && editableDraft && requiredDraftFields.length > 0);

  return (
    <form onSubmit={handleSubmit(submitWithDraft)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-black">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Validate extracted data</h3>
      </div>

      {!showRequiredDraftEditor && (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Amount</span>
            <input type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20" {...register('total_amount', { valueAsNumber: true })} />
            <ConfidenceBadge value={confidence?.total_amount ?? 0} />
            {errors.total_amount && <p className="text-xs text-rose-600">{errors.total_amount.message}</p>}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Invoice Date</span>
            <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20" {...register('invoice_date')} />
            <ConfidenceBadge value={confidence?.invoice_date ?? 0} />
            {errors.invoice_date && <p className="text-xs text-rose-600">{errors.invoice_date.message}</p>}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Vendor Name</span>
            <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20" {...register('vendor_name')} />
            <ConfidenceBadge value={confidence?.vendor_name ?? 0} />
            {errors.vendor_name && <p className="text-xs text-rose-600">{errors.vendor_name.message}</p>}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Invoice Number</span>
            <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20" {...register('invoice_number')} />
            <ConfidenceBadge value={confidence?.invoice_number ?? 0} />
            {errors.invoice_number && <p className="text-xs text-rose-600">{errors.invoice_number.message}</p>}
          </label>
        </>
      )}

      {showRequiredDraftEditor && (
        <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Required bulk editor fields</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Target: {toLabel(draftTarget)} • Proofread and correct values before saving.</p>
          </div>

          {requiredDraftFields.map((field) => {
            const currentValue = getPathValue(editableDraft, field.path);
            const safeValue = currentValue ?? '';
            const key = field.path.join('.');

            return (
              <label key={key} className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</span>
                <input
                  type={field.type}
                  step={field.type === 'number' ? '0.01' : undefined}
                  value={String(safeValue)}
                  onChange={(event) => {
                    const nextValue = field.type === 'number'
                      ? normalizeNumberInput(event.target.value)
                      : event.target.value;
                    handleDraftChange(field.path, nextValue);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
            );
          })}
        </section>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm & Save
      </button>
    </form>
  );
}
