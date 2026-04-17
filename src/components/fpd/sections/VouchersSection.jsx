import React, { useState, useEffect } from "react";
import { Banknote, CreditCard, Coins, FileText } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import apiService from "../../../utils/api/api-service";
import CashVouchersTab from "./vouchers/CashVouchersTab";
import CheckVouchersTab from "./vouchers/CheckVouchersTab";
import PettyCashTab from "./vouchers/PettyCashTab";

const VOUCHER_TAB_IDS = ["cash", "check", "petty_cash"];

const normalizeVoucherTab = (value) => {
  if (!value) return "cash";
  const normalized = String(value).toLowerCase();
  if (normalized === "records") return "cash";
  if (normalized === "payees") return "check";
  if (normalized === "summary") return "petty_cash";
  return VOUCHER_TAB_IDS.includes(normalized) ? normalized : "cash";
};

const getTabFromVoucherNumber = (voucherNumber) => {
  if (typeof voucherNumber !== "string") return "cash";
  if (voucherNumber.startsWith("PCV-")) return "petty_cash";
  if (voucherNumber.startsWith("CHK-")) return "check";
  return "cash";
};

/**
 * VouchersSection - Main container for voucher management
 * Uses tab-based navigation between Cash, Check, and Petty Cash vouchers
 */
export default function VouchersSection({
  initialTab = "cash",
  highlightVoucherNumber = null,
  onTabChange,
}) {
  const { isDarkMode, user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState(() => normalizeVoucherTab(initialTab));
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [resolvedHighlightVoucher, setResolvedHighlightVoucher] = useState(highlightVoucherNumber);

  const { showWarning } = useToast();

  // Tab definitions matching the 3 voucher types
  const tabs = [
    {
      id: "cash",
      label: "Cash Vouchers",
      icon: Banknote,
      description: "Manage cash transactions",
    },
    {
      id: "check",
      label: "Check Vouchers",
      icon: CreditCard,
      description: "Manage check payments",
    },
    {
      id: "petty_cash",
      label: "Petty Cash",
      icon: Coins,
      description: "Track petty cash fund",
    },
  ];

  // Load chart of accounts on mount (needed for petty cash classification)
  useEffect(() => {
    loadChartOfAccounts();
  }, []);

  useEffect(() => {
    setActiveTab(normalizeVoucherTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (typeof onTabChange === 'function') {
      onTabChange(activeTab);
    }
  }, [activeTab, onTabChange]);

  useEffect(() => {
    setResolvedHighlightVoucher(highlightVoucherNumber || null);
  }, [highlightVoucherNumber]);

  useEffect(() => {
    if (highlightVoucherNumber) return;

    try {
      const raw = localStorage.getItem("fpd.voucher.nav-context");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const createdAt = Number(parsed?.createdAt || 0);
      const isFresh = createdAt > 0 && Date.now() - createdAt <= 15 * 60 * 1000;

      if (!isFresh || !parsed?.voucherNumber) {
        localStorage.removeItem("fpd.voucher.nav-context");
        return;
      }

      setResolvedHighlightVoucher(parsed.voucherNumber);
      setActiveTab(normalizeVoucherTab(parsed.voucherType || getTabFromVoucherNumber(parsed.voucherNumber)));
      localStorage.removeItem("fpd.voucher.nav-context");
    } catch (err) {
      console.error('Failed reading voucher nav-context:', err);
      try { localStorage.removeItem("fpd.voucher.nav-context"); } catch (e) { console.error('Failed removing voucher nav-context', e); }
      showWarning?.("Failed to restore voucher navigation context");
    }
  }, [highlightVoucherNumber]);

  // If parent requests highlighting a voucher, switch to the matching tab
  useEffect(() => {
    if (resolvedHighlightVoucher) {
      setActiveTab(getTabFromVoucherNumber(resolvedHighlightVoucher));
    }
  }, [resolvedHighlightVoucher]);

  const loadChartOfAccounts = async () => {
    try {
      const resp = await apiService.finance.request(
        `/api/finance-payroll/chart-of-accounts`,
      );
      setChartOfAccounts(resp.accounts || resp.data || resp || []);
    } catch (error) {
      console.error("Error loading chart of accounts:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* ============================================================================ */}
      {/* HEADER */}
      {/* ============================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={`text-3xl font-bold tracking-tight ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Finance Vouchers
          </h1>
          <p
            className={`mt-1 text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Manage cash, check, and petty cash transactions
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            isDarkMode ? "bg-stone-800" : "bg-stone-100"
          }`}
        >
          <FileText
            size={20}
            className={isDarkMode ? "text-gray-400" : "text-gray-600"}
          />
          <span
            className={`font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
          >
            {tabs.find((t) => t.id === activeTab)?.label || "Vouchers"}
          </span>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* TAB NAVIGATION */}
      {/* ============================================================================ */}
      <div
        className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}
      >
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-6 py-4 flex items-center gap-3 font-medium transition-all
                  ${
                    isActive
                      ? isDarkMode
                        ? "text-neutral-400"
                        : "text-neutral-600"
                      : isDarkMode
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                <Icon size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span
                    className={`text-xs ${
                      isActive
                        ? isDarkMode
                          ? "text-neutral-300"
                          : "text-neutral-500"
                        : isDarkMode
                          ? "text-gray-500"
                          : "text-gray-400"
                    }`}
                  >
                    {tab.description}
                  </span>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                      isDarkMode ? "bg-neutral-800" : "bg-neutral-900"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================================ */}
      {/* TAB CONTENT */}
      {/* ============================================================================ */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {activeTab === "cash" && (
          <CashVouchersTab chartOfAccounts={chartOfAccounts} />
        )}

        {activeTab === "check" && (
          <CheckVouchersTab chartOfAccounts={chartOfAccounts} highlightVoucherNumber={resolvedHighlightVoucher} />
        )}

        {activeTab === "petty_cash" && (
          <PettyCashTab chartOfAccounts={chartOfAccounts} highlightVoucherNumber={resolvedHighlightVoucher} />
        )}
      </div>
    </div>
  );
}
