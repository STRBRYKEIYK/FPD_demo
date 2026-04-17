import React, { useMemo } from "react";
import {
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import { 
  LuTrendingUp, 
  LuFileText, 
  LuCalculator, 
  LuCircleDollarSign 
} from "react-icons/lu";
import ChartWrapper from "../../shared/ChartWrapper";
import { useAuth } from "../../../contexts/AuthContext";

const COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#6b7280", // Gray
];

// --- Aesthetic UI Components ---

const AestheticStatWidget = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-stone-800/80 p-5 shadow-sm border ${colorClass} transition-all hover:shadow-md`}>
    <div className="absolute -right-4 -top-4 opacity-10 dark:opacity-5 text-current">
      {Icon && <Icon size={80} />}
    </div>
    <div className="relative z-10 flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <span className="text-2xl sm:text-3xl font-semibold text-gray-800 dark:text-gray-100">{value}</span>
      {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</span>}
    </div>
  </div>
);

const AestheticCard = ({ title, children, noPadding = false }) => (
  <div className="bg-white dark:bg-stone-800/80 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden flex flex-col h-full">
    <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 bg-stone-50/50 dark:bg-stone-900/50">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
    <div className={`flex-1 ${noPadding ? '' : 'p-5'}`}>
      {children}
    </div>
  </div>
);

export default function SalesInvoiceSummary({ financeData, formatCurrency }) {
  const { isDarkMode } = useAuth();

  // 1. DATA AGGREGATION HELPERS
  const { topCustomers, topProducts } = useMemo(() => {
    const invoices = financeData?.salesInvoices?.all || [];

    // --- Process Top Customers ---
    const customerMap = {};
    invoices.forEach((inv) => {
      const name = inv.customer_name || "Unknown";
      customerMap[name] = (customerMap[name] || 0) + (inv.total_amount || 0);
    });

    const sortedCustomers = Object.entries(customerMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // --- Process Top Products/Services ---
    const productMap = {};
    invoices.forEach((inv) => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item) => {
          const desc = item.description || "General Item";
          const cleanDesc = desc.length > 20 ? desc.substring(0, 20) + "..." : desc;
          productMap[cleanDesc] = (productMap[cleanDesc] || 0) + (item.amount || 0);
        });
      }
    });

    const sortedProducts = Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { topCustomers: sortedCustomers, topProducts: sortedProducts };
  }, [financeData]);

  // Calculate yearly totals from actual data
  const yearlyTotals = {
    accountReceivablesDR: financeData.salesInvoices.totalAmount || 0,
    vatOutputTaxCR: financeData.salesInvoices.totalVat || 0,
    zeroRatedSalesCR: financeData.salesInvoices.totalZeroRated || 0,
    vatableSalesCR: financeData.salesInvoices.vatable_sales || 0,
  };

  const monthlyChartData = financeData.salesInvoices.chart || [];

  // Recharts tooltip styling for light/dark mode
  const tooltipStyle = {
    backgroundColor: isDarkMode ? "rgba(31, 41, 55, 0.95)" : "rgba(255, 255, 255, 0.95)",
    border: `1px solid ${isDarkMode ? "#374151" : "#e5e7eb"}`,
    borderRadius: "12px",
    color: isDarkMode ? "#f3f4f6" : "#111827",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      
      {/* 1. Summary Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AestheticStatWidget
          title="Account Receivables (DR)"
          value={formatCurrency(yearlyTotals.accountReceivablesDR)}
          subtitle="Year 2026 Total"
          icon={LuTrendingUp}
          colorClass="border-blue-200 dark:border-blue-900/50 text-blue-500"
        />
        <AestheticStatWidget
          title="Total Invoices"
          value={financeData.salesInvoices.total.toString()}
          subtitle="Year 2026 Count"
          icon={LuFileText}
          colorClass="border-emerald-200 dark:border-emerald-900/50 text-emerald-500"
        />
        <AestheticStatWidget
          title="VAT Output Tax (CR)"
          value={formatCurrency(yearlyTotals.vatOutputTaxCR)}
          subtitle="Year 2026 Total"
          icon={LuCalculator}
          colorClass="border-purple-200 dark:border-purple-900/50 text-purple-500"
        />
        <AestheticStatWidget
          title="Zero Rated Sales (CR)"
          value={formatCurrency(yearlyTotals.zeroRatedSalesCR)}
          subtitle="Year 2026 Total"
          icon={LuCircleDollarSign}
          colorClass="border-orange-200 dark:border-orange-900/50 text-orange-500"
        />
      </div>

      {/* 2. Main Trend & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Trend */}
        <AestheticCard title="Monthly Invoice Trend">
          <ChartWrapper height={300} className="w-full">
            <BarChart
              data={monthlyChartData.length > 0 ? monthlyChartData : [{ month: "No data", amount: 0 }]}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#374151" : "#e5e7eb"} />
              <XAxis dataKey="month" className="text-xs font-medium" tick={{ fill: isDarkMode ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} dy={10} />
              <YAxis className="text-xs font-medium" tickFormatter={(val) => `${val / 1000}k`} tick={{ fill: isDarkMode ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} cursor={{ fill: isDarkMode ? "#374151" : "#f3f4f6" }} />
              <Bar dataKey="amount" fill="#10b981" name="Total Invoiced" radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ChartWrapper>
        </AestheticCard>

        {/* Total Overview (Text Based) */}
        <AestheticCard title="Invoice Overview">
          <div className="flex flex-col justify-center h-full space-y-8">
            <div className="text-center">
              <p className="text-7xl font-bold text-emerald-500 dark:text-emerald-400 tracking-tight">
                {financeData.salesInvoices.total}
              </p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3 uppercase tracking-wider">
                Total Invoices Issued (2026)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-700/50">
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/30">
                <p className="text-xs font-medium text-purple-600/70 dark:text-purple-400/70 mb-1 uppercase tracking-wider">Total VAT Generated</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(financeData.salesInvoices.totalVat || 0)}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800/30">
                <p className="text-xs font-medium text-orange-600/70 dark:text-orange-400/70 mb-1 uppercase tracking-wider">Zero-Rated Sales</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(financeData.salesInvoices.totalZeroRated || 0)}</p>
              </div>
            </div>
          </div>
        </AestheticCard>
      </div>

      {/* 3. Monthly Summary Custom Table */}
      <AestheticCard title="2026 Monthly Performance Summary" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-stone-50/80 dark:bg-stone-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700/50">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Month</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Account Receivables (DR)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Vatable Sales (CR)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">VAT Output Tax (CR)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Zero Rated Sales (CR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {monthlyChartData.map((m, idx) => (
                <tr key={idx} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{m.month}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(m.amount)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(m.vatable_sales || m.amount / 1.12)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(m.vat_amount || m.amount - m.amount / 1.12)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(m.zero_rated || 0)}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-t-2 border-gray-200 dark:border-gray-700">
                <td className="px-6 py-4">
                  <span className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-xs">TOTAL</span>
                </td>
                <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(yearlyTotals.accountReceivablesDR)}
                </td>
                <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(yearlyTotals.vatableSalesCR)}
                </td>
                <td className="px-6 py-4 font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(yearlyTotals.vatOutputTaxCR)}
                </td>
                <td className="px-6 py-4 font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(yearlyTotals.zeroRatedSalesCR)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AestheticCard>

    </div>
  );
}