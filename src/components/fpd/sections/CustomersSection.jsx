"use client";

/**
 * CustomersSection — Remastered
 *
 * Architecture:
 *  1. CONSTANTS & CONFIG    — design tokens, field definitions
 *  2. UTILITIES             — formatters, pure helpers
 *  3. CUSTOM HOOKS          — useCustomers (all async state + actions)
 *  4. PRIMITIVE COMPONENTS  — StatCard, FieldRow, ContactBadge, EmptyState, Spinner
 *  5. SECTION COMPONENTS    — StatsStrip, CustomerList, CustomerPanel
 *  6. ROOT EXPORT           — CustomersSection
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LuSearch, LuPlus, LuPencil, LuTrash2, LuUser,
  LuMail, LuPhone, LuMapPin, LuFileText,
  LuCalendar, LuDollarSign, LuX, LuTriangleAlert,
} from "react-icons/lu";
import apiService from "../../../utils/api/api-service";
import { CustomerForm } from "../components/forms";
import { useAuth } from "../../../contexts/AuthContext";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import Toast from "../components/main_ui/Toast";
import { useToast } from "../hooks/useToast";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Design tokens — mirrors the same TOKEN shape used in FinanceDashboard
 * so both modules stay visually consistent.
 */
const TOKEN = {
  surface:  { card: "bg-white dark:bg-stone-900", border: "border-gray-100 dark:border-gray-800" },
  muted:    { text: "text-gray-400 dark:text-gray-500", label: "text-gray-500 dark:text-gray-400" },
  primary:  { text: "text-gray-900 dark:text-white" },
  emerald:  { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/25", border: "border-emerald-200 dark:border-emerald-800", hex: "#10b981" },
  blue:     { text: "text-sky-600 dark:text-sky-400",     bg: "bg-sky-50 dark:bg-sky-900/25",     border: "border-sky-200 dark:border-sky-800"     },
  violet:   { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/25", border: "border-violet-200 dark:border-violet-800" },
  amber:    { text: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/25",  border: "border-amber-200 dark:border-amber-800"  },
  rose:     { text: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-900/25",    border: "border-rose-200 dark:border-rose-800"    },
};

/** KPI card definitions — drives the StatsStrip declaratively. */
const STAT_CARDS = [
  {
    id: "total",
    title: "Total Customers",
    icon: LuUser,
    color: "blue",
    getValue: (customers) => customers.length,
  },
  {
    id: "receivables",
    title: "Total Receivables",
    icon: LuDollarSign,
    color: "emerald",
    getValue: (customers, fmt) =>
      fmt(customers.reduce((sum, c) => sum + (parseFloat(c.total_account_receivables ?? c.total_sales) || 0), 0)),
  },
  {
    id: "active",
    title: "Active Customers",
    icon: LuFileText,
    color: "violet",
    getValue: (customers) =>
      customers.filter((c) => (c.total_invoices ?? c.total_transactions ?? 0) > 0).length,
  },
  {
    id: "invoices",
    title: "Total Invoices",
    icon: LuCalendar,
    color: "amber",
    getValue: (customers) =>
      customers.reduce((sum, c) => sum + (parseInt(c.total_invoices ?? c.total_transactions) || 0), 0),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a normalised contact list from a customer record.
 * Keeps phone before email; marks phone as primary.
 *
 * @param {object} customer
 * @returns {{ value: string, type: "phone"|"email", person: string|null, primary: boolean }[]}
 */
function deriveContacts(customer) {
  const contacts = [];
  if (customer.phone) contacts.push({ value: customer.phone,  type: "phone", person: customer.contact_person ?? null, primary: true  });
  if (customer.email) contacts.push({ value: customer.email,  type: "email", person: customer.contact_person ?? null, primary: false });
  return contacts;
}

/**
 * Returns true if a customer matches the search term across
 * name, address, and TIN — case-insensitive.
 */
function matchesSearch(customer, term) {
  if (!term) return true;
  const q = term.toLowerCase();
  return (
    customer.customer_name?.toLowerCase().includes(q) ||
    customer.address?.toLowerCase().includes(q) ||
    customer.tin_number?.toLowerCase().includes(q)
  );
}

/** Format a JS Date (or ISO string) as "Jan 15, 2025" */
const fmtDate = (raw) =>
  raw
    ? new Date(raw).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// 3. CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useCustomers — encapsulates all async state and CRUD actions.
 * Components receive only data + callbacks; no fetch logic leaks into JSX.
 */
function useCustomers({ onDataChange, userId }) {
  const [customers, setCustomers]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedCustomer, setSelected]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState(null);
  const [formOpen, setFormOpen]           = useState(false);
  const [editing, setEditing]             = useState(null);

  // ── Fetch list ────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.finance.getCustomers();
      setCustomers(data.customers ?? []);
    } catch (err) {
      console.error("fetchList:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Select / view detail ──────────────────────────────────────────────────
  const select = useCallback(async (customer) => {
    setSelected(customer);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiService.finance.getCustomer(customer.id);
      setSelected(res.customer);
    } catch (err) {
      console.error("select:", err);
      setDetailError("Failed to load complete details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Open form ─────────────────────────────────────────────────────────────
  const openCreate = useCallback(() => { setEditing(null); setFormOpen(true); }, []);
  const openEdit   = useCallback((c) => { setEditing(c);   setFormOpen(true); }, []);
  const closeForm  = useCallback(() => { setFormOpen(false); setEditing(null); }, []);

  // ── Submit form ───────────────────────────────────────────────────────────
  const submitForm = useCallback(async (formData) => {
    if (editing) {
      await apiService.finance.updateCustomer(editing.id, formData);
    } else {
      await apiService.finance.createCustomer({ ...formData, created_by: userId ?? null });
    }
    await fetchList();
    closeForm();
    onDataChange?.();
  }, [editing, fetchList, closeForm, onDataChange, userId]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const remove = useCallback(async (customerId) => {
    try {
      await apiService.finance.deleteCustomer(customerId);
      await fetchList();
      onDataChange?.();
      setSelected((prev) => (prev?.id === customerId ? null : prev));
    } catch (err) {
      console.error("remove:", err);
      throw err;
    }
  }, [fetchList, onDataChange]);

  return {
    // data
    customers, loading,
    selectedCustomer, detailLoading, detailError,
    formOpen, editing,
    // actions
    select, openCreate, openEdit, closeForm, submitForm, remove,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StatCard — KPI tile with a faint background icon.
 */
const StatCard = ({ title, value, icon: Icon, color }) => {
  const t = TOKEN[color] ?? TOKEN.blue;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${TOKEN.surface.card} ${t.border}`}>
      {/* Background icon watermark */}
      <div className={`absolute -right-3 -top-3 opacity-[0.07] ${t.text}`} aria-hidden>
        <Icon size={72} />
      </div>

      <div className="relative z-10">
        <p className={`text-xs font-bold uppercase tracking-[0.12em] mb-2 ${TOKEN.muted.label}`}>{title}</p>
        <p className={`text-2xl sm:text-3xl font-black leading-none tracking-tight ${TOKEN.primary.text}`}>{value}</p>
      </div>
    </div>
  );
};

/**
 * FieldRow — a labelled field inside the detail panel.
 */
const FieldRow = ({ label, children, mono = false }) => (
  <div>
    <p className={`text-[10px] uppercase tracking-[0.12em] font-bold mb-0.5 ${TOKEN.muted.text}`}>{label}</p>
    <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${TOKEN.primary.text}`}>{children}</p>
  </div>
);

/**
 * ContactBadge — a single phone/email contact item.
 */
const ContactBadge = ({ contact }) => (
  <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${TOKEN.surface.card} ${TOKEN.surface.border}`}>
    <div className="flex items-center gap-2.5">
      <span className={`inline-flex p-1.5 rounded-lg ${TOKEN.emerald.bg} ${TOKEN.emerald.text}`}>
        {contact.type === "email" ? <LuMail size={12} /> : <LuPhone size={12} />}
      </span>
      <div>
        <p className={`text-sm font-medium ${TOKEN.primary.text}`}>{contact.value}</p>
        <p className={`text-[10px] capitalize ${TOKEN.muted.text}`}>
          {contact.type}{contact.person ? ` · ${contact.person}` : ""}
        </p>
      </div>
    </div>
    {contact.primary && (
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${TOKEN.emerald.bg} ${TOKEN.emerald.text}`}>
        Primary
      </span>
    )}
  </div>
);

/**
 * EmptyState — centred placeholder with optional CTA.
 */
const EmptyState = ({ icon: Icon = LuUser, message, action }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
    <Icon size={48} className={`mb-4 ${TOKEN.muted.text}`} />
    <p className={`text-sm font-medium ${TOKEN.muted.label}`}>{message}</p>
    {action && (
      <button
        onClick={action.onClick}
        className={`mt-5 px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 text-white bg-stone-900 dark:bg-white dark:text-gray-900`}
      >
        {action.label}
      </button>
    )}
  </div>
);

/**
 * Spinner — generic loading indicator.
 */
const Spinner = ({ label = "Loading…" }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
    <div className={`w-9 h-9 rounded-full border-2 border-transparent border-t-current animate-spin ${TOKEN.emerald.text}`} />
    <p className={`text-sm font-medium ${TOKEN.muted.label}`}>{label}</p>
  </div>
);

/**
 * SectionHeader — consistent card header row.
 */
const SectionHeader = ({ title, sub }) => (
  <div className={`px-5 py-4 border-b ${TOKEN.surface.border}`}>
    <h3 className={`text-base font-bold ${TOKEN.primary.text}`}>{title}</h3>
    {sub && <p className={`text-xs mt-0.5 font-medium ${TOKEN.muted.label}`}>{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── 5a. Top bar: search + add ─────────────────────────────────────────────

const Toolbar = ({ searchTerm, onSearch, onAdd }) => (
  <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between rounded-2xl border p-4 ${TOKEN.surface.card} ${TOKEN.surface.border} shadow-[0_1px_6px_-2px_rgba(0,0,0,0.06)]`}>
    <div className="relative flex-1 w-full sm:max-w-sm">
      <LuSearch size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${TOKEN.muted.text}`} />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by name, address, or TIN…"
        className={`w-full pl-9 pr-8 py-2 rounded-xl border text-sm outline-none transition-all
          bg-stone-50 dark:bg-stone-800 border-gray-200 dark:border-gray-700
          focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400
          ${TOKEN.primary.text} placeholder:text-gray-400`}
      />
      {searchTerm && (
        <button
          onClick={() => onSearch("")}
          className={`absolute right-3 top-1/2 -translate-y-1/2 ${TOKEN.muted.text} hover:text-gray-600`}
          aria-label="Clear search"
        >
          <LuX size={13} />
        </button>
      )}
    </div>

    <button
      onClick={onAdd}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 text-white bg-stone-900 dark:bg-white dark:text-gray-900 shadow-sm"
    >
      <LuPlus size={16} />
      Add Customer
    </button>
  </div>
);

// ── 5b. KPI strip ────────────────────────────────────────────────────────────

const StatsStrip = ({ customers, formatCurrency }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
    {STAT_CARDS.map((cfg) => (
      <StatCard
        key={cfg.id}
        title={cfg.title}
        icon={cfg.icon}
        color={cfg.color}
        value={cfg.getValue(customers, formatCurrency)}
      />
    ))}
  </div>
);

// ── 5c. Customer list ─────────────────────────────────────────────────────────

const CustomerRow = ({ customer, selected, onSelect, onEdit, onDelete, formatCurrency }) => {
  const isSelected  = selected?.id === customer.id;
  const txCount     = customer.total_invoices ?? customer.total_transactions ?? 0;
  const receivables = customer.total_account_receivables ?? customer.total_sales ?? 0;

  return (
    <div
      onClick={() => onSelect(customer)}
      className={`
        relative px-5 py-4 cursor-pointer group border-l-[3px] transition-all duration-150
        ${isSelected
          ? `border-gray-900 dark:border-white bg-stone-50 dark:bg-stone-800/60`
          : `border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-stone-50/60 dark:hover:bg-stone-800/30`}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Name + active badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className={`font-bold text-sm truncate ${TOKEN.primary.text}`}>{customer.customer_name}</h4>
            {txCount > 0 && (
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TOKEN.emerald.bg} ${TOKEN.emerald.text}`}>
                Active
              </span>
            )}
          </div>

          {/* Meta rows */}
          <div className="space-y-1">
            {customer.address && (
              <div className={`flex items-center gap-1.5 text-xs ${TOKEN.muted.label}`}>
                <LuMapPin size={11} className="shrink-0" />
                <span className="truncate">{customer.address}</span>
              </div>
            )}
            {customer.tin_number && (
              <div className={`flex items-center gap-1.5 text-xs ${TOKEN.muted.label}`}>
                <LuFileText size={11} className="shrink-0" />
                <span className="font-mono">TIN: {customer.tin_number}</span>
              </div>
            )}
          </div>

          {/* Financial footnote */}
          <div className={`flex items-center gap-4 text-xs mt-2.5 pt-2.5 border-t ${TOKEN.surface.border}`}>
            <span className={TOKEN.muted.label}>
              Invoices: <span className={`font-bold ${TOKEN.primary.text}`}>{txCount}</span>
            </span>
            <span className={TOKEN.muted.label}>
              Receivables: <span className={`font-bold ${TOKEN.emerald.text}`}>{formatCurrency(receivables)}</span>
            </span>
          </div>
        </div>

        {/* Action buttons — fade in on hover / selection */}
        <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
            className={`p-2 rounded-lg transition-colors ${TOKEN.muted.text} hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-stone-700`}
            title="Edit"
          >
            <LuPencil size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(customer.id); }}
            className={`p-2 rounded-lg transition-colors ${TOKEN.muted.text} hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-stone-700`}
            title="Delete"
          >
            <LuTrash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerList = ({ customers, loading, searchTerm, selectedCustomer, onSelect, onEdit, onDelete, onAdd, formatCurrency }) => (
  <div className={`lg:col-span-2 flex flex-col rounded-2xl border overflow-hidden h-[660px] ${TOKEN.surface.card} ${TOKEN.surface.border} shadow-[0_1px_6px_-2px_rgba(0,0,0,0.06)]`}>
    <SectionHeader
      title="Customer List"
      sub={loading ? "Loading…" : `${customers.length} customer${customers.length !== 1 ? "s" : ""} found`}
    />

    {loading ? (
      <Spinner label="Loading customers…" />
    ) : customers.length === 0 ? (
      <EmptyState
        message={searchTerm ? "No customers match your search." : "No customers yet. Add your first one."}
        action={!searchTerm ? { label: "Add Customer", onClick: onAdd } : undefined}
      />
    ) : (
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {customers.map((c) => (
          <CustomerRow
            key={c.id}
            customer={c}
            selected={selectedCustomer}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    )}
  </div>
);

// ── 5d. Detail panel ──────────────────────────────────────────────────────────

/** Sub-section title inside the detail panel */
const PanelSection = ({ title, children }) => (
  <div>
    <p className={`text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5 ${TOKEN.emerald.text}`}>{title}</p>
    {children}
  </div>
);

/** Thin separator with optional label */
const Divider = () => <div className={`border-t ${TOKEN.surface.border}`} />;

const CustomerPanel = ({ customer, loading, error, onEdit, onDelete, formatCurrency }) => (
  <div className={`lg:col-span-1 flex flex-col rounded-2xl border overflow-hidden h-[660px] ${TOKEN.surface.card} ${TOKEN.surface.border} shadow-[0_1px_6px_-2px_rgba(0,0,0,0.06)]`}>
    <SectionHeader title="Customer Details" />

    {!customer ? (
      <EmptyState icon={LuUser} message="Select a customer to view their full details." />
    ) : loading ? (
      <Spinner label="Loading details…" />
    ) : (
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Error notice */}
        {error && (
          <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${TOKEN.amber.bg} ${TOKEN.amber.border}`}>
            <LuTriangleAlert size={14} className={`shrink-0 mt-0.5 ${TOKEN.amber.text}`} />
            <p className={`text-xs font-medium ${TOKEN.amber.text}`}>{error}</p>
          </div>
        )}

        {/* Basic info */}
        <PanelSection title="Basic Information">
          <div className={`space-y-3.5 p-4 rounded-xl border ${TOKEN.surface.border} bg-stone-50/50 dark:bg-stone-800/30`}>
            <FieldRow label="Customer Name">{customer.customer_name ?? "—"}</FieldRow>
            {customer.address       && <FieldRow label="Address">{customer.address}</FieldRow>}
            {(customer.tin_number ?? customer.tin) && (
              <FieldRow label="TIN Number" mono>{customer.tin_number ?? customer.tin}</FieldRow>
            )}
            {customer.business_style  && <FieldRow label="Business Style">{customer.business_style}</FieldRow>}
            {customer.contact_person  && <FieldRow label="Contact Person">{customer.contact_person}</FieldRow>}
          </div>
        </PanelSection>

        {/* Contacts */}
        {deriveContacts(customer).length > 0 && (
          <PanelSection title="Contact">
            <div className="space-y-2">
              {deriveContacts(customer).map((c, i) => <ContactBadge key={i} contact={c} />)}
            </div>
          </PanelSection>
        )}

        {/* Financial summary */}
        <PanelSection title="Financial Summary">
          <div className={`rounded-xl border overflow-hidden ${TOKEN.surface.border}`}>
            {[
              { label: "Total Invoices", value: customer.total_invoices ?? 0 },
              { label: "Total Sales",    value: formatCurrency(customer.total_account_receivables ?? customer.total_sales ?? 0), accent: true },
              ...(customer.last_invoice_date ? [{ label: "Last Invoice", value: fmtDate(customer.last_invoice_date) }] : []),
            ].map((row, i, arr) => (
              <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? `border-b ${TOKEN.surface.border}` : ""}`}>
                <span className={`text-xs font-medium ${TOKEN.muted.label}`}>{row.label}</span>
                <span className={`text-sm font-bold font-mono ${row.accent ? TOKEN.emerald.text : TOKEN.primary.text}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </PanelSection>

        {/* Recent invoices */}
        {customer.recent_invoices?.length > 0 && (
          <PanelSection title="Recent Invoices">
            <div className="space-y-2">
              {customer.recent_invoices.map((inv) => (
                <div
                  key={inv.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors cursor-pointer ${TOKEN.surface.border} bg-stone-50/50 dark:bg-stone-800/30 hover:border-emerald-300 dark:hover:border-emerald-700`}
                >
                  <div>
                    <p className={`text-xs font-bold ${TOKEN.primary.text}`}>#{inv.invoice_number}</p>
                    <p className={`text-[10px] capitalize mt-0.5 ${TOKEN.muted.label}`}>{inv.sale_type?.replace(/-/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold font-mono ${TOKEN.emerald.text}`}>
                      {formatCurrency(inv.account_receivables ?? inv.total_amount)}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${TOKEN.muted.label}`}>{fmtDate(inv.invoice_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </PanelSection>
        )}

        {/* Record meta + action buttons */}
        <div className="space-y-3 pt-2">
          <Divider />
          {(customer.created_by_name || customer.created_at) && (
            <p className={`text-[10px] ${TOKEN.muted.text}`}>
              Added {fmtDate(customer.created_at)}
              {customer.created_by_name ? ` by ${customer.created_by_name}` : ""}
            </p>
          )}
          <div className="flex gap-2.5">
            <button
              onClick={() => onEdit(customer)}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]
                bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 ${TOKEN.primary.text}`}
            >
              <LuPencil size={14} /> Edit
            </button>
            <button
              onClick={() => onDelete(customer.id)}
              className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]
                ${TOKEN.rose.bg} ${TOKEN.rose.text} hover:opacity-90`}
              title="Delete customer"
            >
              <LuTrash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CustomersSection
 *
 * Props:
 *   formatCurrency  {(n: number) => string}  — currency formatter from parent
 *   onDataChange    {() => void}              — callback after any mutation
 *   user            {{ id: string }}          — authenticated user (for audit)
 */
function CustomersSection({ formatCurrency, onDataChange, user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const { toasts, showSuccess, showError, removeToast } = useToast();

  const {
    customers, loading,
    selectedCustomer, detailLoading, detailError,
    formOpen, editing,
    select, openCreate, openEdit, closeForm, submitForm, remove,
  } = useCustomers({ onDataChange, userId: user?.id });

  const filtered = useMemo(
    () => customers.filter((c) => matchesSearch(c, searchTerm)),
    [customers, searchTerm],
  );

  const deleteTargetCustomer = useMemo(
    () => customers.find((c) => c.id === deleteTargetId) ?? null,
    [customers, deleteTargetId],
  );

  const requestDelete = useCallback((customerId) => {
    setDeleteTargetId(customerId);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await remove(deleteTargetId);
      showSuccess("Customer deleted successfully");
    } catch (err) {
      showError("Failed to delete: " + (err.message ?? "Unknown error"));
    } finally {
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, remove, showSuccess, showError]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <Toolbar
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onAdd={openCreate}
      />

      {/* ── KPI Strip ──────────────────────────────────────────────── */}
      <StatsStrip customers={customers} formatCurrency={formatCurrency} />

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <CustomerList
          customers={filtered}
          loading={loading}
          searchTerm={searchTerm}
          selectedCustomer={selectedCustomer}
          onSelect={select}
          onEdit={openEdit}
          onDelete={requestDelete}
          onAdd={openCreate}
          formatCurrency={formatCurrency}
        />
        <CustomerPanel
          customer={selectedCustomer}
          loading={detailLoading}
          error={detailError}
          onEdit={openEdit}
          onDelete={requestDelete}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* ── Customer Form Modal ─────────────────────────────────────── */}
      <CustomerForm
        isOpen={formOpen}
        onClose={closeForm}
        onSubmit={submitForm}
        customer={editing}
        isEditing={!!editing}
      />

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleteTargetCustomer?.customer_name || "this customer"}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      <div className="fixed top-4 right-4 z-[110] space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} duration={toast.duration} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

    </div>
  );
}

export default CustomersSection;