"use client";

import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useLogoutSync } from "../../hooks/useLogoutSync";
import apiService from "../../utils/api/api-service";

// FPD Components
import { MenuButton } from "../fpd/components/main_ui";

// Shared Components
import ProfileMenu from "../shared/ProfileMenu";

import {
  LuLayoutDashboard,
  LuFileText,
  LuClipboardList,
  LuChartPie,
  LuWallet,
  LuTicket,
  LuReceipt,
  LuPlus,
  LuX,
  LuMenu,
  LuSun,
  LuMoon,
  LuChevronDown,
  LuUsers,
  LuBanknote,
  LuScanText,
  LuRefreshCw,
} from "react-icons/lu";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
// dark  = true-black palette
// light = warm off-white / zinc palette
const T = {
  dark: {
    root:        "bg-[#080808]",
    sidebar:     "bg-[#0e0e0e] border-white/[0.06]",
    sidebarHdr:  "border-white/[0.06]",
    header:      "bg-[#0e0e0e] border-white/[0.06]",
    card:        "bg-[#161616] border-white/[0.07]",
    hover:       "hover:bg-white/[0.05]",
    hoverCard:   "hover:bg-white/[0.04]",
    active:      "bg-white/[0.08] text-white",
    text1:       "text-zinc-100",
    text2:       "text-zinc-400",
    text3:       "text-zinc-600",
    muted:       "text-zinc-500",
    badge:       "bg-zinc-800 text-zinc-300",
    badgeActive: "bg-white text-black",
    divider:     "border-white/[0.06]",
    toggleBtn:   "border-white/10 hover:bg-white/[0.07] text-zinc-400",
    groupBtn:    "bg-black/40 text-zinc-400 hover:bg-white/[0.05]",
    spinner:     "border-zinc-400",
    errBg:       "bg-red-950/40 border-red-900/60",
    errText:     "text-red-400",
    ocrBtn:      "bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60",
    qaBtn:       "bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700",
    overlay:     "bg-black/80 backdrop-blur-sm",
    modal:       "bg-[#0e0e0e] border-white/[0.08]",
    modalHdr:    "bg-[#0e0e0e] border-white/[0.07]",
    modalClose:  "text-zinc-400 hover:bg-white/[0.07]",
    scrollbar:   "scrollbar-dark",
    accentDot:   "bg-emerald-400",
    logoRing:    "ring-white/10",
    userAvatar:  "from-zinc-700 to-zinc-900",
  },
  light: {
    root:        "bg-zinc-50",
    sidebar:     "bg-white border-zinc-200",
    sidebarHdr:  "border-zinc-200",
    header:      "bg-white border-zinc-200",
    card:        "bg-white border-zinc-200",
    hover:       "hover:bg-zinc-100",
    hoverCard:   "hover:bg-zinc-50",
    active:      "bg-zinc-900 text-white",
    text1:       "text-zinc-900",
    text2:       "text-zinc-600",
    text3:       "text-zinc-400",
    muted:       "text-zinc-500",
    badge:       "bg-zinc-100 text-zinc-600",
    badgeActive: "bg-white text-zinc-900 ring-1 ring-zinc-300",
    divider:     "border-zinc-200",
    toggleBtn:   "border-zinc-200 hover:bg-zinc-100 text-zinc-600",
    groupBtn:    "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
    spinner:     "border-zinc-500",
    errBg:       "bg-red-50 border-red-200",
    errText:     "text-red-600",
    ocrBtn:      "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700",
    qaBtn:       "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800",
    overlay:     "bg-black/60 backdrop-blur-sm",
    modal:       "bg-white border-zinc-200",
    modalHdr:    "bg-white border-zinc-200",
    modalClose:  "text-zinc-500 hover:bg-zinc-100",
    scrollbar:   "scrollbar-light",
    accentDot:   "bg-emerald-500",
    logoRing:    "ring-zinc-200",
    userAvatar:  "from-zinc-600 to-zinc-800",
  },
};

const DashboardSection = lazy(() => import("../fpd/sections/DashboardSection"));
const SalesInvoiceSection = lazy(() => import("../fpd/sections/SalesInvoiceSection"));
const ExpensesSection = lazy(() => import("../fpd/sections/ExpensesSection"));
const VouchersSection = lazy(() => import("../fpd/sections/VouchersSection"));
const ValesSection = lazy(() => import("../fpd/sections/ValesSection"));
const MonthlyBillsSection = lazy(() => import("../fpd/sections/MonthlyBillsSection"));
const PayrollSection = lazy(() => import("../fpd/sections/PayrollSection"));
const PayrollCheckingSection = lazy(() => import("../fpd/sections/PayrollCheckingSection"));
const FinanceDocumentIngestionPage = lazy(() => import("../../features/finance-documents/pages/FinanceDocumentIngestionPage"));

function FinancePayrollDepartment() {
  const [logoSpin, setLogoSpin] = useState(false);
  const [spinStyle, setSpinStyle] = useState({});
  const logoSpinTimeoutRef = useRef(null);

  const handleLogoClick = () => {
    const spins = Math.floor(Math.random() * 4) + 2;
    const angle = 360 * spins;
    const duration = 0.8 + spins * 0.25;
    setSpinStyle({
      "--coin-spin-angle": `${angle}deg`,
      "--coin-spin-duration": `${duration}s`,
    });
    setLogoSpin(true);
    if (logoSpinTimeoutRef.current) clearTimeout(logoSpinTimeoutRef.current);
    logoSpinTimeoutRef.current = setTimeout(() => {
      setLogoSpin(false);
      logoSpinTimeoutRef.current = null;
    }, duration * 1000);
  };

  useEffect(() => {
    const styleId = "coin-spin-keyframes";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        @keyframes coin-spin {
          0%   { transform: rotateY(0deg); }
          80%  { transform: rotateY(var(--coin-spin-angle, 1080deg)); }
          100% { transform: rotateY(var(--coin-spin-angle, 1080deg)); }
        }
        .animate-coin-spin {
          animation: coin-spin var(--coin-spin-duration, 1.5s) cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        /* custom scrollbar – dark */
        .scrollbar-dark::-webkit-scrollbar { width: 4px; }
        .scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-dark::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 999px; }
        .scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
        /* custom scrollbar – light */
        .scrollbar-light::-webkit-scrollbar { width: 4px; }
        .scrollbar-light::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-light::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 999px; }
        .scrollbar-light::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
        /* sidebar item transition */
        .nav-item { transition: background 120ms ease, color 120ms ease; }
        /* subtle pulse for active accent dot */
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .dot-pulse { animation: dot-pulse 2.4s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    return () => {
      if (logoSpinTimeoutRef.current) {
        clearTimeout(logoSpinTimeoutRef.current);
        logoSpinTimeoutRef.current = null;
      }
    };
  }, []);

  const { user, logout, isDarkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  useLogoutSync('/jjcewgsaccess/finance');

  const t = isDarkMode ? T.dark : T.light;

  const handleEmployeeDashboard = () => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('employeeToken');
      if (token) {
        sessionStorage.setItem('nav_auth_token', JSON.stringify({
          token, username: user?.username, timestamp: Date.now(),
        }));
        window.location.href = '/employee/dashboard?autoLogin=true&loginType=admin';
      } else {
        navigate('/employee/dashboard');
      }
    } catch {
      navigate('/employee/dashboard');
    }
  };

  const [activeSection, setActiveSection] = useState("dashboard");
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeVoucherTab, setActiveVoucherTab] = useState("cash");
  const [voucherHighlight, setVoucherHighlight] = useState(null);
  const [financeData, setFinanceData] = useState({
    dashboardSummary: {},
    salesInvoices: { total: 0, totalAmount: 0, totalVatableSales: 0, totalVat: 0, totalZeroRated: 0, chart: [] },
    expenses: { total: 0, monthly: 0, count: 0, chart: [] },
    vouchers: { total: 0, approved: 0, pending: 0, rejected: 0, totalAmount: 0, chart: [] },
    vales: { total: 0, pending: 0, approved: 0, active: 0, fullyPaid: 0, defaulted: 0, totalAmount: 0, totalOutstanding: 0, activeBalance: 0 },
    monthlyBills: { total: 0, paid: 0, pending: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardLastUpdatedAt, setDashboardLastUpdatedAt] = useState(null);
  const financeRefreshTimeoutRef = useRef(null);
  const hasHandledInitialDashboardSectionRef = useRef(false);

  const getVoucherTypeFromNumber = (voucherNumber) => {
    if (typeof voucherNumber !== "string") return "cash";
    if (voucherNumber.startsWith("PCV-")) return "petty_cash";
    if (voucherNumber.startsWith("CHK-")) return "check";
    return "cash";
  };

  const resolveVouchersInitialTab = (sectionId) => {
    if (sectionId === "vouchers-check" || sectionId === "vouchers-payees") return "check";
    if (sectionId === "vouchers-petty-cash" || sectionId === "vouchers-summary") return "petty_cash";
    return "cash";
  };

  useEffect(() => {
    fetchFinanceData();

    const scheduleFinanceRefresh = () => {
      if (financeRefreshTimeoutRef.current) clearTimeout(financeRefreshTimeoutRef.current);
      financeRefreshTimeoutRef.current = setTimeout(() => fetchFinanceData(), 250);
    };

    const dashboardRefreshEvents = [
      "finance:invoice_created", "finance:invoice_updated", "finance:invoice_deleted", "finance:invoices_imported",
      "finance:monthly_bill_created", "finance:monthly_bill_updated", "finance:monthly_bill_deleted",
      "finance:cash_voucher_created", "finance:cash_voucher_updated", "finance:cash_voucher_deleted",
      "finance:check_voucher_created", "finance:check_voucher_updated", "finance:check_voucher_deleted",
      "finance:petty_cash_voucher_created", "finance:petty_cash_voucher_updated", "finance:petty_cash_voucher_deleted",
      "finance:petty_cash_vouchers_imported", "pettyCashBudgetUpdated", "pettyCashVoucherApproved", "pettyCashVoucherCancelled",
    ];

    const dashboardUnsubs = dashboardRefreshEvents.map(e => apiService.socket.subscribeToUpdates(e, () => scheduleFinanceRefresh()));

    return () => {
      dashboardUnsubs.forEach(u => u?.());
      if (financeRefreshTimeoutRef.current) clearTimeout(financeRefreshTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "dashboard") return;

    if (!hasHandledInitialDashboardSectionRef.current) {
      hasHandledInitialDashboardSectionRef.current = true;
      return;
    }

    fetchFinanceData();
  }, [activeSection]);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.finance.getDashboardData();
      setFinanceData({
        dashboardSummary: response.dashboardSummary || {},
        salesInvoices: response.salesInvoices || { total: 0, totalAmount: 0, totalVatableSales: 0, totalVat: 0, totalZeroRated: 0, chart: [] },
        expenses: response.expenses || { total: 0, monthly: 0, count: 0, chart: [] },
        vouchers: response.vouchers || { total: 0, approved: 0, pending: 0, rejected: 0, totalAmount: 0, chart: [] },
        vales: response.vales || { total: 0, pending: 0, approved: 0, active: 0, fullyPaid: 0, defaulted: 0, totalAmount: 0, totalOutstanding: 0, activeBalance: 0 },
        monthlyBills: response.monthlyBills || { total: 0, paid: 0, pending: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 },
      });
      setDashboardLastUpdatedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const navigationItems = [
    {
      id: "dashboard", label: "Overview", icon: <LuLayoutDashboard size={18} />,
    },
    {
      id: "revenue", label: "Revenue", isGroup: true,
      items: [
        {
          id: "sales-invoice", label: "Invoices", icon: <LuFileText size={18} />, hasSubmenu: true,
          submenu: [
            { id: "sales-invoice-records", label: "All Invoices", icon: <LuClipboardList size={16} /> },
            { id: "sales-invoice-customers", label: "Customers", icon: <LuUsers size={16} /> },
            { id: "sales-invoice-summary", label: "Reports", icon: <LuChartPie size={16} /> },
          ],
        },
      ],
    },
    {
      id: "payables", label: "Payables", isGroup: true,
      items: [
        {
          id: "vouchers", label: "Vouchers", icon: <LuTicket size={18} />, hasSubmenu: true,
          submenu: [
            { id: "vouchers-cash", label: "Cash Vouchers", icon: <LuFileText size={16} /> },
            { id: "vouchers-check", label: "Check Vouchers", icon: <LuUsers size={16} /> },
            { id: "vouchers-petty-cash", label: "Petty Cash", icon: <LuChartPie size={16} /> },
          ],
        },
        {
          id: "monthly-bills", label: "Bills", icon: <LuReceipt size={18} />, hasSubmenu: true,
          submenu: [
            { id: "monthly-bills-records", label: "All Bills", icon: <LuReceipt size={16} /> },
            { id: "monthly-bills-providers", label: "Providers", icon: <LuUsers size={16} /> },
          ],
        },
        { id: "expenses", label: "General Expenses", icon: <LuWallet size={18} /> },
      ],
    },
    {
      id: "payroll-group", label: "Payroll", isGroup: true,
      items: [
        { id: "payroll", label: "Processing", icon: <LuBanknote size={18} /> },
        { id: "vales", label: "Cash Advances", icon: <LuWallet size={18} /> },
        { id: "payroll-checking", label: "Payroll Checking", icon: <LuClipboardList size={18} /> },
      ],
    },
  ];

  const activeNavItem =
    navigationItems.find(it => it.id === activeSection) ||
    navigationItems.find(g => g.isGroup && g.items?.some(c => c.id === activeSection || c.submenu?.some(s => s.id === activeSection)))
      ?.items?.find(c => c.id === activeSection || c.submenu?.some(s => s.id === activeSection)) ||
    null;
  const activeLabel = activeNavItem?.label ?? "Dashboard";

  const sectionSubtitles = {
    dashboard: "Your financial overview at a glance",
    "sales-invoice": "Manage invoices and billing",
    "sales-invoice-records": "Manage invoices and billing",
    "sales-invoice-customers": "Manage customer directories",
    "sales-invoice-summary": "Analytics and revenue reports",
    expenses: "Record general operational expenses",
    vouchers: "Manage payment vouchers and check requests",
    "vouchers-cash": "Manage cash vouchers",
    "vouchers-check": "Manage check vouchers",
    "vouchers-petty-cash": "Track petty cash vouchers",
    vales: "Employee cash advances & salary loans",
    payroll: "Process payroll and salary disbursements",
    "payroll-checking": "Verify payroll outputs and discrepancies",
    "monthly-bills": "Monitor recurring utility bills and subscriptions",
    "monthly-bills-records": "Monitor recurring utility bills and subscriptions",
    "monthly-bills-providers": "Manage utility and service providers",
  };

  const inferOcrContext = (sectionId) => {
    if (sectionId.startsWith("sales-invoice")) return { type: "sales_invoice", label: "Sales Invoices" };
    if (sectionId.startsWith("monthly-bills")) return { type: "bill", label: "Monthly Bills" };
    if (sectionId.startsWith("vouchers")) return { type: "voucher", label: "Vouchers" };
    if (sectionId === "expenses") return { type: "expense", label: "Expenses" };
    return null;
  };

  const ocrContext = inferOcrContext(activeSection);
  const resolvedVoucherTabForHint = activeSection === "vouchers"
    ? activeVoucherTab
    : resolveVouchersInitialTab(activeSection);
  const ocrSourceSectionHint = activeSection.startsWith("vouchers") ? `vouchers-${resolvedVoucherTabForHint}` : activeSection;

  const quickAction = (() => {
    if (activeSection.startsWith("sales-invoice")) return { label: "New Invoice", event: "fpd:quick-new-invoice" };
    if (activeSection === "expenses") return { label: "Add Expense", event: "fpd:quick-add-expense" };
    return null;
  })();

  const triggerQuickAction = () => {
    if (quickAction?.event) window.dispatchEvent(new CustomEvent(quickAction.event));
  };

  // ─── CollapsibleGroup ────────────────────────────────────────────────────────
  function CollapsibleGroup({ group }) {
    const [open, setOpen] = useState(true);

    const getCountBadge = (childId) => {
      switch (childId) {
        case "vouchers":     return financeData.vouchers?.pending || 0;
        case "sales-invoice": return financeData.salesInvoices?.total || 0;
        case "monthly-bills": return financeData.monthlyBills?.pending || 0;
        case "vales":        return financeData.vales?.pending || 0;
        default:             return null;
      }
    };

    if (!sidebarOpen) {
      return (
        <div className="mb-3 space-y-0.5">
          {group.items.map(child => (
            <MenuButton
              key={child.id}
              item={child}
              nested={false}
              activeSection={activeSection}
              sidebarOpen={sidebarOpen}
              onClick={(id) => { setActiveSection(id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
              onSubItemClick={(subId) => { setActiveSection(subId); if (window.innerWidth < 1024) setSidebarOpen(false); }}
              menuItems={child.submenu || []}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="mb-1">
        {/* Group header */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`nav-item w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-1 ${t.groupBtn}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{group.label}</span>
          <LuChevronDown
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
            size={12}
          />
        </button>

        {/* Children */}
        <div
          className="overflow-hidden transition-all duration-200 ease-out"
          style={{ maxHeight: open ? `${group.items.length * 120}px` : 0, opacity: open ? 1 : 0 }}
        >
          <div className="space-y-0.5 pl-1 pr-1 pb-2">
            {group.items.map(child => {
              const count = getCountBadge(child.id);
              const isActive = child.id === activeSection || child.submenu?.some(s => s.id === activeSection);
              return (
                <div key={child.id} className="relative">
                  <MenuButton
                    item={child}
                    nested={true}
                    activeSection={activeSection}
                    sidebarOpen={sidebarOpen}
                    onClick={(id) => { setActiveSection(id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                    onSubItemClick={(subId) => { setActiveSection(subId); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                    menuItems={child.submenu || []}
                  />
                  {count > 0 && (
                    <span className={`pointer-events-none absolute right-3 top-[18px] -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? t.badgeActive : t.badge
                    }`}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`flex h-screen overflow-hidden font-sans antialiased ${t.root}`}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-40 lg:hidden ${t.overlay}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`
        ${sidebarOpen ? "translate-x-0 w-60" : "-translate-x-full lg:translate-x-0 lg:w-[60px]"}
        fixed lg:relative inset-y-0 left-0 z-50
        border-r flex flex-col
        transition-all duration-300 ease-in-out
        shadow-2xl lg:shadow-none
        ${t.sidebar}
      `}>

        {/* Logo row */}
        <div className={`h-[60px] flex items-center justify-between px-4 border-b shrink-0 ${t.sidebarHdr}`}>
          <div className={sidebarOpen ? "flex items-center gap-3" : "hidden lg:flex lg:justify-center w-full"}>
            <div className={`relative shrink-0 rounded-xl ring-1 overflow-hidden ${t.logoRing}`}>
              <img
                src="http://jjcenggworks.com/api/images/finance/finance_logo.png"
                alt="Finance Hub"
                className={`h-8 w-8 select-none cursor-pointer object-cover ${logoSpin ? "animate-coin-spin" : ""}`}
                style={{ ...spinStyle }}
                draggable="false"
                onClick={handleLogoClick}
                title="Spin the coin!"
              />
            </div>
            {sidebarOpen && (
              <div>
                <p className={`text-sm font-bold tracking-tight leading-none ${t.text1}`}>JJC Finance</p>
                <p className={`text-[10px] font-medium mt-0.5 ${t.muted}`}>Hub</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-1.5 rounded-lg transition-colors lg:hidden ${t.toggleBtn}`}
            >
              <LuX size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-3 px-2 space-y-3 ${t.scrollbar}`}>
          {navigationItems.map(item =>
            item.isGroup ? (
              <CollapsibleGroup key={item.id} group={item} />
            ) : (
              <div key={item.id}>
                <MenuButton
                  item={item}
                  activeSection={activeSection}
                  sidebarOpen={sidebarOpen}
                  onClick={(id) => { setActiveSection(id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  onSubItemClick={(subId) => { setActiveSection(subId); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  menuItems={item.submenu || []}
                />
              </div>
            )
          )}
        </nav>

        {/* User footer */}
        <div className={`border-t p-3 space-y-2.5 shrink-0 ${t.divider}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br ${t.userAvatar}`}>
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate leading-tight ${t.text1}`}>{user?.name || "User"}</p>
                <p className={`text-[10px] truncate ${t.muted}`}>Finance Dept.</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${t.userAvatar}`}>
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            </div>
          )}

          <button
            onClick={toggleDarkMode}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${t.toggleBtn}`}
          >
            {isDarkMode ? <LuSun size={14} /> : <LuMoon size={14} />}
            {sidebarOpen && <span>{isDarkMode ? "Light" : "Dark"}</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

        {/* Mobile hamburger */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden fixed top-3.5 left-3.5 z-30 p-2 rounded-lg border shadow-md ${isDarkMode ? "bg-[#0e0e0e] border-white/10 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"}`}
          >
            <LuMenu size={18} />
          </button>
        )}

        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <header className={`h-[60px] shrink-0 flex items-center justify-between px-5 sm:px-6 border-b z-20 ${t.header}`}>
          {/* Left: title + breadcrumb */}
          <div className="pl-10 sm:pl-0 min-w-0">
            <div className="flex items-center gap-2.5">
              {activeSection !== "dashboard" && (
                <span className={`hidden sm:block text-xs font-medium ${t.muted}`}>
                  Finance Hub
                  <span className="mx-1.5 opacity-40">/</span>
                </span>
              )}
              <h1 className={`text-base sm:text-lg font-bold tracking-tight truncate ${t.text1}`}>
                {activeLabel}
              </h1>
              {/* live dot on dashboard */}
              {activeSection === "dashboard" && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 dot-pulse ${t.accentDot}`} title="Live data" />
              )}
            </div>
            <p className={`text-xs hidden sm:block mt-0.5 truncate ${t.text2}`}>
              {sectionSubtitles[activeSection] || ""}
            </p>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {/* Refresh (dashboard only) */}
            {activeSection === "dashboard" && (
              <button
                onClick={fetchFinanceData}
                disabled={loading}
                className={`p-2 rounded-lg border transition-colors ${t.toggleBtn} disabled:opacity-40`}
                title="Refresh data"
              >
                <LuRefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            )}

            {/* OCR */}
            {ocrContext && (
              <button
                onClick={() => setIsOcrModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${t.ocrBtn}`}
              >
                <LuScanText size={14} />
                <span className="hidden sm:inline">OCR Import</span>
              </button>
            )}

            {/* Quick action */}
            {quickAction && (
              <button
                onClick={triggerQuickAction}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${t.qaBtn}`}
              >
                <LuPlus size={14} />
                <span className="hidden sm:inline">{quickAction.label}</span>
              </button>
            )}

            {/* Profile */}
            <ProfileMenu
              onLogout={logout}
              onViewProfile={() => navigate("/employee/dashboard?tab=profile")}
              onEmployeeDashboard={handleEmployeeDashboard}
              showSettings={false}
              showToolbox={true}
              size="md"
            />
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className={`flex-1 overflow-y-auto ${t.scrollbar}`}>
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center h-64 gap-3">
              <div className={`animate-spin rounded-full h-8 w-8 border-2 border-t-transparent ${t.spinner}`} />
              <p className={`text-sm ${t.text2}`}>Loading financial data…</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className={`m-6 rounded-xl border p-4 ${t.errBg}`}>
              <p className={`text-sm font-medium ${t.errText}`}>Error: {error}</p>
              <button onClick={fetchFinanceData} className={`mt-2 text-xs underline underline-offset-2 ${t.errText}`}>
                Try again
              </button>
            </div>
          )}

          {/* Sections — always mounted so child components can manage their own data fetching */}
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64 gap-3">
                  <div className={`animate-spin rounded-full h-8 w-8 border-2 border-t-transparent ${t.spinner}`} />
                  <p className={`text-sm ${t.text2}`}>Loading section…</p>
                </div>
              }
            >

              {activeSection === "dashboard" && (
                <DashboardSection
                  financeData={financeData}
                  formatCurrency={formatCurrency}
                  onRefresh={fetchFinanceData}
                  lastUpdatedAt={dashboardLastUpdatedAt}
                />
              )}

              {activeSection.startsWith("sales-invoice") && (
                <SalesInvoiceSection
                  financeData={financeData}
                  formatCurrency={formatCurrency}
                  onDataChange={fetchFinanceData}
                  user={user}
                  initialTab={
                    activeSection === "sales-invoice-customers" ? "customers" :
                    activeSection === "sales-invoice-summary"   ? "summary"   : "records"
                  }
                />
              )}

              {activeSection === "expenses" && (
                <ExpensesSection
                  financeData={financeData}
                  formatCurrency={formatCurrency}
                  onNavigateToVoucher={(voucherNumber) => {
                    const voucherType = getVoucherTypeFromNumber(voucherNumber);
                    try {
                      localStorage.setItem("fpd.voucher.nav-context", JSON.stringify({
                        voucherNumber, voucherType, source: "expenses", createdAt: Date.now(),
                      }));
                    } catch {}
                    setActiveSection("vouchers");
                    setVoucherHighlight(voucherNumber);
                    setTimeout(() => setVoucherHighlight(null), 1000);
                  }}
                />
              )}

              {activeSection.startsWith("vouchers") && (
                <VouchersSection
                  formatCurrency={formatCurrency}
                  initialTab={resolveVouchersInitialTab(activeSection)}
                  highlightVoucherNumber={voucherHighlight}
                  onTabChange={setActiveVoucherTab}
                />
              )}

              {activeSection === "vales" && (
                <ValesSection financeData={financeData} formatCurrency={formatCurrency} />
              )}

              {activeSection === "payroll" && (
                <PayrollSection financeData={financeData} formatCurrency={formatCurrency} />
              )}

              {activeSection === "payroll-checking" && (
                <PayrollCheckingSection formatCurrency={formatCurrency} />
              )}

              {(activeSection === "monthly-bills" || activeSection === "monthly-bills-records") && (
                <MonthlyBillsSection formatCurrency={formatCurrency} financeData={financeData} onDataChange={fetchFinanceData} initialTab="bills" />
              )}

              {activeSection === "monthly-bills-providers" && (
                <MonthlyBillsSection formatCurrency={formatCurrency} financeData={financeData} onDataChange={fetchFinanceData} initialTab="providers" />
              )}

            </Suspense>

            </div>
        </div>
      </main>

      {/* ── OCR Modal ─────────────────────────────────────────────────────────── */}
      {isOcrModalOpen && ocrContext && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${t.overlay}`}>
          <div className={`relative flex flex-col h-[92vh] w-full max-w-7xl rounded-2xl border overflow-hidden ${t.modal}`}>
            {/* Modal header */}
            <div className={`shrink-0 flex items-center justify-between px-5 py-3.5 border-b ${t.modalHdr}`}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? "bg-emerald-950 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                  <LuScanText size={14} />
                </div>
                <div>
                  <p className={`text-sm font-semibold leading-none ${t.text1}`}>OCR Import</p>
                  <p className={`text-xs mt-0.5 ${t.muted}`}>{ocrContext.label}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOcrModalOpen(false)}
                className={`p-2 rounded-lg transition-colors ${t.modalClose}`}
              >
                <LuX size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full gap-3">
                    <div className={`animate-spin rounded-full h-8 w-8 border-2 border-t-transparent ${t.spinner}`} />
                    <p className={`text-sm ${t.text2}`}>Loading OCR workspace…</p>
                  </div>
                }
              >
                <FinanceDocumentIngestionPage
                  embedded
                  contextTitle={`Finance Document OCR · ${ocrContext.label}`}
                  documentTypeHint={ocrContext.type}
                  sourceSectionHint={ocrSourceSectionHint}
                  onDraftPrepared={(payload) => {
                    window.dispatchEvent(new CustomEvent("finance:ocr-draft-ready", { detail: payload }));
                    setIsOcrModalOpen(false);
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinancePayrollDepartment;