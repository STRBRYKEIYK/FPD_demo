"use client";

/**
 * FinanceDashboard — Remastered
 *
 * Architecture:
 *  1. CONSTANTS & CONFIG    — tokens, theme, color palette
 *  2. UTILITIES             — formatters, date helpers
 *  3. DATA TRANSFORM        — pure function, testable
 *  4. CUSTOM HOOKS          — useAnimatedCounter, useDashboardData
 *  5. PRIMITIVE COMPONENTS  — Card, KpiBlock, StatRow, ChartShell, Tooltip
 *  6. SECTION COMPONENTS    — KpiStrip, ChartsSection, OperationsSection, BottomSection
 *  7. ROOT EXPORT           — FinanceDashboard
 */

import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  RefreshCw, CreditCard, CalendarDays, Users, PiggyBank,
  Banknote, Shield, AlertCircle, Activity, ArrowRight,
  LayoutGrid, DollarSign, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import CombinedReportExport from "../components/shared/CombinedReportExport";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Design tokens — single source of truth.
 * Each token carries: Tailwind utility classes (text/bg/border) and raw hex
 * values (stroke/fill) for Recharts, which cannot consume Tailwind classes.
 */
const TOKEN = {
  ink:     { text: "text-gray-900 dark:text-white",         bg: "bg-stone-900 dark:bg-white/10",         border: "border-gray-900", hex: "#111827" },
  muted:   { text: "text-gray-500 dark:text-gray-400",      bg: "bg-stone-100 dark:bg-stone-800",         border: "border-gray-200 dark:border-gray-700", hex: "#6b7280" },
  surface: { text: "text-gray-700 dark:text-gray-200",      bg: "bg-white dark:bg-stone-900",            border: "border-gray-100 dark:border-gray-800", hex: "#ffffff" },
  emerald: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800", hex: "#10b981" },
  violet:  { text: "text-violet-600 dark:text-violet-400",  bg: "bg-violet-50 dark:bg-violet-900/30",   border: "border-violet-200 dark:border-violet-800",  hex: "#8b5cf6" },
  amber:   { text: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-900/30",     border: "border-amber-200 dark:border-amber-800",    hex: "#f59e0b" },
  rose:    { text: "text-rose-600 dark:text-rose-400",      bg: "bg-rose-50 dark:bg-rose-900/30",       border: "border-rose-200 dark:border-rose-800",      hex: "#f43f5e" },
  cyan:    { text: "text-cyan-600 dark:text-cyan-400",      bg: "bg-cyan-50 dark:bg-cyan-900/30",       border: "border-cyan-200 dark:border-cyan-800",      hex: "#06b6d4" },
  sky:     { text: "text-sky-600 dark:text-sky-400",        bg: "bg-sky-50 dark:bg-sky-900/30",         border: "border-sky-200 dark:border-sky-800",        hex: "#0ea5e9" },
  slate:   { text: "text-slate-600 dark:text-slate-400",    bg: "bg-slate-50 dark:bg-slate-900/30",     border: "border-slate-200 dark:border-slate-800",    hex: "#374151" },
  grid:    { text: "text-gray-700 dark:text-gray-400",       bg: "bg-gray-700 dark:bg-gray-400",         border: "border-gray-700 dark:border-gray-400",      hex: "#f3f4f6" },
};

/** Ordered slice colors for the donut chart */
const PIE_PALETTE = [TOKEN.ink.hex, TOKEN.violet.hex, TOKEN.emerald.hex, TOKEN.amber.hex, TOKEN.rose.hex, TOKEN.cyan.hex];
const BAR_PALETTE = {
  electricity: TOKEN.amber.hex,
  water: TOKEN.cyan.hex,
  internet: TOKEN.violet.hex,
  other: TOKEN.slate.hex,
};
const GRID_PALETTE = {
  dark: TOKEN.grid.hex,
  light: TOKEN.grid.hex,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number as Philippine Peso. Pass compact=true for axis/pill labels. */
const formatPHP = (value = 0, compact = false) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    ...(compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }).format(value);

/** Convert "YYYY-MM" month string → abbreviated month label. */
const monthLabel = (monthStr = "") => {
  const idx = parseInt(String(monthStr).split("-")[1] || "1", 10) - 1;
  return MONTH_NAMES[Math.max(0, Math.min(11, idx))];
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATA TRANSFORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure function — converts raw API summary into typed dashboard state.
 * Keeping this separate makes it trivially unit-testable and decouples
 * rendering logic from data shape concerns.
 *
 * @param {object} summary — raw dashboardSummary from the API
 * @returns {{ kpis, charts, budget, topCustomers, alerts }}
 */
function transformDashboardData(summary = {}) {
  const invoices          = summary.invoices          ?? {};
  const monthlyBills      = summary.monthlyBills      ?? {};
  const checkVouchers     = summary.checkVouchers     ?? {};
  const pettyCashVouchers = summary.pettyCashVouchers ?? {};
  const pettyBudget       = summary.pettyCashBudget   ?? {};

  // ── KPIs ──
  const topCustomers = (invoices.topCustomers ?? []).slice(0, 5).map((c) => ({
    name:        c.customer_name,
    receivables: Number(c.totalReceivables ?? 0),
  }));
  const totalReceivables = topCustomers.reduce((s, c) => s + c.receivables, 0);

  const kpis = {
    totalRevenue:  Number(invoices.totalAmount    ?? 0),
    totalVAT:      Number(invoices.vatAmount      ?? 0),
    totalReceivables,
    billsPaid:     Number(monthlyBills.paidAmount    ?? 0),
    billsPending:  Number(monthlyBills.pendingAmount ?? 0),
    checkTotal:    Number(checkVouchers.totalDr      ?? 0),
    pettyTotal:    Number(pettyCashVouchers.totalAmount ?? 0),
    invoiceCount:  Number(invoices.total            ?? 0),
  };

  // ── Charts ──
  const revenueChart = (invoices.monthlyTrend ?? []).map((row) => ({
    month:  monthLabel(row.month),
    amount: Number(row.amount ?? 0),
  }));

  const saleTypeChart = (invoices.byType ?? []).map((row) => ({
    name:  String(row.sale_type ?? "General").replace(/-/g, " "),
    value: Number(row.totalAmount ?? 0),
  }));

  const billsChart = [...(monthlyBills.byMonth ?? [])].reverse().map((row) => ({
    period:      MONTH_NAMES[Math.max(0, Math.min(11, Number(row.month ?? 1) - 1))],
    electricity: Number(row.electricity ?? 0),
    water:       Number(row.water       ?? 0),
    internet:    Number(row.internet    ?? 0),
    other:       Number(row.other       ?? 0),
  }));

  const checkChart = (checkVouchers.monthlyTrend ?? []).map((row) => ({
    month:  monthLabel(row.month),
    amount: Number(row.totalDr ?? 0),
  }));

  // ── Budget ──
  const budgetTotal   = Number(pettyBudget.totalBudget    ?? 0);
  const budgetBalance = Number(pettyBudget.currentBalance ?? 0);
  const budgetUsed    = Number(pettyBudget.totalExpenses  ?? 0);
  const budgetPct     = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
  const budget = { total: budgetTotal, balance: budgetBalance, used: budgetUsed, pct: budgetPct };

  // ── Alerts ──
  const alerts = [];
  if (Number(monthlyBills.overdue ?? 0) > 0) alerts.push({ severity: "urgent",  msg: `${monthlyBills.overdue} Overdue Bills` });
  if (budgetPct > 80)                         alerts.push({ severity: "warning", msg: "Petty Cash Running Low" });

  return { kpis, charts: { revenueChart, saleTypeChart, billsChart, checkChart }, budget, topCustomers, alerts };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animates a numeric value from 0 → target over `duration` ms using
 * requestAnimationFrame. Returns the current animated value.
 */
function useAnimatedCounter(target = 0, duration = 900) {
  const [value, setValue] = useState(0);
  const frameRef          = useRef(null);
  const startRef          = useRef(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }

    startRef.current = null;
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

/**
 * Memoises the expensive data transform and exposes the structured result.
 */
function useDashboardData(financeData = {}) {
  return useMemo(
    () => transformDashboardData(financeData.dashboardSummary ?? {}),
    [financeData],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Card — the foundational surface tile.
 *
 * Props:
 *   className  — extra Tailwind classes (use for grid spans, heights, etc.)
 *   noPadding  — disables default body padding (useful for full-bleed charts)
 *   header     — ReactNode rendered above the body
 */
const Card = ({ children, className = "", header, noPadding = false, isDarkMode }) => (
  <div
    className={`
      relative flex flex-col rounded-2xl border overflow-hidden
      transition-all duration-200 hover:shadow-md
      ${isDarkMode
        ? "bg-stone-900 border-gray-800"
        : "bg-white border-gray-100 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]"}
      ${className}
    `}
  >
    {header && <div className="px-5 pt-5 pb-0 shrink-0">{header}</div>}
    <div className={`flex-1 ${noPadding ? "" : "p-5 pt-3"}`}>{children}</div>
  </div>
);

/**
 * CardHeader — consistent label + icon row used at the top of every Card.
 */
const CardHeader = ({ title, icon: Icon, color = "muted", action, isDarkMode }) => {
  const t = TOKEN[color] ?? TOKEN.muted;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={`inline-flex p-1.5 rounded-lg ${t.bg} ${t.text}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        )}
        <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
          {title}
        </span>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

/**
 * StatRow — a single label / value pair inside a card.
 */
const StatRow = ({ label, value, color = "muted", isDarkMode }) => {
  const t = TOKEN[color] ?? TOKEN.muted;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDarkMode ? "bg-stone-800/60" : "bg-stone-50"}`}>
      <span className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
      <span className={`text-sm font-bold font-mono ${t.text}`}>{value}</span>
    </div>
  );
};

/**
 * ChartShell — wraps a Recharts chart in a responsive container with a
 * consistent height. Prevents individual charts from needing their own
 * ResponsiveContainer boilerplate.
 */
const ChartShell = ({ children, height = 220 }) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  </div>
);

/**
 * DashTooltip — unified Recharts tooltip that respects dark/light mode.
 */
const DashTooltip = ({ active, payload, label, isDarkMode, format = (v) => v }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`px-3 py-2.5 rounded-xl border text-sm shadow-xl
        ${isDarkMode ? "bg-stone-800 border-gray-700 text-gray-100" : "bg-white border-gray-100 text-gray-800"}`}
    >
      {label && <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 font-mono font-bold">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          {format(p.value)}
        </div>
      ))}
    </div>
  );
};

/**
 * AnimatedKpiValue — renders a counter-animated currency amount.
 * Re-animates whenever `target` changes.
 */
const AnimatedKpiValue = ({ target = 0, compact = true, className = "" }) => {
  const animated = useAnimatedCounter(target);
  return <span className={className}>{formatPHP(animated, compact)}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── 6a. Alert Banner ─────────────────────────────────────────────────────────

const AlertBanner = ({ alerts }) => {
  if (!alerts.length) return null;
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/25 animate-in slide-in-from-top-2 duration-300">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="text-sm font-bold">{alerts.length} Action {alerts.length === 1 ? "Item" : "Items"}:</span>
      <span className="text-sm opacity-90">{alerts.map((a) => a.msg).join(" · ")}</span>
    </div>
  );
};

// ── 6b. Hero KPI (inverted card) ─────────────────────────────────────────────

const HeroKpi = ({ title, target, sub, icon: Icon, trend, isDarkMode }) => (
  <div
    className={`
      relative flex flex-col justify-between p-6 rounded-2xl overflow-hidden
      min-h-[170px] transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5
      ${isDarkMode ? "bg-white text-gray-900" : "bg-stone-900 text-white"}
    `}
  >
    {/* Decorative blob */}
    <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full opacity-[0.07] bg-white pointer-events-none" />

    <div className="flex items-start justify-between z-10">
      <span className={`inline-flex p-2.5 rounded-xl ${isDarkMode ? "bg-black/10" : "bg-white/10"}`}>
        <Icon className="w-5 h-5" />
      </span>
      {trend !== undefined && (
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
          ${trend >= 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"}`}
        >
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>

    <div className="z-10">
      <p className={`text-[10px] uppercase tracking-[0.15em] font-bold mb-1 ${isDarkMode ? "text-gray-400" : "text-gray-400"}`}>
        {title}
      </p>
      <AnimatedKpiValue
        target={target}
        compact
        className="text-[2rem] font-black leading-none tracking-tight"
      />
      {sub && (
        <p className={`text-xs mt-1.5 font-medium ${isDarkMode ? "text-gray-400" : "text-gray-400"}`}>{sub}</p>
      )}
    </div>
  </div>
);

// ── 6c. Accent KPI (standard card) ───────────────────────────────────────────

const AccentKpi = ({ title, target, sub, icon: Icon, color, isDarkMode }) => {
  const t = TOKEN[color] ?? TOKEN.muted;
  return (
    <div
      className={`
        flex flex-col justify-between p-5 rounded-2xl border min-h-[150px]
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-white border-gray-100 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]"}
      `}
    >
      <span className={`inline-flex w-fit p-2.5 rounded-xl ${t.bg} ${t.text}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className={`text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
          {title}
        </p>
        <AnimatedKpiValue
          target={target}
          compact
          className={`text-2xl font-black leading-tight ${isDarkMode ? "text-white" : "text-gray-900"}`}
        />
        {sub && (
          <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>
        )}
      </div>
    </div>
  );
};

// ── 6d. KPI Strip Row ─────────────────────────────────────────────────────────

const KpiStrip = ({ kpis, isDarkMode }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
    {/* Hero spans 2 columns */}
    <div className="col-span-2">
      <HeroKpi
        title="Total Revenue"
        target={kpis.totalRevenue}
        sub={`${kpis.invoiceCount} invoices year-to-date`}
        icon={DollarSign}
        trend={12}
        isDarkMode={isDarkMode}
      />
    </div>

    <AccentKpi title="Receivables"  target={kpis.totalReceivables} sub="Pending collections" icon={Users}    color="cyan"    isDarkMode={isDarkMode} />
    <AccentKpi title="Disbursed"    target={kpis.checkTotal}       sub="Check vouchers"      icon={Banknote} color="emerald" isDarkMode={isDarkMode} />
    <AccentKpi title="VAT Output"   target={kpis.totalVAT}         sub="Tax liability"       icon={Shield}   color="violet"  isDarkMode={isDarkMode} />
  </div>
);

// ── 6e. Charts Row ────────────────────────────────────────────────────────────

const RevenueChart = ({ data, totalRevenue, isDarkMode }) => (
  <Card
    className="lg:col-span-3"
    isDarkMode={isDarkMode}
    header={<CardHeader title="Revenue Flow" icon={Activity} color="ink" isDarkMode={isDarkMode} />}
  >
    <ChartShell height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={isDarkMode ? "#fff" : TOKEN.ink.hex} stopOpacity={0.2} />
            <stop offset="95%" stopColor={isDarkMode ? "#fff" : TOKEN.ink.hex} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? GRID_PALETTE.dark : GRID_PALETTE.light} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? "#4b5563" : "#9ca3af" }} dy={8} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? "#4b5563" : "#9ca3af" }} tickFormatter={(v) => formatPHP(v, true)} width={54} />
        <Tooltip content={(p) => <DashTooltip {...p} isDarkMode={isDarkMode} format={(v) => formatPHP(v)} />} />
        <Area
          type="monotone" dataKey="amount"
          stroke={isDarkMode ? "#e5e7eb" : TOKEN.ink.hex}
          strokeWidth={2.5}
          fill="url(#revGrad)"
          activeDot={{ r: 5, strokeWidth: 0, fill: isDarkMode ? "#fff" : TOKEN.ink.hex }}
          dot={false}
        />
      </AreaChart>
    </ChartShell>
  </Card>
);

const SalesMixChart = ({ data, totalRevenue, isDarkMode }) => (
  <Card
    className="lg:col-span-2"
    isDarkMode={isDarkMode}
    header={<CardHeader title="Sales Mix" icon={LayoutGrid} color="violet" isDarkMode={isDarkMode} />}
  >
    <div className="relative">
      <ChartShell height={230}>
        <PieChart>
          <Pie data={data} innerRadius={68} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatPHP(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }} />
        </PieChart>
      </ChartShell>

      {/* Centred label overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-[9px] uppercase tracking-widest font-bold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>Total</span>
        <span className={`text-lg font-black leading-tight ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {formatPHP(totalRevenue, true)}
        </span>
      </div>
    </div>

    {/* Legend pills */}
    <div className="mt-1 space-y-1">
      {data.slice(0, 4).map((d, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
            <span className={`text-[11px] font-medium capitalize ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{d.name}</span>
          </div>
          <span className={`text-[11px] font-bold font-mono ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{formatPHP(d.value, true)}</span>
        </div>
      ))}
    </div>
  </Card>
);

const ChartsSection = ({ charts, kpis, isDarkMode }) => (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
    <RevenueChart data={charts.revenueChart} totalRevenue={kpis.totalRevenue} isDarkMode={isDarkMode} />
    <SalesMixChart data={charts.saleTypeChart} totalRevenue={kpis.totalRevenue} isDarkMode={isDarkMode} />
  </div>
);

// ── 6f. Operations Row ────────────────────────────────────────────────────────

const BillsChart = ({ data, isDarkMode }) => (
  <Card
    isDarkMode={isDarkMode}
    header={<CardHeader title="Operational Costs" icon={CalendarDays} color="amber" isDarkMode={isDarkMode} />}
  >
    <ChartShell height={220}>
      <BarChart data={data} barSize={28} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1f2937" : "#f3f4f6"} />
        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? "#4b5563" : "#9ca3af" }} dy={8} />
        <Tooltip content={(p) => <DashTooltip {...p} isDarkMode={isDarkMode} format={(v) => formatPHP(v)} />} cursor={{ fill: "transparent" }} />
        <Bar dataKey="electricity" stackId="a" fill={BAR_PALETTE.electricity}   radius={[0,0,0,0]} />
        <Bar dataKey="water"       stackId="a" fill={BAR_PALETTE.water}    />
        <Bar dataKey="internet"    stackId="a" fill={BAR_PALETTE.internet}  />
        <Bar dataKey="other"       stackId="a" fill={BAR_PALETTE.other}           radius={[4,4,0,0]} />
      </BarChart>
    </ChartShell>

    {/* Stacked bar legend */}
    <div className="mt-2 flex flex-wrap gap-3">
      {[
        { label: "Electricity", color: BAR_PALETTE.electricity },
        { label: "Water",       color: BAR_PALETTE.water  },
        { label: "Internet",    color: BAR_PALETTE.internet },
        { label: "Other",       color: BAR_PALETTE.other        },
      ].map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
          <span className={`text-[11px] font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{l.label}</span>
        </div>
      ))}
    </div>
  </Card>
);

const PettyCashGauge = ({ budget, isDarkMode }) => {
  // Gauge arc via SVG — no CSS conic hack needed
  const radius  = 60;
  const cx      = 80;
  const cy      = 80;
  const circ    = 2 * Math.PI * radius;
  const pct     = Math.min(budget.pct, 100);
  const dashLen = (pct / 100) * circ;
  const gapLen  = circ - dashLen;
  const isCritical = pct > 80;
  const gaugeColor = isCritical ? TOKEN.rose.hex : TOKEN.emerald.hex;

  return (
    <Card
      isDarkMode={isDarkMode}
      header={<CardHeader title="Petty Cash" icon={PiggyBank} color="rose" isDarkMode={isDarkMode} />}
    >
      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="relative">
          <svg viewBox="0 0 160 160" className="w-36 h-36">
            {/* Track */}
            <circle
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={isDarkMode ? GRID_PALETTE.dark : GRID_PALETTE.light}
              strokeWidth={14}
            />
            {/* Progress */}
            <circle
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${dashLen} ${gapLen}`}
              strokeDashoffset={circ * 0.25}   /* start at 12 o'clock */
              style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          {/* Centre text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black leading-none ${isCritical ? TOKEN.rose.text : TOKEN.emerald.text}`}>
              {pct.toFixed(0)}%
            </span>
            <span className={`text-[9px] uppercase tracking-widest font-bold mt-0.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
              used
            </span>
          </div>
        </div>

        <div className="w-full space-y-1.5">
          <StatRow label="Total Budget" value={formatPHP(budget.total)}   color="muted"   isDarkMode={isDarkMode} />
          <StatRow label="Remaining"    value={formatPHP(budget.balance)} color="emerald" isDarkMode={isDarkMode} />
        </div>
      </div>
    </Card>
  );
};

const TopClients = ({ clients, isDarkMode }) => {
  const maxReceivable = Math.max(...clients.map((c) => c.receivables), 1);
  return (
    <Card
      isDarkMode={isDarkMode}
      header={<CardHeader title="Top Clients" icon={Users} color="cyan" isDarkMode={isDarkMode} />}
    >
      <div className="space-y-3 pt-1">
        {clients.length === 0 && (
          <p className={`text-sm text-center py-6 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>No client data</p>
        )}
        {clients.map((c, i) => {
          const barPct = Math.max(4, (c.receivables / maxReceivable) * 100);
          return (
            <div key={i} className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                  ${isDarkMode ? "bg-stone-800 text-cyan-400" : "bg-cyan-50 text-cyan-700"}`}
              >
                {c.name.substring(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate mb-1 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{c.name}</p>
                <div className={`h-1 w-full rounded-full ${isDarkMode ? "bg-stone-800" : "bg-stone-100"}`}>
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              <span className={`text-[11px] font-mono font-bold shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {formatPHP(c.receivables, true)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const OperationsSection = ({ charts, budget, topCustomers, isDarkMode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
    <BillsChart    data={charts.billsChart} isDarkMode={isDarkMode} />
    <PettyCashGauge budget={budget}         isDarkMode={isDarkMode} />
    <TopClients    clients={topCustomers}   isDarkMode={isDarkMode} />
  </div>
);

// ── 6g. Bottom Row ────────────────────────────────────────────────────────────

const PendingBillsCard = ({ amount, isDarkMode }) => (
  <div
    className={`
      flex flex-col justify-between p-5 rounded-2xl border min-h-[180px]
      transition-all duration-200 hover:shadow-md
      ${isDarkMode ? "bg-stone-900 border-gray-800" : "bg-stone-50 border-gray-100"}
    `}
  >
    <div className="flex items-center gap-2.5">
      <span className="inline-flex p-2 rounded-xl bg-amber-100 text-amber-600">
        <RefreshCw className="w-4 h-4" />
      </span>
      <span className={`text-[10px] uppercase tracking-[0.15em] font-bold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
        Pending Bills
      </span>
    </div>

    <div>
      <AnimatedKpiValue
        target={amount}
        compact
        className={`text-3xl font-black leading-tight ${isDarkMode ? "text-white" : "text-gray-900"}`}
      />
      <p className={`text-xs mt-1 font-medium ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
        Awaiting payment
      </p>
    </div>

    <button className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors
      ${isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
    >
      View all <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const CheckVoucherChart = ({ data, isDarkMode }) => (
  <Card
    className="md:col-span-2"
    isDarkMode={isDarkMode}
    header={<CardHeader title="Check Voucher Trend" icon={CreditCard} color="emerald" isDarkMode={isDarkMode} />}
  >
    <ChartShell height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="checkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={TOKEN.emerald.hex} stopOpacity={0.25} />
            <stop offset="95%" stopColor={TOKEN.emerald.hex} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1f2937" : "#f3f4f6"} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? "#4b5563" : "#9ca3af" }} dy={8} />
        <Tooltip content={(p) => <DashTooltip {...p} isDarkMode={isDarkMode} format={(v) => formatPHP(v)} />} />
        <Area
          type="monotone" dataKey="amount"
          stroke={TOKEN.emerald.hex} strokeWidth={2.5}
          fill="url(#checkGrad)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: TOKEN.emerald.hex }}
        />
      </AreaChart>
    </ChartShell>
  </Card>
);

const BottomSection = ({ kpis, charts, isDarkMode }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
    <PendingBillsCard amount={kpis.billsPending} isDarkMode={isDarkMode} />
    <CheckVoucherChart data={charts.checkChart}  isDarkMode={isDarkMode} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FinanceDashboard
 *
 * Props:
 *   financeData    {object}   — raw API payload (dashboardSummary key)
 *   onRefresh      {function} — callback to re-fetch data
 *   lastUpdatedAt  {string}   — ISO timestamp string
 */
const FinanceDashboard = ({ financeData = {}, onRefresh, lastUpdatedAt = null }) => {
  const { isDarkMode } = useAuth();
  const { kpis, charts, budget, topCustomers, alerts } = useDashboardData(financeData);

  const handleRefresh = useCallback(() => onRefresh?.(), [onRefresh]);

  const formattedTime = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-4 md:space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            Financial Overview
          </h1>
          <p className={`mt-1 text-sm font-medium ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
            Real-time insights across all finance modules
            {formattedTime && <span className="ml-2 opacity-60">· Updated {formattedTime}</span>}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className={`
            inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm
            transition-all duration-150 hover:scale-105 active:scale-95
            ${isDarkMode
              ? "bg-white text-gray-900 hover:bg-stone-100"
              : "bg-stone-900 text-white hover:bg-stone-700"}
          `}
        >
          <RefreshCw className="w-4 h-4" />
          Sync Data
        </button>
      </div>

      {/* ── Alert Banner ────────────────────────────────────────────── */}
      <AlertBanner alerts={alerts} />

      {/* ── KPI Strip ───────────────────────────────────────────────── */}
      <KpiStrip kpis={kpis} isDarkMode={isDarkMode} />

      {/* ── Revenue + Sales Mix ─────────────────────────────────────── */}
      <ChartsSection charts={charts} kpis={kpis} isDarkMode={isDarkMode} />

      {/* ── Bills · Petty Cash · Top Clients ────────────────────────── */}
      <OperationsSection
        charts={charts}
        budget={budget}
        topCustomers={topCustomers}
        isDarkMode={isDarkMode}
      />

      {/* ── Pending Bills + Check Voucher Trend ─────────────────────── */}
      <BottomSection kpis={kpis} charts={charts} isDarkMode={isDarkMode} />

      {/* ── Combined Report Export ───────────────────────────────────── */}
      <CombinedReportExport dateRange={{ year: new Date().getFullYear() }} />

    </div>
  );
};

export default FinanceDashboard;