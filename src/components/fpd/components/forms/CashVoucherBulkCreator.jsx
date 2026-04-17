import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Plus, Save, ChevronDown, ChevronRight, 
  Trash2, Copy, Banknote, Calendar, User, 
  FileText, Hash, Wallet, AlignLeft
} from 'lucide-react';
import apiService from '../../../../utils/api/api-service';
import { useAuth } from "../../../../contexts/AuthContext";
import { ToastContainer } from '../main_ui/Toast';
import { useToast } from '../../hooks/useToast';

const CASH_STATUS_ORDER = ['draft', 'pending', 'approved', 'released', 'received', 'rejected', 'cancelled'];
const CASH_ALLOWED_TRANSITIONS = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['released', 'received', 'cancelled'],
  released: ['received', 'cancelled'],
  received: [],
  rejected: ['pending', 'cancelled'],
  cancelled: ['draft', 'pending'],
};

const getSelectableCashStatuses = (status, isEditMode = false) => {
  if (!isEditMode) {
    return CASH_STATUS_ORDER;
  }
  const normalizedStatus = String(status || 'pending').toLowerCase();
  const options = [normalizedStatus, ...(CASH_ALLOWED_TRANSITIONS[normalizedStatus] || [])];
  return CASH_STATUS_ORDER.filter((candidate) => options.includes(candidate));
};

/**
 * Modern Bulk Creator for Cash Vouchers
 * Replaces the old VoucherForm. Handles both single and bulk creation.
 */
export default function CashVoucherBulkCreator({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isDarkMode: propIsDarkMode,
  createdBy,
  editMode = false,
  initialData = null,
  initialDraft = null,
  initialDrafts = [],
}) {
  const { isDarkMode: authIsDarkMode, user: authUser } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const { toasts, showWarning, showError, removeToast } = useToast();

  const normalizeCashStatus = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    const allowedStatuses = new Set(['draft', 'pending', 'approved', 'released', 'received', 'rejected', 'cancelled']);
    return allowedStatuses.has(normalized) ? normalized : 'pending';
  };

  const buildVouchersFromInitialData = (data) => {
    const lineItems = (data.line_items || []).map((item, index) => ({
      id: `line-${Date.now()}-${index}`,
      description: item.description || '',
      reference: item.reference || '',
      amount: parseFloat(item.debit_amount || 0) + parseFloat(item.credit_amount || 0)
    }));

    return [{
      id: `voucher-${Date.now()}`,
      voucher_id: data.id,
      voucher_number: data.voucher_number,
      voucher_date: data.voucher_date,
      transaction_type: data.transaction_type || 'debit',
      company_payee_payor: data.company_payee_payor || '',
      cash_source: data.cash_source || '',
      invoice_number: data.invoice_number || '',
      po_number: data.po_number || '',
      with_copy: data.with_copy || false,
      status: normalizeCashStatus(data.status),
      remarks: data.remarks || '',
      lineItems: lineItems.length > 0 ? lineItems : [createEmptyLineItem()],
      expanded: true
    }];
  };

  // --- STATE MANAGEMENT ---
  const [vouchers, setVouchers] = useState(() => {
    if (editMode && initialData) {
      return buildVouchersFromInitialData(initialData);
    }
    if (!editMode && Array.isArray(initialDrafts) && initialDrafts.length > 0) {
      return initialDrafts.map((draft) => {
        const normalizedLineItems = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
          ? draft.lineItems.map((item) => ({
              ...createEmptyLineItem(),
              ...item,
            }))
          : [createEmptyLineItem()];
        return { ...createEmptyVoucher(), ...draft, status: normalizeCashStatus(draft.status), lineItems: normalizedLineItems };
      });
    }
    if (!editMode && initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      return [{ ...createEmptyVoucher(), ...initialDraft, status: normalizeCashStatus(initialDraft.status), lineItems: normalizedLineItems }];
    }
    return [createEmptyVoucher()];
  });
  
  const [nextVoucherNumber, setNextVoucherNumber] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!editMode && isOpen) fetchNextVoucherNumber();
  }, [editMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (editMode) {
      if (initialData) {
        setVouchers(buildVouchersFromInitialData(initialData));
      }
      return;
    }

    if (Array.isArray(initialDrafts) && initialDrafts.length > 0) {
      setVouchers(
        initialDrafts.map((draft) => {
          const normalizedLineItems = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
            ? draft.lineItems.map((item) => ({
                ...createEmptyLineItem(),
                ...item,
              }))
            : [createEmptyLineItem()];
          return { ...createEmptyVoucher(), ...draft, status: normalizeCashStatus(draft.status), lineItems: normalizedLineItems };
        }),
      );
    } else if (initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      setVouchers([{ ...createEmptyVoucher(), ...initialDraft, status: normalizeCashStatus(initialDraft.status), lineItems: normalizedLineItems }]);
    } else {
      setVouchers([createEmptyVoucher()]);
    }
  }, [isOpen, editMode, initialData?.id, initialData?.voucher_number, initialDraft, initialDrafts?.length]);

  const fetchNextVoucherNumber = async () => {
    try {
      const response = await apiService.finance.getNextCashVoucherNumber(); // Ensure this API endpoint exists
      setNextVoucherNumber(response.next_voucher_number);
    } catch (error) {
      console.error('Failed to fetch next voucher number:', error);
      setNextVoucherNumber('CV-####');
    }
  };

  function createEmptyVoucher() {
    return {
      id: `voucher-${Date.now()}-${Math.random()}`,
      voucher_date: new Date().toISOString().split('T')[0],
      transaction_type: 'debit',
      company_payee_payor: '',
      cash_source: '',
      invoice_number: '',
      po_number: '',
      with_copy: false,
      status: 'pending',
      remarks: '',
      lineItems: [createEmptyLineItem()],
      expanded: true
    };
  }

  function createEmptyLineItem() {
    return {
      id: `line-${Date.now()}-${Math.random()}`,
      description: '',
      reference: '',
      amount: 0
    };
  }

  // --- HANDLERS ---
  const handleAddVouchers = (count) => {
    const newVouchers = Array.from({ length: count }, () => createEmptyVoucher());
    setVouchers([...vouchers, ...newVouchers]);
  };

  const handleDeleteVoucher = (voucherId) => {
    if (vouchers.length === 1) {
      showWarning('Cannot delete the last voucher');
      return;
    }
    setVouchers(vouchers.filter(v => v.id !== voucherId));
  };

  const handleUpdateVoucher = (voucherId, updates) => {
    setVouchers(vouchers.map(v => v.id === voucherId ? { ...v, ...updates } : v));
  };

  const toggleExpanded = (voucherId) => {
    setVouchers(vouchers.map(v => v.id === voucherId ? { ...v, expanded: !v.expanded } : v));
  };

  const handleAddLineItem = (voucherId) => {
    setVouchers(vouchers.map(v => 
      v.id === voucherId ? { ...v, lineItems: [...v.lineItems, createEmptyLineItem()] } : v
    ));
  };

  const handleUpdateLineItem = (voucherId, lineItemId, updates) => {
    setVouchers(vouchers.map(v => 
      v.id === voucherId 
        ? { ...v, lineItems: v.lineItems.map(li => li.id === lineItemId ? { ...li, ...updates } : li) }
        : v
    ));
  };

  const handleDeleteLineItem = (voucherId, lineItemId) => {
    setVouchers(vouchers.map(v => {
      if (v.id !== voucherId) return v;
      const newLineItems = v.lineItems.filter(li => li.id !== lineItemId);
      return { 
        ...v, 
        lineItems: newLineItems.length > 0 ? newLineItems : [createEmptyLineItem()] 
      };
    }));
  };

  const handlePasteLineItem = (voucherId, field, e) => {
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 1) {
      e.preventDefault();
      setVouchers(vouchers.map(v => {
        if (v.id !== voucherId) return v;
        const currentLineItems = [...v.lineItems];
        const newLineItems = lines.map((line) => ({ ...createEmptyLineItem(), [field]: line.trim() }));
        return { ...v, lineItems: [...currentLineItems, ...newLineItems] };
      }));
    }
  };

  const calculateTotals = () => {
    const totalDebit = vouchers
      .filter(v => v.transaction_type === 'debit')
      .reduce((sum, v) => sum + v.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), 0);
    const totalCredit = vouchers
      .filter(v => v.transaction_type === 'credit')
      .reduce((sum, v) => sum + v.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), 0);
    return { totalDebit, totalCredit, grandTotal: totalDebit + totalCredit };
  };

  const handleSaveAll = async () => {
    try {
        const mapVoucher = (voucher) => ({
            voucher_date: voucher.voucher_date,
            transaction_type: voucher.transaction_type,
            company_payee_payor: voucher.company_payee_payor,
            cash_source: voucher.cash_source || null,
            invoice_number: voucher.invoice_number || null,
            po_number: voucher.po_number || null,
            with_copy: voucher.with_copy ? 1 : 0,
            status: normalizeCashStatus(voucher.status),
            remarks: voucher.remarks || null,
            created_by: createdBy,
            
            // Header totals
            total_amount: voucher.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
            dr_amount: voucher.transaction_type === 'debit' ? voucher.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) : 0,
            cr_amount: voucher.transaction_type === 'credit' ? voucher.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) : 0,

            line_items: voucher.lineItems.map(item => ({
                description: item.description || null,
                reference: item.reference || null,
                debit_amount: voucher.transaction_type === 'debit' ? parseFloat(item.amount) || 0 : 0,
                credit_amount: voucher.transaction_type === 'credit' ? parseFloat(item.amount) || 0 : 0
            }))
        });

        const payload = editMode ? mapVoucher(vouchers[0]) : vouchers.map(mapVoucher);
        
        if (editMode) {
            await onSubmit(payload); // Single update
        } else {
            await onSubmit(payload); // Bulk create array
        }
        
    } catch (error) {
      console.error('Failed to save vouchers:', error);
      showError('Failed to save vouchers: ' + (error.message || 'Unknown error'));
    }
  };

  const totals = calculateTotals();
  if (!isOpen) return null;

  // Theme Helpers
  const bgBase = isDarkMode ? 'bg-stone-950' : 'bg-stone-100';
  const bgCard = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <div 
        ref={modalRef}
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase}`}
      >
        {/* --- HEADER --- */}
        <div className={`sticky top-0 z-20 px-6 py-4 border-b ${borderCol} ${bgCard} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
               <Banknote className="w-5 h-5 text-blue-500" />
               {editMode ? 'Edit Cash Voucher' : 'Bulk Create Cash Vouchers'}
            </h2>
            <div className={`mt-1 flex items-center gap-4 text-xs ${textSecondary}`}>
              <span>Rows: <strong className={textPrimary}>{vouchers.length}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span>Debit: <strong className="text-rose-500">₱{totals.totalDebit.toLocaleString()}</strong></span>
              <span>Credit: <strong className="text-emerald-500">₱{totals.totalCredit.toLocaleString()}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span>Total: <strong className="text-blue-500 font-mono text-sm">₱{totals.grandTotal.toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleSaveAll}
              className="flex-1 sm:flex-none px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} /> {editMode ? 'Update Changes' : 'Save All'}
            </button>
            <button 
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-gray-400' : 'hover:bg-stone-200 text-gray-500'}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {vouchers.map((voucher, index) => (
            <VoucherCard
              key={voucher.id}
              index={index}
              voucher={voucher}
              nextVoucherNumber={nextVoucherNumber}
              editMode={editMode}
              isDarkMode={isDarkMode}
              onUpdate={(u) => handleUpdateVoucher(voucher.id, u)}
              onDelete={() => handleDeleteVoucher(voucher.id)}
              onToggleExpanded={() => toggleExpanded(voucher.id)}
              onAddLineItem={() => handleAddLineItem(voucher.id)}
              onUpdateLineItem={(lid, u) => handleUpdateLineItem(voucher.id, lid, u)}
              onDeleteLineItem={(lid) => handleDeleteLineItem(voucher.id, lid)}
              onPasteLineItem={(f, e) => handlePasteLineItem(voucher.id, f, e)}
            />
          ))}
          
          {!editMode && (
            <button 
              onClick={() => handleAddVouchers(1)}
              className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all opacity-60 hover:opacity-100 ${
                isDarkMode 
                  ? 'border-gray-800 hover:border-gray-700 text-gray-400 hover:bg-stone-900' 
                  : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:bg-white'
              }`}
            >
              <Plus size={20} /> Add Another Voucher
            </button>
          )}
        </div>
      </div>
    </div>
    <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

/**
 * Individual Voucher Card (Cash Version)
 */
function VoucherCard({ 
  voucher, 
  index,
  nextVoucherNumber,
  editMode,
  isDarkMode,
  onUpdate, 
  onDelete, 
  onToggleExpanded,
  onAddLineItem, 
  onUpdateLineItem, 
  onDeleteLineItem,
  onPasteLineItem
}) {
  const voucherTotal = voucher.lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const selectableStatuses = getSelectableCashStatuses(voucher.status, editMode);
  
  // Calculate preview number
  let displayVoucherNum = '...';
  if (editMode) displayVoucherNum = voucher.voucher_number || 'N/A';
  else if (nextVoucherNumber && typeof nextVoucherNumber === 'string') {
    const numMatch = nextVoucherNumber.match(/\d+$/); // Extract trailing numbers
    const prefix = nextVoucherNumber.replace(/\d+$/, ''); // Extract prefix
    const num = numMatch ? parseInt(numMatch[0]) : 0; // Parse trailing numbers
    displayVoucherNum = `${prefix}${String(num + index).padStart(3, '0')}`; // Ensure 3-digit format
  }

  // Theme Helpers
  const cardBg = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-stone-950 border-gray-700 focus:border-blue-500 text-white' : 'bg-white border-gray-300 focus:border-blue-500 text-gray-900';
  const labelCol = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 ${cardBg} ${borderCol}`}>
      {/* --- CARD HEADER --- */}
      <div className="p-4">
        {/* Top Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <button onClick={onToggleExpanded} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                {voucher.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
             </button>
             <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${isDarkMode ? 'bg-stone-800 text-blue-400' : 'bg-gray-50 text-blue-600'}`}>
                {displayVoucherNum}
             </span>
             <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {voucher.company_payee_payor || 'Untitled Voucher'}
             </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
                <p className={`text-[10px] uppercase font-bold tracking-wider ${labelCol}`}>Total Amount</p>
                <p className={`text-lg font-bold font-mono ${voucher.transaction_type === 'debit' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    ₱{voucherTotal.toLocaleString()}
                </p>
            </div>
            {!editMode && (
                <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={18} />
                </button>
            )}
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Date */}
            <div className="md:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Date</label>
                <div className="relative">
                    <Calendar size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="date" 
                        value={voucher.voucher_date}
                        onChange={(e) => onUpdate({ voucher_date: e.target.value })}
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            </div>

            {/* Type */}
            <div className="md:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Type</label>
                <select
                    value={voucher.transaction_type}
                    onChange={(e) => onUpdate({ transaction_type: e.target.value })}
                    className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}
                >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                </select>
            </div>

            {/* Payee / Company */}
            <div className="md:col-span-4">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Payee / Company</label>
                <div className="relative">
                    <User size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.company_payee_payor}
                        onChange={(e) => onUpdate({ company_payee_payor: e.target.value })}
                        placeholder="Name..."
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            </div>

             {/* Status */}
             <div className="md:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Status</label>
                <select
                    value={voucher.status}
                    onChange={(e) => onUpdate({ status: e.target.value })}
                    className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}
                >
                    {selectableStatuses.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                      </option>
                    ))}
                </select>
            </div>

            {/* Copy Checkbox */}
            <div className="md:col-span-2 flex items-center h-full pt-6">
                 <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${voucher.with_copy ? 'bg-gray-600 border-blue-600' : isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                        {voucher.with_copy && <Copy size={12} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={voucher.with_copy} onChange={(e) => onUpdate({ with_copy: e.target.checked })} className="hidden" />
                    <span className={`text-sm ${labelCol}`}>With Copy</span>
                 </label>
            </div>

            {/* Row 2: Details */}
            <div className="md:col-span-3">
                 <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Cash Source</label>
                 <div className="relative">
                    <Wallet size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.cash_source}
                        onChange={(e) => onUpdate({ cash_source: e.target.value })}
                        placeholder="Source..."
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                 </div>
            </div>

            <div className="md:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Invoice #</label>
                <div className="relative">
                    <Hash size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.invoice_number}
                        onChange={(e) => onUpdate({ invoice_number: e.target.value })}
                        placeholder="Inv#"
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            </div>

            <div className="md:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>PO Number</label>
                <div className="relative">
                    <FileText size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.po_number}
                        onChange={(e) => onUpdate({ po_number: e.target.value })}
                        placeholder="PO#"
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            </div>

            <div className="md:col-span-5">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Remarks</label>
                 <div className="relative">
                    <AlignLeft size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.remarks}
                        onChange={(e) => onUpdate({ remarks: e.target.value })}
                        placeholder="Optional details..."
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                 </div>
            </div>
        </div>
      </div>

      {/* --- BODY (Line Items) --- */}
      {voucher.expanded && (
        <div className={`border-t ${borderCol}`}>
          <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider grid grid-cols-[30px_1fr_1fr_100px_30px] gap-2 items-center opacity-70 ${isDarkMode ? 'bg-stone-800/50' : 'bg-stone-50'}`}>
            <div className="text-center">#</div>
            <div>Description</div>
            <div>Reference</div>
            <div className="text-right">Amount</div>
            <div></div>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {voucher.lineItems.map((item, i) => (
               <div key={item.id} className="group relative grid grid-cols-[30px_1fr_1fr_100px_30px] gap-2 px-4 py-2 items-start hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className={`text-xs text-center pt-2 ${labelCol}`}>{i + 1}</div>
                  
                  <input 
                    type="text" 
                    value={item.description} 
                    onChange={(e) => onUpdateLineItem(item.id, { description: e.target.value })}
                    onPaste={(e) => onPasteLineItem('description', e)}
                    placeholder="Description..."
                    className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                  />
                  
                  <input 
                    type="text" 
                    value={item.reference} 
                    onChange={(e) => onUpdateLineItem(item.id, { reference: e.target.value })}
                    onPaste={(e) => onPasteLineItem('reference', e)}
                    placeholder="Ref..."
                    className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                  />

                  <input 
                    type="number" 
                    value={item.amount || ''} 
                    onChange={(e) => onUpdateLineItem(item.id, { amount: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full bg-transparent text-right px-1 py-1 rounded text-sm font-mono border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-emerald-400 placeholder-gray-700' : 'text-emerald-600 placeholder-gray-300'}`}
                  />
                  
                  <button 
                    onClick={() => onDeleteLineItem(item.id)}
                    className="flex items-center justify-center pt-1.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
               </div>
            ))}
          </div>

          <div className={`px-4 py-3 ${isDarkMode ? 'bg-stone-800/30' : 'bg-stone-50'}`}>
            <button 
                onClick={onAddLineItem}
                className={`text-xs font-semibold flex items-center gap-1 transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
                <Plus size={14} /> Add Line Item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}