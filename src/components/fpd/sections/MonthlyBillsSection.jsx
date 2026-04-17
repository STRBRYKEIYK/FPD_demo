import { useState, useEffect, useMemo } from "react";
import {
  Plus as LuPlus,
  Check as LuCheck,
  History as LuHistory,
  Eye as LuEye,
  Pencil as LuPencil,
  Trash2 as LuTrash2,
  Users,
  X as LuX,
  Info,
  DollarSign as LuDollarSign,
  FileText as LuFileText,
  MapPin,
  Calendar,
  ChevronDown as LuChevronDown,
  ChevronRight as LuChevronRight,
  Search,
  Download as LuDownload,
  TrendingUp,
  TrendingDown,
  Upload as LuUpload,
  CheckSquare as LuCheckCheck,
  Building2 as LuBuilding2,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

import MonthlyBillsBulkCreator from "../components/forms/MonthlyBillsBulkCreator";

import {
  formatPeriod,
  getStatusColorClasses,
  getStatusLabel,
} from "../components/forms/monthly-bills-config";

import ProvidersBulkCreator from "../components/forms/ProvidersBulkCreator";

import {
  getCategoryLabel,
  getCategoryIcon,
} from "../components/forms/providers-config";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import Toast from "../components/main_ui/Toast";
import { useToast } from "../hooks/useToast";
import { MonthlyBillsService } from "../../../utils/api/services/monthly-bills-service";
import { generateMonthlyBillsReport } from "../../../utils/MonthlyBillsExport";
import MonthlyBillsImportModal from "../components/modals/MonthlyBillsImportModal";

const AestheticStatWidget = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-stone-800/80 p-5 shadow-sm border ${colorClass} transition-all hover:shadow-md`}>
    <div className="absolute -right-4 -top-4 opacity-10 dark:opacity-5 text-current">
      {Icon && <Icon size={80} />}
    </div>
    <div className="relative z-10 flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
      <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{value}</span>
      {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{subtitle}</span>}
    </div>
  </div>
);

function parseProofDocuments(value) {
  if (value == null || value === '') return [];

  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return { label: `Document ${index + 1}`, reference: text };
      }

      if (!entry || typeof entry !== 'object') return null;

      const label = String(entry.label || entry.name || `Document ${index + 1}`).trim();
      const reference = String(entry.reference || entry.url || entry.path || '').trim();
      if (!label && !reference) return null;

      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

const monthlyBillsService = new MonthlyBillsService();

export default function MonthlyBillsSection({
  formatCurrency,
  financeData,
  onDataChange,
  initialTab = "bills",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [bills, setBills] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formOpen, setFormOpen] = useState(false);
  const [ocrDraftBill, setOcrDraftBill] = useState(null);
  const [ocrDraftBills, setOcrDraftBills] = useState([]);
  const [providerFormOpen, setProviderFormOpen] = useState(false);
  
  const { user, isDarkMode } = useAuth();
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [billToDelete, setBillToDelete] = useState(null);
  const [providerToDelete, setProviderToDelete] = useState(null);
  const [billItemToDelete, setBillItemToDelete] = useState(null);
  const [billItemIdsToDelete, setBillItemIdsToDelete] = useState([]);
  const [billIdsToDelete, setBillIdsToDelete] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedBillItemIds, setSelectedBillItemIds] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [deletingItems, setDeletingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isMultiSelectBills, setIsMultiSelectBills] = useState(false);
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (viewModalOpen && selectedBill?.items?.length) {
      const grouped = groupItemsByCategory(selectedBill.items);
      const collapsed = {};
      Object.keys(grouped).forEach((cat) => {
        collapsed[cat] = true;
      });
      setCollapsedCategories(collapsed);
    }
  }, [viewModalOpen, selectedBill]);
  
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();

  useEffect(() => {
    if (activeTab === "bills") {
      loadBills();
    } else {
      loadProviders();
    }
  }, [yearFilter, statusFilter, categoryFilter, activeTab]);

  useEffect(() => {
    const handleOcrDraftReady = (event) => {
      const payload = event?.detail;
      if (!payload || payload.target !== 'monthly_bill') return;

      const drafts = Array.isArray(payload.drafts)
        ? payload.drafts.filter(Boolean)
        : payload.draft
          ? [payload.draft]
          : [];

      setActiveTab('bills');
      setSelectedBill(null);
      setOcrDraftBill(drafts[0] || null);
      setOcrDraftBills(drafts);
      setFormOpen(true);
      showSuccess(`OCR draft mapped to Monthly Bills form (${drafts.length} item${drafts.length === 1 ? '' : 's'}).`);
    };

    window.addEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
    return () => window.removeEventListener('finance:ocr-draft-ready', handleOcrDraftReady);
  }, [showSuccess]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (yearFilter && yearFilter !== "all") filters.year = yearFilter;
      if (statusFilter) filters.status = statusFilter;

      const data = await monthlyBillsService.getMonthlyBills(filters);
      setBills(data);

      if (onDataChange) onDataChange();
    } catch (error) {
      showError(error.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBill = () => {
    setSelectedBill(null);
    setOcrDraftBill(null);
    setOcrDraftBills([]);
    setFormOpen(true);
  };

  const handleEditBill = async (bill) => {
    setLoading(true);
    try {
      const fullBill = await monthlyBillsService.getBill(bill.id);
      setSelectedBill(fullBill);
      setFormOpen(true);
    } catch (err) {
      showError("Failed to load bill details.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = async (bill) => {
    try {
      const fullBill = await monthlyBillsService.getBillBreakdown(bill.id);
      if (!fullBill.items) fullBill.items = [];
      setSelectedBill(fullBill);
      setViewModalOpen(true);
    } catch (error) {
      showError(error.message || "Failed to load bill details");
    }
  };

  const handleDeleteBill = (bill) => {
    setBillToDelete(bill);
    setConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    try {
      await monthlyBillsService.deleteBill(billToDelete.id);
      showSuccess("Bill deleted successfully");
      loadBills();
    } catch (error) {
      showError(error.message || "Failed to delete bill");
    } finally {
      setConfirmDialogOpen(false);
      setBillToDelete(null);
    }
  };

  const handleMarkAsPaid = async (bill) => {
    try {
      await monthlyBillsService.markAsPaid(bill.id, {
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
      });
      showSuccess("Bill marked as paid");
      loadBills();
    } catch (error) {
      showError(error.message || "Failed to update bill");
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (categoryFilter) filters.category = categoryFilter;
      const providers = await monthlyBillsService.getProviders(filters);
      setProviders(providers);
    } catch (error) {
      showError(error.message || "Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = () => {
    setSelectedProvider(null);
    setProviderFormOpen(true);
  };

  const handleEditProvider = (provider) => {
    setSelectedProvider(provider);
    setProviderFormOpen(true);
  };

  const handleDeleteProvider = (provider) => {
    setProviderToDelete(provider);
    setConfirmDialogOpen(true);
  };

  const confirmDeleteProvider = async () => {
    try {
      await monthlyBillsService.deleteProvider(providerToDelete.id);
      showSuccess("Provider deleted successfully");
      loadProviders();
    } catch (error) {
      showError(error.message || "Failed to delete provider");
    } finally {
      setConfirmDialogOpen(false);
      setProviderToDelete(null);
    }
  };

  const handleProviderFormSubmit = async (formData) => {
    try {
      if (selectedProvider) {
        await monthlyBillsService.updateProvider(selectedProvider.id, formData);
        showSuccess("Provider updated successfully");
      } else {
        await monthlyBillsService.createProvider(formData);
        showSuccess("Provider created successfully");
      }
      setProviderFormOpen(false);
      loadProviders();
    } catch (error) {
      showError(error.message || "Failed to save provider");
      throw error;
    }
  };

  const handleDeleteBillItem = (item) => {
    setBillItemToDelete(item);
    setConfirmDialogOpen(true);
  };

  const confirmDeleteBillItem = async () => {
    if (!billItemToDelete || !selectedBill?.id) return;
    try {
      setLoading(true);
      await monthlyBillsService.deleteBillItem(selectedBill.id, billItemToDelete.id);
      showSuccess('Bill item deleted successfully');
      const updatedBill = await monthlyBillsService.getBillBreakdown(selectedBill.id);
      setSelectedBill(updatedBill);
      loadBills();
    } catch (error) {
      showError(error.message || 'Failed to delete bill item');
    } finally {
      setLoading(false);
      setBillItemToDelete(null);
    }
  };

  const handleBulkDeleteBillItems = () => {
    if (selectedBillItemIds.length === 0) return;
    setBillItemIdsToDelete([...selectedBillItemIds]);
    setConfirmDialogOpen(true);
  };

  const confirmBulkDeleteBillItems = async () => {
    if (billItemIdsToDelete.length === 0 || !selectedBill?.id) return;
    try {
      setDeletingItems(true);
      const targetItemIds = [...billItemIdsToDelete];
      const results = await Promise.allSettled(
        targetItemIds.map((itemId) => monthlyBillsService.deleteBillItem(selectedBill.id, itemId))
      );

      const failedItemIds = targetItemIds.filter((_, index) => results[index]?.status === 'rejected');
      const deletedCount = targetItemIds.length - failedItemIds.length;

      if (deletedCount > 0) {
        showSuccess(`Deleted ${deletedCount} item(s) successfully`);
        const updatedBill = await monthlyBillsService.getBillBreakdown(selectedBill.id);
        setSelectedBill(updatedBill);
        loadBills();
      }

      setSelectedBillItemIds(failedItemIds);

      if (failedItemIds.length > 0) {
        if (deletedCount > 0) {
          showWarning(`Failed to delete ${failedItemIds.length} item(s); they remain selected`);
        } else {
          showError('Failed to delete bill items');
        }
      } else {
        setMultiSelectMode(false);
      }
    } catch (error) {
      showError(error.message || 'Failed to delete bill items');
    } finally {
      setDeletingItems(false);
      setBillItemIdsToDelete([]);
    }
  };

  const handleExportReport = async () => {
    try {
      setLoading(true);
      if (viewModalOpen && selectedBill) {
        await generateMonthlyBillsReport(bills, selectedBill);
        showSuccess("Report downloaded successfully");
      } else {
        await generateMonthlyBillsReport(bills, null);
        showSuccess("Summary report downloaded successfully");
      }
    } catch (error) {
      showError("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const toggleMultiSelectBills = () => {
    setIsMultiSelectBills((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedBillIds([]);
        setLastSelectedIndex(null);
        setBulkStatus('');
      }
      return next;
    });
  };

  const handleSelectAllBills = (checked) => {
    if (!checked) {
      setSelectedBillIds([]);
      return;
    }
    setSelectedBillIds(filteredBills.map((bill) => bill.id));
  };

  const handleSelectBillRow = (billId, index, event) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = !next.has(billId);

      if (event?.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i += 1) {
          const rangeId = filteredBills[i]?.id;
          if (!rangeId) continue;
          if (shouldSelect) next.add(rangeId);
          else next.delete(rangeId);
        }
      } else if (shouldSelect) {
        next.add(billId);
      } else {
        next.delete(billId);
      }
      return Array.from(next);
    });
    setLastSelectedIndex(index);
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedBillIds.length === 0) return;
    try {
      const targetBillIds = [...selectedBillIds];
      const results = await Promise.allSettled(
        targetBillIds.map((billId) => monthlyBillsService.updateBill(billId, { status: bulkStatus }))
      );

      const failedBillIds = targetBillIds.filter((_, index) => results[index]?.status === 'rejected');
      const updatedCount = targetBillIds.length - failedBillIds.length;

      if (updatedCount > 0) {
        await loadBills();
        showSuccess(`Updated ${updatedCount} bill${updatedCount !== 1 ? 's' : ''} successfully`);
      }

      setSelectedBillIds(failedBillIds);
      setLastSelectedIndex(null);

      if (failedBillIds.length > 0) {
        if (updatedCount > 0) {
          showWarning(`Failed to update ${failedBillIds.length} bill${failedBillIds.length !== 1 ? 's' : ''}; they remain selected`);
        } else {
          showError('Failed to bulk update bills');
        }
      } else {
        setBulkStatus('');
      }
    } catch (error) {
      showError('Failed to bulk update bills');
    }
  };

  const handleBulkDeleteBills = () => {
    if (selectedBillIds.length === 0) return;
    setBillIdsToDelete([...selectedBillIds]);
    setConfirmDialogOpen(true);
  };

  const confirmBulkDeleteBills = async () => {
    if (billIdsToDelete.length === 0) return;
    try {
      const targetBillIds = [...billIdsToDelete];
      const results = await Promise.allSettled(
        targetBillIds.map((billId) => monthlyBillsService.deleteBill(billId))
      );

      const failedBillIds = targetBillIds.filter((_, index) => results[index]?.status === 'rejected');
      const deletedCount = targetBillIds.length - failedBillIds.length;

      if (deletedCount > 0) {
        await loadBills();
        showSuccess(`Deleted ${deletedCount} bill${deletedCount !== 1 ? 's' : ''} successfully`);
      }

      setSelectedBillIds(failedBillIds);
      setLastSelectedIndex(null);

      if (failedBillIds.length > 0) {
        if (deletedCount > 0) {
          showWarning(`Failed to delete ${failedBillIds.length} bill${failedBillIds.length !== 1 ? 's' : ''}; they remain selected`);
        } else {
          showError('Failed to bulk delete bills');
        }
      }
    } catch (error) {
      showError('Failed to bulk delete bills');
    } finally {
      setBillIdsToDelete([]);
    }
  };

  useEffect(() => {
    setSelectedBillIds([]);
    setLastSelectedIndex(null);
  }, [yearFilter, statusFilter, searchTerm]);

  const handleImportBills = async (importedBills) => {
    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      for (const billData of importedBills) {
        try {
          await monthlyBillsService.createMonthlyBill(billData);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }
      await loadBills();
      if (errorCount === 0) showSuccess(`Successfully imported ${successCount} bill(s)`);
      else showWarning(`Imported ${successCount} bill(s), ${errorCount} failed`);
    } catch (error) {
      showError('Failed to import bills: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = financeData?.monthlyBills || {
    total: 0, paid: 0, pending: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0,
  };

  const availableYears = useMemo(() => {
    const years = new Set();

    bills.forEach((bill) => {
      const explicitYear = Number(bill?.year);
      if (Number.isInteger(explicitYear) && explicitYear > 1900) {
        years.add(explicitYear);
        return;
      }

      const dateCandidates = [bill?.payment_date, bill?.created_at, bill?.updated_at];
      dateCandidates.forEach((dateValue) => {
        if (!dateValue) return;
        const parsedDate = new Date(dateValue);
        if (!Number.isNaN(parsedDate.getTime())) {
          years.add(parsedDate.getFullYear());
        }
      });
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [bills]);

  const filteredBills = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return bills;
    return bills.filter((bill) => {
      const paymentDateText = bill.payment_date
        ? new Date(bill.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const fields = [
        formatPeriod(bill.month, bill.year),
        bill.prepared_by_name,
        bill.status,
        String(bill.net_total || ''),
        String(bill.year || ''),
        String(bill.payment_date || ''),
        paymentDateText,
      ];
      return fields.some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [bills, searchTerm]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrencyLocal = (amount) => {
    if (!formatCurrency) {
      return `₱${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return formatCurrency(amount);
  };

  const normalizeCategory = (cat) => {
    if (!cat) return "other";
    const lowerCat = cat.trim().toLowerCase();
    if (/^(other|others)$/i.test(lowerCat)) return "other";
    if (lowerCat === "communications/internet" || lowerCat.includes("communications")) return "communications";
    return lowerCat;
  };

  const groupItemsByCategory = (items) => {
    if (!items || items.length === 0) return {};
    return items.reduce((acc, item) => {
      const category = normalizeCategory(item.category);
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});
  };

  const toggleCategory = (category) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const getCategoryInfo = (category) => {
    const categoryMap = {
      electricity: { label: "Electricity", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
      water: { label: "Water", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
      communications: { label: "Communications/Internet", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
      rental: { label: "Rental", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
      payment_fees: { label: "Payment Fees", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
      other: { label: "Other", color: "gray", icon: <LuDollarSign className="text-gray-900 dark:text-gray-100" size={18} /> },
    };
    return categoryMap[category] || categoryMap.other;
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Modern Pill Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-800/60 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "bills"
              ? "bg-white dark:bg-stone-700 text-black dark:text-white shadow-sm"
              : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-600"
          }`}
        >
          <LuHistory size={16} />
          Monthly Bills
        </button>
        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "providers"
              ? "bg-white dark:bg-stone-700 text-black dark:text-white shadow-sm"
              : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-600"
          }`}
        >
          <Users size={16} />
          Service Providers
        </button>
      </div>

      {/* Bills Tab */}
      {activeTab === "bills" && (
        <>
          {/* Aesthetic Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AestheticStatWidget 
              title="Total Bills" 
              value={stats.total} 
              subtitle="All time entries" 
              icon={LuFileText} 
              colorClass="border-gray-300 dark:border-gray-600 text-black dark:text-white" 
            />
            <AestheticStatWidget 
              title="Paid Amount" 
              value={formatCurrencyLocal(stats.paidAmount)} 
              subtitle={`${stats.paid} of ${stats.total} bills (${stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%)`} 
              icon={TrendingUp} 
              colorClass="border-gray-300 dark:border-gray-600 text-black dark:text-white" 
            />
            <AestheticStatWidget 
              title="Pending Amount" 
              value={formatCurrencyLocal(stats.pendingAmount)} 
              subtitle={`${stats.pending} pending bills`} 
              icon={TrendingDown} 
              colorClass="border-gray-300 dark:border-gray-600 text-black dark:text-white" 
            />
            <AestheticStatWidget 
              title="Total Amount" 
              value={formatCurrencyLocal(stats.totalAmount)} 
              subtitle="Paid + Pending" 
              icon={LuDollarSign} 
              colorClass="border-gray-300 dark:border-gray-600 text-black dark:text-white" 
            />
          </div>

          {/* Search & Toolbar */}
          <div className="bg-white dark:bg-stone-800/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search bills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all text-sm"
                  />
                </div>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all text-sm font-medium"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all text-sm font-medium"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddBill}
                  className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white dark:bg-white dark:hover:bg-stone-200 dark:text-black rounded-xl flex items-center gap-2 font-medium shadow-black/20 dark:shadow-white/20 shadow-lg transition-all"
                >
                  <LuPlus size={18} />
                  Create Bill
                </button>

                <div className="relative group">
                  <button className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-stone-800 text-gray-700 dark:text-gray-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2 font-medium transition-all shadow-sm">
                    <LuChevronDown size={16} />
                    Actions
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                    <button onClick={() => setShowImportModal(true)} className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-700/50 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 transition-colors">
                      <LuUpload size={16} className="text-black dark:text-white" /> Import Excel
                    </button>
                    <button onClick={handleExportReport} disabled={filteredBills.length === 0} className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-700/50 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t border-gray-100 dark:border-gray-700/50">
                      <LuDownload size={16} className="text-black dark:text-white" /> Export Excel
                    </button>
                    <button onClick={toggleMultiSelectBills} className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-700/50 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700/50 transition-colors">
                      <LuCheckCheck size={16} className="text-black dark:text-white" /> {isMultiSelectBills ? 'Cancel Selection' : 'Select Multiple'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BULK OPERATIONS */}
          {isMultiSelectBills && selectedBillIds.length > 0 && (
            <div className="bg-stone-100 dark:bg-stone-800 border border-gray-300 dark:border-gray-600 rounded-2xl p-4 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-black dark:text-white">
                  {selectedBillIds.length} bill{selectedBillIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-3">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-stone-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  >
                    <option value="">Change Status...</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <button onClick={handleBulkStatusUpdate} disabled={!bulkStatus} className="px-4 py-2 bg-black hover:bg-stone-800 disabled:bg-stone-400 text-white dark:bg-white dark:hover:bg-stone-200 dark:text-black rounded-lg text-sm font-medium transition-all">
                    Update
                  </button>
                  <button onClick={handleBulkDeleteBills} className="px-4 py-2 bg-stone-600 hover:bg-stone-700 text-white dark:bg-stone-400 dark:hover:bg-stone-500 dark:text-black rounded-lg text-sm font-medium transition-all">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TABLE */}
          <div className="bg-white dark:bg-stone-800/80 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-black dark:border-white"></div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading bills...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="p-16 text-center">
                <LuHistory size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchTerm || statusFilter || yearFilter !== "all" 
                    ? 'No Bills Match Your Filters' 
                    : 'No Monthly Bills Found'}
                </h3>
                <button onClick={handleAddBill} className="mt-6 px-6 py-2.5 bg-black hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 text-white dark:text-black rounded-xl inline-flex items-center gap-2 font-medium shadow-sm transition-colors">
                  <LuPlus size={18} /> Create First Bill
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-stone-50/80 dark:bg-stone-900/50 border-b border-gray-100 dark:border-gray-700/50">
                    <tr>
                      {isMultiSelectBills && (
                        <th className="px-6 py-4 w-12">
                          <input type="checkbox" checked={filteredBills.length > 0 && selectedBillIds.length === filteredBills.length} onChange={(e) => handleSelectAllBills(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:text-white dark:focus:ring-white" />
                        </th>
                      )}
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prepared By</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Total Amount</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {filteredBills.map((bill, index) => (
                      <tr
                        key={bill.id}
                        className={`group hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors ${
                          isMultiSelectBills && selectedBillIds.includes(bill.id) ? 'bg-stone-200/60 dark:bg-stone-700/60' : ''
                        }`}
                        onClick={(event) => {
                          if (!isMultiSelectBills) return;
                          if (event.target.closest('button, a, input, select, textarea, svg, path')) return;
                          handleSelectBillRow(bill.id, index, event);
                        }}
                      >
                        {isMultiSelectBills && (
                          <td className="px-6 py-4">
                            <input type="checkbox" checked={selectedBillIds.includes(bill.id)} onClick={(event) => handleSelectBillRow(bill.id, index, event)} onChange={() => {}} className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:text-white dark:focus:ring-white" />
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {formatPeriod(bill.month, bill.year)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {bill.prepared_by_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono font-bold text-right text-black dark:text-white">
                          {formatCurrencyLocal(bill.net_total || 0)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {bill.payment_date ? formatDate(bill.payment_date) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold rounded-lg border ${
                            bill.status === 'paid' ? 'bg-stone-100 text-black border-gray-300 dark:bg-stone-800 dark:text-white dark:border-gray-600' : 
                            bill.status === 'pending' ? 'bg-stone-100 text-black border-gray-300 dark:bg-stone-800 dark:text-white dark:border-gray-600' : 
                            'bg-stone-50 text-gray-700 border-gray-200 dark:bg-stone-800 dark:text-gray-400 dark:border-gray-700'
                          }`}>
                            {getStatusLabel(bill.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleViewBill(bill)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all" title="View"><LuEye size={16} /></button>
                            <button onClick={() => handleEditBill(bill)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all" title="Edit"><LuPencil size={16} /></button>
                            {bill.status === "pending" && (
                              <button onClick={() => handleMarkAsPaid(bill)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all" title="Mark Paid"><LuCheck size={16} /></button>
                            )}
                            <button onClick={() => handleDeleteBill(bill)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all" title="Delete"><LuTrash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <MonthlyBillsBulkCreator
            isOpen={formOpen}
            onClose={() => { setFormOpen(false); setOcrDraftBill(null); setOcrDraftBills([]); loadBills(); }}
            user={user}
            isDarkMode={isDarkMode}
            editMode={!!selectedBill}
            initialData={selectedBill}
            initialDraft={ocrDraftBill}
            initialDrafts={ocrDraftBills}
            onSubmit={() => {}} 
          />

          <MonthlyBillsImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImport={handleImportBills}
            isDarkMode={isDarkMode}
          />

          {/* View Details Slide Panel */}
          {viewModalOpen && selectedBill && (
            <div className="fixed inset-0 z-[100] flex justify-end">
              <div className="fixed inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm transition-all duration-300" onClick={() => { setViewModalOpen(false); setMultiSelectMode(false); setSelectedBillItemIds([]); }} />
              <div className={`relative w-full max-w-2xl h-full overflow-y-auto shadow-2xl bg-white dark:bg-stone-900 rounded-l-3xl animate-in slide-in-from-right duration-300 border-l border-gray-100 dark:border-gray-800`} onClick={(e) => e.stopPropagation()}>
                
                {/* Floating Header Actions */}
                <div className="sticky top-0 right-0 z-10 flex justify-end p-4 bg-gradient-to-b from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90 pointer-events-none">
                  <div className="flex gap-2 pointer-events-auto">
                    <button
                      onClick={() => { setMultiSelectMode(!multiSelectMode); if (multiSelectMode) setSelectedBillItemIds([]); }}
                      className={`px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all shadow-sm text-sm ${
                        multiSelectMode ? 'bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200' : 'bg-white dark:bg-stone-800 text-gray-700 dark:text-gray-300 hover:bg-stone-50 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {multiSelectMode ? <><LuX size={16} /> Cancel</> : <><LuCheckCheck size={16} /> Select</>}
                    </button>
                    {multiSelectMode && selectedBillItemIds.length > 0 && (
                      <button onClick={handleBulkDeleteBillItems} disabled={deletingItems} className="px-4 py-2 bg-stone-800 hover:bg-black disabled:bg-stone-400 text-white dark:bg-stone-200 dark:hover:bg-white dark:disabled:bg-stone-600 dark:text-black rounded-xl flex items-center gap-2 font-medium shadow-sm transition-all text-sm">
                        <LuTrash2 size={16} /> Delete ({selectedBillItemIds.length})
                      </button>
                    )}
                    <button onClick={() => { setViewModalOpen(false); setMultiSelectMode(false); setSelectedBillItemIds([]); }} className="p-2.5 rounded-full bg-white dark:bg-stone-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-all">
                      <LuX size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 sm:p-8 pt-0 -mt-2">
                  {/* Title Block */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-stone-200 text-black dark:bg-stone-800 dark:text-white rounded-2xl">
                        <LuHistory size={24} />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{formatPeriod(selectedBill.month, selectedBill.year)}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Monthly Bill Record</p>
                      </div>
                    </div>
                    <button onClick={handleExportReport} className="flex items-center gap-2 px-4 py-2 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors border border-gray-200 dark:border-gray-700">
                      <LuFileText size={16} className="text-black dark:text-white" /> Export
                    </button>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="rounded-2xl p-5 bg-stone-50 dark:bg-stone-800/50 border border-gray-100 dark:border-gray-700/50">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-black dark:text-white">{formatCurrency(selectedBill.net_total)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg border ${
                          selectedBill.status === 'paid' ? 'bg-stone-200 text-black border-gray-300 dark:bg-stone-700 dark:text-white dark:border-gray-600' : 
                          'bg-stone-200 text-black border-gray-300 dark:bg-stone-700 dark:text-white dark:border-gray-600'
                        }`}>
                          {getStatusLabel(selectedBill.status)}
                        </span>
                        {selectedBill.payment_date && <span className="text-xs font-medium text-gray-500">on {new Date(selectedBill.payment_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl p-5 bg-stone-50 dark:bg-stone-800/50 border border-gray-100 dark:border-gray-700/50 flex flex-col justify-center space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Prepared By</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedBill.prepared_by_name || 'N/A'}</p>
                      </div>
                      {selectedBill.payment_method && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Method</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{selectedBill.payment_method}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const proofDocuments = parseProofDocuments(selectedBill.proof_documents_json);
                    return (
                      <div className="mb-8 rounded-2xl p-5 bg-stone-50 dark:bg-stone-800/50 border border-gray-100 dark:border-gray-700/50">
                        <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                          <LuFileText size={16} /> Proof Documents
                        </h4>
                        {proofDocuments.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">No proof documents attached.</p>
                        ) : (
                          <ul className="space-y-2">
                            {proofDocuments.map((doc, index) => {
                              const isUrl = /^https?:\/\//i.test(doc.reference);
                              return (
                                <li key={`${doc.label}-${index}`} className="rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-stone-900/40">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{doc.label}</p>
                                  {isUrl ? (
                                    <a
                                      href={doc.reference}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs break-all underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                      {doc.reference}
                                    </a>
                                  ) : (
                                    <p className="text-xs break-all text-gray-600 dark:text-gray-300">{doc.reference}</p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  {/* Category Breakdown nested cards */}
                  <div className="mb-8">
                    <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <LuDollarSign size={16} /> Category Breakdown
                    </h4>
                    <div className="bg-white dark:bg-stone-800/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-2 space-y-1">
                      {(() => {
                        const grouped = groupItemsByCategory(selectedBill.items || []);
                        const getSubtotal = (cat) => (grouped[cat] || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                        return [
                          { label: "Electricity", key: "electricity" }, { label: "Water", key: "water" },
                          { label: "Communications", key: "communications" }, { label: "Rental", key: "rental" },
                          { label: "Payment Fees", key: "payment_fees" }, { label: "Other", key: "other" },
                        ].map((cat, idx) => {
                          const sub = getSubtotal(cat.key);
                          if (sub === 0) return null;
                          return (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{cat.label}</span>
                              <span className="font-mono text-sm font-bold tracking-tight text-gray-900 dark:text-white">{formatCurrency(sub)}</span>
                            </div>
                          );
                        }).filter(Boolean);
                      })()}
                    </div>
                  </div>

                  {/* Detailed Line Items */}
                  <div>
                    <h4 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <LuFileText size={16} /> Line Items ({selectedBill.items?.length || 0})
                    </h4>
                    {!selectedBill.items?.length ? (
                      <div className="text-center py-10 text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">No items found</div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupItemsByCategory(selectedBill.items)).map(([category, items]) => {
                          if (!items.length) return null;
                          const categoryInfo = getCategoryInfo(category);
                          const isCollapsed = collapsedCategories[category];
                          const catTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                          
                          return (
                            <div key={category} className="bg-white dark:bg-stone-800/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                              <div className="px-4 py-3 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/80 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors" onClick={() => toggleCategory(category)}>
                                <div className="flex items-center gap-3">
                                  {multiSelectMode && (
                                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:text-white dark:focus:ring-white cursor-pointer"
                                      checked={items.every(i => selectedBillItemIds.includes(i.id))}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const ids = items.map(i => i.id);
                                        setSelectedBillItemIds(prev => e.target.checked ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id)));
                                      }} onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                                    {categoryInfo.label}
                                    <span className="px-2 py-0.5 text-[10px] bg-stone-200 dark:bg-stone-700 rounded-full text-gray-600 dark:text-gray-300">{items.length}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(catTotal)}</span>
                                  {isCollapsed ? <LuChevronRight size={18} className="text-gray-400" /> : <LuChevronDown size={18} className="text-gray-400" />}
                                </div>
                              </div>
                              
                              {!isCollapsed && (
                                <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                                  {items.map((item, idx) => (
                                    <div key={item.id || idx} className={`p-4 text-sm transition-colors ${multiSelectMode && selectedBillItemIds.includes(item.id) ? 'bg-stone-200/50 dark:bg-stone-700/50' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                                      <div className="flex items-start gap-3">
                                        {multiSelectMode && (
                                          <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:text-white dark:focus:ring-white cursor-pointer" checked={selectedBillItemIds.includes(item.id)} onChange={() => { setSelectedBillItemIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]); }} />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start mb-1">
                                            <p className="font-semibold text-gray-900 dark:text-white truncate pr-4">{item.provider_name || 'N/A'}</p>
                                            <p className="font-mono font-bold text-black dark:text-white">{formatCurrency(item.amount)}</p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-2">
                                            {item.account_number && <div><span className="font-medium mr-1 text-gray-400">Acct:</span>{item.account_number}</div>}
                                            {(item.reference_number || item.soa_number) && <div><span className="font-medium mr-1 text-gray-400">Ref:</span>{item.reference_number || item.soa_number}</div>}
                                            {item.location && <div className="col-span-2 truncate"><span className="font-medium mr-1 text-gray-400">Loc:</span>{item.location}</div>}
                                            {item.description && <div className="col-span-2 text-gray-400 italic truncate">{item.description}</div>}
                                          </div>
                                        </div>
                                        {!multiSelectMode && (
                                          <button className="text-gray-400 hover:text-black dark:hover:text-white p-1.5 transition-colors" title="Delete Item" onClick={() => handleDeleteBillItem(item)}>
                                            <LuTrash2 size={16} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Providers Tab */}
      {activeTab === "providers" && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-800/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center flex-1">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none text-sm font-medium transition-all">
                  <option value="">All Categories</option>
                  <option value="electricity">Electricity</option>
                  <option value="water">Water</option>
                  <option value="communications">Communications</option>
                  <option value="rental">Rental</option>
                  <option value="other">Other</option>
                </select>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 px-2">{providers.length} provider{providers.length !== 1 ? 's' : ''} found</div>
              </div>
              <button onClick={handleAddProvider} className="px-5 py-2.5 bg-black hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 dark:text-black text-white rounded-xl flex items-center gap-2 font-medium shadow-black/20 dark:shadow-white/20 shadow-lg transition-all">
                <LuPlus size={18} /> Add Provider
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-800/80 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-black dark:border-white"></div>
                <p className="mt-4 text-sm text-gray-500">Loading providers...</p>
              </div>
            ) : providers.length === 0 ? (
              <div className="p-16 text-center">
                <LuBuilding2 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{categoryFilter ? 'No Providers Match Your Filter' : 'No Service Providers Found'}</h3>
                <button onClick={handleAddProvider} className="mt-4 px-6 py-2.5 bg-black hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 dark:text-black text-white rounded-xl inline-flex items-center gap-2 font-medium shadow-sm">
                  <LuPlus size={18} /> Add Provider
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-stone-50/80 dark:bg-stone-900/50 border-b border-gray-100 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Website</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {providers.map((provider) => {
                      const Icon = getCategoryIcon(provider.category);
                      return (
                        <tr key={provider.id} className="group hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800">
                                <Icon size={18} className="text-black dark:text-white" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{provider.provider_name}</div>
                                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{getCategoryLabel(provider.category)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">{provider.hotline || '—'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{provider.email || '—'}</td>
                          <td className="px-6 py-4 text-sm text-black dark:text-white hover:underline cursor-pointer">{provider.website || '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${provider.is_active ? 'bg-stone-100 border-gray-300 text-black dark:bg-stone-800 dark:border-gray-600 dark:text-white' : 'bg-stone-50 border-gray-200 text-gray-600 dark:bg-stone-800 dark:border-gray-700 dark:text-gray-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${provider.is_active ? 'bg-black dark:bg-white' : 'bg-stone-400'}`}></span>
                              {provider.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditProvider(provider)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all"><LuPencil size={16} /></button>
                              <button onClick={() => handleDeleteProvider(provider)} className="p-1.5 text-gray-400 hover:text-black hover:bg-stone-200 dark:hover:text-white dark:hover:bg-stone-700 rounded transition-all"><LuTrash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <ProvidersBulkCreator isOpen={providerFormOpen} onClose={() => { setProviderFormOpen(false); setSelectedProvider(null); }} onSubmit={handleProviderFormSubmit} provider={selectedProvider} isEditing={!!selectedProvider} />
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setBillToDelete(null);
          setProviderToDelete(null);
          setBillItemToDelete(null);
          setBillItemIdsToDelete([]);
          setBillIdsToDelete([]);
        }}
        onConfirm={
          billToDelete
            ? confirmDelete
            : providerToDelete
              ? confirmDeleteProvider
              : billItemToDelete
                ? confirmDeleteBillItem
                : billItemIdsToDelete.length > 0
                  ? confirmBulkDeleteBillItems
                  : billIdsToDelete.length > 0
                    ? confirmBulkDeleteBills
                    : () => {}
        }
        title={
          billToDelete
            ? "Delete Bill"
            : providerToDelete
              ? "Delete Provider"
              : billItemToDelete
                ? "Delete Bill Item"
                : billItemIdsToDelete.length > 0
                  ? "Delete Selected Bill Items"
                  : billIdsToDelete.length > 0
                    ? "Delete Selected Bills"
                    : "Confirm Action"
        }
        message={
          billToDelete
            ? `Are you sure you want to delete the bill for ${formatPeriod(billToDelete.month, billToDelete.year)}? This action cannot be undone.`
            : providerToDelete
              ? `Are you sure you want to delete ${providerToDelete?.provider_name}? This action cannot be undone.`
              : billItemToDelete
                ? `Delete ${billItemToDelete.provider_name || 'this item'}? This action cannot be undone.`
                : billItemIdsToDelete.length > 0
                  ? `Delete ${billItemIdsToDelete.length} selected item${billItemIdsToDelete.length !== 1 ? 's' : ''}? This action cannot be undone.`
                  : billIdsToDelete.length > 0
                    ? `Delete ${billIdsToDelete.length} selected bill${billIdsToDelete.length !== 1 ? 's' : ''}? This action cannot be undone.`
                    : "Are you sure you want to proceed?"
        }
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