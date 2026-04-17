import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Plus, Save, ChevronDown, ChevronRight, 
  Trash2, Copy, Receipt, CreditCard, Calendar,
  Building2, Banknote, Tag
} from 'lucide-react';
import apiService from '../../../../utils/api/api-service';
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/main_ui/Toast';

const EMPTY_DRAFTS = [];

/**
 * Modern Bulk Creator for Check Vouchers
 * Card-based layout to solve width issues while maintaining density.
 */
export default function CheckVoucherBulkCreator({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isDarkMode: propIsDarkMode,
  createdBy,
  editMode = false,
  initialData = null,
  initialDraft = null,
  initialDrafts,
}) {
  const { isDarkMode: authIsDarkMode, user: authUser } = useAuth();
  const { toasts, showError, showWarning, removeToast } = useToast();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const safeInitialDrafts = Array.isArray(initialDrafts) ? initialDrafts : EMPTY_DRAFTS;
  const hydrationSignatureRef = useRef('');

  const buildVouchersFromInitialData = (data) => {
    const lineItems = (data.line_items || []).map((item, index) => ({
      id: `line-${Date.now()}-${index}`,
      po_number: item.po_number || '',
      si_number: item.si_number || '',
      dr_number: item.dr_number || '',
      qi_number: item.qi_number || '',
      remark: item.remark || '',
      includeInExpenses: item.include_in_expenses == 1,
      with_copy: item.with_copy || false,
      amount: parseFloat(item.amount || 0)
    }));

    return [{
      id: `voucher-${Date.now()}`,
      voucher_id: data.id,
      voucher_number: data.voucher_number,
      voucher_date: data.voucher_date,
      transaction_type: data.transaction_type || 'debit',
      company_payee_payor: data.company_payee_payor || '',
      bank_check_no: data.bank_check_no || '',
      bank_deposited: data.bank_deposited || '',
      discount_type: data.discount_type || 'none',
      discount_value: data.discount_value || 0,
      cleared_date: data.cleared_date || '',
      status: data.status || 'pending',
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
    if (!editMode && safeInitialDrafts.length > 0) {
      return safeInitialDrafts.map((draft) => {
        const normalizedLineItems = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
          ? draft.lineItems.map((item) => ({
              ...createEmptyLineItem(),
              ...item,
            }))
          : [createEmptyLineItem()];
        return { ...createEmptyVoucher(), ...draft, lineItems: normalizedLineItems };
      });
    }
    if (!editMode && initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      return [{ ...createEmptyVoucher(), ...initialDraft, lineItems: normalizedLineItems }];
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

    const hydrationSignature = JSON.stringify({
      isOpen,
      editMode,
      initialData: editMode && initialData
        ? {
            id: initialData.id ?? null,
            voucher_number: initialData.voucher_number ?? null,
            voucher_date: initialData.voucher_date ?? null,
            transaction_type: initialData.transaction_type ?? null,
            status: initialData.status ?? null,
            line_items: Array.isArray(initialData.line_items)
              ? initialData.line_items.map((item) => ({
                  po_number: item?.po_number ?? '',
                  si_number: item?.si_number ?? '',
                  dr_number: item?.dr_number ?? '',
                  qi_number: item?.qi_number ?? '',
                  remark: item?.remark ?? '',
                  include_in_expenses: item?.include_in_expenses ?? 0,
                  with_copy: item?.with_copy ?? false,
                  amount: item?.amount ?? 0,
                }))
              : [],
          }
        : null,
      initialDraft: !editMode && initialDraft ? initialDraft : null,
      initialDrafts: !editMode ? safeInitialDrafts : EMPTY_DRAFTS,
    });

    if (hydrationSignatureRef.current === hydrationSignature) {
      return;
    }

    hydrationSignatureRef.current = hydrationSignature;

    if (editMode) {
      if (initialData) {
        setVouchers(buildVouchersFromInitialData(initialData));
      }
      return;
    }

    if (safeInitialDrafts.length > 0) {
      setVouchers(
        safeInitialDrafts.map((draft) => {
          const normalizedLineItems = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
            ? draft.lineItems.map((item) => ({
                ...createEmptyLineItem(),
                ...item,
              }))
            : [createEmptyLineItem()];
          return { ...createEmptyVoucher(), ...draft, lineItems: normalizedLineItems };
        }),
      );
    } else if (initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      setVouchers([{ ...createEmptyVoucher(), ...initialDraft, lineItems: normalizedLineItems }]);
    } else {
      setVouchers([createEmptyVoucher()]);
    }
  }, [isOpen, editMode, initialData, initialDraft, safeInitialDrafts]);

  const fetchNextVoucherNumber = async () => {
    try {
      const response = await apiService.finance.getNextCheckVoucherNumber();
      setNextVoucherNumber(response.next_voucher_number);
    } catch (error) {
      console.error('Failed to fetch next voucher number:', error);
    }
  };

  function createEmptyVoucher() {
    return {
      id: `voucher-${Date.now()}-${Math.random()}`,
      voucher_date: new Date().toISOString().split('T')[0],
      transaction_type: 'debit',
      company_payee_payor: '',
      bank_check_no: '',
      bank_deposited: '',
      discount_type: 'none',
      discount_value: 0,
      cleared_date: '',
      status: 'pending',
      remarks: '',
      lineItems: [createEmptyLineItem()],
      expanded: true
    };
  }

  function createEmptyLineItem() {
    return {
      id: `line-${Date.now()}-${Math.random()}`,
      po_number: '',
      si_number: '',
      dr_number: '',
      qi_number: '',
      remark: '',
      includeInExpenses: false,
      with_copy: false,
      amount: 0
    };
  }

  // --- HANDLERS ---
  const handleAddVouchers = (count) => {
    const newVouchers = Array.from({ length: count }, () => createEmptyVoucher());
    setVouchers([...vouchers, ...newVouchers]);
  };

  const handleDeleteVoucher = (voucherId) => {
    if (vouchers.length === 1) { showWarning('Cannot delete the last voucher'); return; }
    setVouchers(vouchers.filter(v => v.id !== voucherId));
  };

  const handleUpdateVoucher = (voucherId, updates) => {
    setVouchers(vouchers.map(v => {
      if (v.id !== voucherId) return v;
      const updated = { ...v, ...updates };
      if (updates.transaction_type) {
        const validStatuses = getStatusOptions(updates.transaction_type).map(o => o.value);
        if (!validStatuses.includes(updated.status)) {
          updated.status = 'pending';
        }
        if (updates.transaction_type === 'debit') {
          updated.lineItems = (updated.lineItems || []).map(li => ({
            ...li,
            includeInExpenses: false,
          }));
        }
      }
      return updated;
    }));
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
      return { ...v, lineItems: newLineItems.length > 0 ? newLineItems : [createEmptyLineItem()] };
    }));
  };

  const handlePasteLineItem = (voucherId, field, e) => {
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 1) {
      e.preventDefault();
      setVouchers(vouchers.map(v => {
        if (v.id !== voucherId) return v;
        const newLineItems = lines.map((line) => ({ ...createEmptyLineItem(), [field]: line.trim() }));
        return { ...v, lineItems: [...v.lineItems, ...newLineItems] };
      }));
    }
  };

  const getEffectiveTotal = (voucher) => {
    const raw = voucher.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const val = parseFloat(voucher.discount_value) || 0;
    if (voucher.discount_type === 'amount') return Math.max(0, raw - val);
    if (voucher.discount_type === 'percentage') return Math.max(0, raw - (raw * val / 100));
    return raw;
  };

  const getStatusOptions = (transactionType) => {
    const base = [
      { value: 'draft',   label: 'Draft' },
      { value: 'pending', label: 'Pending' },
    ];
    if (transactionType === 'credit') {
      return [...base, { value: 'released', label: 'Released' }];
    }
    return [...base, { value: 'received', label: 'Received' }];
  };

  const calculateTotals = () => {
    const totalDebit = vouchers
      .filter(v => v.transaction_type === 'debit')
      .reduce((sum, v) => sum + getEffectiveTotal(v), 0);
    const totalCredit = vouchers
      .filter(v => v.transaction_type === 'credit')
      .reduce((sum, v) => sum + getEffectiveTotal(v), 0);
    return { totalDebit, totalCredit, grandTotal: totalDebit + totalCredit };
  };

  const handleSaveAll = async () => {
    try {
      const mapVoucher = (voucher) => {
        const rawTotal = voucher.lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const val = parseFloat(voucher.discount_value) || 0;
        let effectiveTotal = rawTotal;
        if (voucher.discount_type === 'amount') effectiveTotal = Math.max(0, rawTotal - val);
        else if (voucher.discount_type === 'percentage') effectiveTotal = Math.max(0, rawTotal - (rawTotal * val / 100));
        const drAmount = voucher.transaction_type === 'debit' ? effectiveTotal : 0;
        const crAmount = voucher.transaction_type === 'credit' ? effectiveTotal : 0;

        return {
          voucher_date: voucher.voucher_date,
          transaction_type: voucher.transaction_type,
          company_payee_payor: voucher.company_payee_payor,
          bank_check_no: voucher.bank_check_no || null,
          bank_deposited: voucher.bank_deposited || null,
          discount_type: voucher.discount_type === 'none' ? null : voucher.discount_type,
          discount_value: val,
          dr_amount: drAmount,
          cr_amount: crAmount,
          total_amount: effectiveTotal,
          cleared_date: voucher.cleared_date || null,
          ...(!editMode ? { status: voucher.status } : {}),
          remarks: voucher.remarks || null,
          created_by: createdBy,
          line_items: voucher.lineItems.map(item => ({
            po_number: item.po_number || null,
            si_number: item.si_number || null,
            dr_number: item.dr_number || null,
            qi_number: item.qi_number || null,
            remark: item.remark || null,
            item_status: 0,
            include_in_expenses: voucher.transaction_type === 'credit' && item.includeInExpenses ? 1 : 0,
            with_copy: item.with_copy ? 1 : 0,
            amount: parseFloat(item.amount) || 0
          }))
        };
      };

      const payload = editMode ? mapVoucher(vouchers[0]) : vouchers.map(mapVoucher);
      await onSubmit(payload);
    } catch (error) {
      console.error('Failed to save vouchers:', error);
      showError('Failed to save vouchers: ' + (error.message || 'Unknown error'));
    }
  };

  const totals = calculateTotals();
  if (!isOpen) return null;

  const bgBase = isDarkMode ? 'bg-stone-950' : 'bg-stone-100';
  const bgCard = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <div 
        ref={modalRef}
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase}`}
      >
        {/* --- HEADER --- */}
        <div className={`sticky top-0 z-20 px-6 py-4 border-b ${borderCol} ${bgCard} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
               <Receipt className="w-5 h-5 text-blue-500" />
               {editMode ? 'Edit Check Voucher' : 'Bulk Create Check Vouchers'}
            </h2>
            <div className={`mt-1 flex items-center gap-4 text-xs ${textSecondary}`}>
              <span>Count: <strong className={textPrimary}>{vouchers.length}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span>Debit: <strong className="text-emerald-500 font-mono text-sm">₱{totals.totalDebit.toLocaleString()}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span>Credit: <strong className="text-blue-500 font-mono text-sm">₱{totals.totalCredit.toLocaleString()}</strong></span>
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
              effectiveTotal={getEffectiveTotal(voucher)}
              statusOptions={getStatusOptions(voucher.transaction_type)}
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
      <ToastContainer toasts={toasts} removeToast={removeToast} isDarkMode={isDarkMode} />
    </div>
  );
}

/**
 * Individual Voucher Card
 */
function VoucherCard({ 
  voucher, 
  index,
  nextVoucherNumber,
  editMode,
  isDarkMode,
  effectiveTotal,
  statusOptions,
  onUpdate, 
  onDelete, 
  onToggleExpanded,
  onAddLineItem, 
  onUpdateLineItem, 
  onDeleteLineItem,
  onPasteLineItem
}) {
  const rawTotal = voucher.lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const discountAmount = rawTotal - effectiveTotal;
  const voucherTotal = effectiveTotal;

  const isCredit = voucher.transaction_type === 'credit';
  const isDebit  = voucher.transaction_type === 'debit';
  const showBankDeposited = isCredit;
  const showIncludeInExpenses = isCredit;

  const expenseCount = showIncludeInExpenses
    ? voucher.lineItems.filter(li => li.includeInExpenses).length
    : 0;

  const copyCount = voucher.lineItems.filter(li => li.with_copy).length;
  
  let displayVoucherNum = '...';
  if (editMode) displayVoucherNum = voucher.voucher_number || 'N/A';
  else if (nextVoucherNumber) {
    const num = nextVoucherNumber.replace(/[^0-9]/g, '');
    const prefix = nextVoucherNumber.replace(/[0-9]/g, '');
    displayVoucherNum = prefix + (parseInt(num) + index);
  }

  const cardBg = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-stone-950 border-gray-700 focus:border-blue-500 text-white' : 'bg-white border-gray-300 focus:border-blue-500 text-gray-900';
  const labelCol = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 ${cardBg} ${borderCol}`}>
      {/* --- CARD HEADER --- */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <button onClick={onToggleExpanded} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                {voucher.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
             </button>
             <div className="flex flex-col leading-tight">
               <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${isDarkMode ? 'bg-stone-800 text-blue-400' : 'bg-gray-50 text-blue-600'}`}>
                  {displayVoucherNum}
               </span>
               <span className={`text-xs opacity-80 truncate max-w-[200px] ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                 {voucher.company_payee_payor || 'Untitled Voucher'}
               </span>
             </div>

             {showIncludeInExpenses && expenseCount > 0 && (
               <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                 isDarkMode
                   ? 'bg-green-900/40 text-green-400 border border-green-700'
                   : 'bg-green-50 text-green-700 border border-green-200'
               }`}>
                 <span className="w-1.5 h-1.5 rounded-full bg-current" />
                 {expenseCount} in expenses
               </span>
             )}

             {copyCount > 0 && (
               <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                 isDarkMode
                   ? 'bg-gray-900/40 text-blue-400 border border-blue-700'
                   : 'bg-gray-50 text-blue-700 border border-blue-200'
               }`}>
                 <Copy size={10} />
                 {copyCount} w/ copy
               </span>
             )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
                {isDebit ? (
                  <>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${labelCol}`}>Total Debit</p>
                    <p className="text-lg font-bold font-mono text-emerald-500">₱{voucherTotal.toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${labelCol}`}>Total Credit</p>
                    <p className="text-lg font-bold font-mono text-blue-500">₱{voucherTotal.toLocaleString()}</p>
                  </>
                )}
                {discountAmount > 0 && (
                  <p className={`text-[10px] font-mono ${labelCol}`}>
                    - ₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} discount
                  </p>
                )}
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

            <div className="md:col-span-4">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Company / Payee / Payor</label>
                <div className="relative">
                    <Building2 size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.company_payee_payor}
                        onChange={(e) => onUpdate({ company_payee_payor: e.target.value })}
                        placeholder="Name..."
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            </div>

            <div className="md:col-span-4">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Status</label>
                <select
                    value={voucher.status}
                    onChange={(e) => onUpdate({ status: e.target.value })}
                    className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}
                >
                    {statusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div className="md:col-span-3">
                 <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Check No.</label>
                 <div className="relative">
                    <CreditCard size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.bank_check_no}
                        onChange={(e) => onUpdate({ bank_check_no: e.target.value })}
                        placeholder="Check #"
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                 </div>
            </div>

            {showBankDeposited && (
                <div className="md:col-span-3">
                    <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Deposited To</label>
                    <input 
                        type="text" 
                        value={voucher.bank_deposited}
                        onChange={(e) => onUpdate({ bank_deposited: e.target.value })}
                        placeholder="Bank Name"
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                </div>
            )}

            <div className="md:col-span-3">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Discount</label>
                <div className="flex gap-1">
                     <select
                        value={voucher.discount_type}
                        onChange={(e) => onUpdate({ discount_type: e.target.value })}
                        className={`w-1/2 px-1 py-1.5 text-sm rounded-l-lg border-y border-l outline-none transition-all ${inputBg}`}
                    >
                        <option value="none">None</option>
                        <option value="amount">Fixed</option>
                        <option value="percentage">%</option>
                    </select>
                    {voucher.discount_type !== 'none' && (
                        <input 
                            type="number"
                            value={voucher.discount_value}
                            onChange={(e) => onUpdate({ discount_value: e.target.value })}
                            className={`w-1/2 px-2 py-1.5 text-sm rounded-r-lg border outline-none transition-all ${inputBg}`}
                        />
                    )}
                    {voucher.discount_type === 'none' && (
                        <div className={`w-1/2 border-y border-r rounded-r-lg ${isDarkMode ? 'border-gray-700 bg-stone-800' : 'border-gray-300 bg-stone-100'}`}></div>
                    )}
                </div>
            </div>

            <div className="md:col-span-3">
                <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Remarks</label>
                 <div className="relative">
                    <Tag size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                    <input 
                        type="text" 
                        value={voucher.remarks}
                        onChange={(e) => onUpdate({ remarks: e.target.value })}
                        placeholder="Optional..."
                        className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} 
                    />
                 </div>
            </div>
        </div>
      </div>

      {/* --- BODY (Line Items) --- */}
      {voucher.expanded && (
        <div className={`border-t ${borderCol}`}>
          {/* Desktop Table Header
              Columns (Status/OK removed):
              - Debit:  #, Exp, PO, SI, DR, QI, Remark, Copy, Amount, del
              - Credit: #,     PO, SI, DR, QI, Remark, Copy, Amount, del  */}
          <div
            className={`hidden sm:grid gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70 ${isDarkMode ? 'bg-stone-800/50' : 'bg-stone-50'}`}
            style={{
              gridTemplateColumns: showIncludeInExpenses
                ? '30px 50px 1fr 1fr 1fr 1fr 2fr 50px 100px 30px'
                : '30px 1fr 1fr 1fr 1fr 2fr 50px 100px 30px',
            }}
          >
            <div className="text-center">#</div>
            {showIncludeInExpenses && (
              <div className="text-center" title="Include in Expenses">Exp</div>
            )}
            <div>PO #</div>
            <div>SI #</div>
            <div>DR #</div>
            <div>QI/QF</div>
            <div>Remark</div>
            <div className="text-center" title="With Copy">Copy</div>
            <div className="text-right">Amount</div>
            <div></div>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {voucher.lineItems.map((item, i) => (
               <div key={item.id} className="group">
                 {/* Desktop row */}
                 <div
                   className={`hidden sm:grid gap-2 px-4 py-3 items-center transition-colors
                     ${item.includeInExpenses && showIncludeInExpenses
                       ? isDarkMode ? 'bg-green-900/10 hover:bg-green-900/20' : 'bg-green-50/60 hover:bg-green-50'
                       : 'hover:bg-black/5 dark:hover:bg-white/5'
                     }`}
                   style={{
                     gridTemplateColumns: showIncludeInExpenses
                       ? '30px 50px 1fr 1fr 1fr 1fr 2fr 50px 100px 30px'
                       : '30px 1fr 1fr 1fr 1fr 2fr 50px 100px 30px',
                   }}
                 >
                   {/* Row index */}
                   <div className={`text-xs text-center ${labelCol}`}>{i + 1}</div>

                   {/* Include in Expenses — only for credit */}
                   {showIncludeInExpenses && (
                     <div className="flex justify-center">
                       <label className="relative inline-flex items-center cursor-pointer" title={item.includeInExpenses ? 'Remove from expenses' : 'Include in expenses'}>
                         <input
                           type="checkbox"
                           checked={item.includeInExpenses}
                           onChange={(e) => onUpdateLineItem(item.id, { includeInExpenses: e.target.checked })}
                           className="sr-only peer"
                         />
                         <div className={`w-8 h-4 rounded-full peer peer-checked:bg-green-600 ${isDarkMode ? 'bg-stone-700' : 'bg-stone-300'} peer-focus:outline-none relative transition-colors`}>
                           <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${item.includeInExpenses ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </div>
                       </label>
                     </div>
                   )}

                   {/* PO, SI, DR, QI */}
                   {['po_number', 'si_number', 'dr_number', 'qi_number'].map(field => (
                     <input
                       key={field}
                       type="text"
                       value={item[field]}
                       onChange={(e) => onUpdateLineItem(item.id, { [field]: e.target.value })}
                       onPaste={(e) => onPasteLineItem(field, e)}
                       placeholder="-"
                       className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                     />
                   ))}

                   {/* Remark */}
                   <input
                     type="text"
                     value={item.remark}
                     onChange={(e) => onUpdateLineItem(item.id, { remark: e.target.value })}
                     placeholder="Details..."
                     className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                   />

                   {/* With Copy toggle */}
                   <div className="flex justify-center">
                     <label className="relative inline-flex items-center cursor-pointer" title={item.with_copy ? 'Physical copy included' : 'No physical copy'}>
                       <input
                         type="checkbox"
                         checked={item.with_copy}
                         onChange={(e) => onUpdateLineItem(item.id, { with_copy: e.target.checked })}
                         className="sr-only peer"
                       />
                       <div className={`w-8 h-4 rounded-full peer peer-checked:bg-gray-600 ${isDarkMode ? 'bg-stone-700' : 'bg-stone-300'} peer-focus:outline-none relative transition-colors`}>
                         <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${item.with_copy ? 'translate-x-4' : 'translate-x-0'}`}></div>
                       </div>
                     </label>
                   </div>

                   {/* Amount */}
                   <input
                     type="number"
                     value={item.amount || ''}
                     onChange={(e) => onUpdateLineItem(item.id, { amount: e.target.value })}
                     placeholder="0.00"
                     className={`w-full bg-transparent text-right px-1 py-1 rounded text-sm font-mono border border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-emerald-400 placeholder-gray-700' : 'text-emerald-600 placeholder-gray-300'}`}
                   />

                   {/* Delete */}
                   <button
                     onClick={() => onDeleteLineItem(item.id)}
                     className="flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                   >
                     <X size={14} />
                   </button>
                 </div>

                 {/* Mobile layout */}
                 <div className={`sm:hidden px-4 py-3 space-y-2 transition-colors ${
                   item.includeInExpenses && showIncludeInExpenses
                     ? isDarkMode ? 'bg-green-900/10' : 'bg-green-50/60'
                     : ''
                 }`}>
                   <div className="flex items-center justify-between">
                     <span className={`text-xs font-bold ${labelCol}`}>Line {i + 1}</span>
                     <button onClick={() => onDeleteLineItem(item.id)} className="text-red-400 hover:text-red-600">
                       <X size={14} />
                     </button>
                   </div>

                   {/* Mobile Exp Toggle — only for credit */}
                   {showIncludeInExpenses && (
                     <label className="flex items-center gap-2 cursor-pointer">
                       <div className={`w-8 h-4 rounded-full relative transition-colors ${item.includeInExpenses ? 'bg-green-600' : isDarkMode ? 'bg-stone-700' : 'bg-stone-300'}`}>
                         <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${item.includeInExpenses ? 'translate-x-4' : 'translate-x-0'}`}></div>
                       </div>
                       <input type="checkbox" checked={item.includeInExpenses} onChange={(e) => onUpdateLineItem(item.id, { includeInExpenses: e.target.checked })} className="sr-only" />
                       <span className={`text-xs font-semibold ${item.includeInExpenses ? 'text-green-600 dark:text-green-400' : labelCol}`}>
                         {item.includeInExpenses ? 'In Expenses ✓' : 'Not in Expenses'}
                       </span>
                     </label>
                   )}

                   {/* Mobile With Copy Toggle */}
                   <label className="flex items-center gap-2 cursor-pointer">
                     <div className={`w-8 h-4 rounded-full relative transition-colors ${item.with_copy ? 'bg-gray-600' : isDarkMode ? 'bg-stone-700' : 'bg-stone-300'}`}>
                       <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${item.with_copy ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </div>
                     <input type="checkbox" checked={item.with_copy} onChange={(e) => onUpdateLineItem(item.id, { with_copy: e.target.checked })} className="sr-only" />
                     <span className={`text-xs font-semibold ${item.with_copy ? 'text-blue-600 dark:text-blue-400' : labelCol}`}>
                       {item.with_copy ? 'With Copy ✓' : 'No Copy'}
                     </span>
                   </label>

                   {['po_number', 'si_number', 'dr_number', 'qi_number'].map(field => (
                     <div key={field}>
                       <label className="text-[10px] uppercase font-bold text-gray-500 mb-0.5 block">{field.replace('_', ' ')}</label>
                       <input type="text" value={item[field]} onChange={(e) => onUpdateLineItem(item.id, { [field]: e.target.value })}
                         placeholder="-"
                         className={`w-full bg-transparent px-2 py-1 rounded text-sm border ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-700'} outline-none`}
                       />
                     </div>
                   ))}
                   <div>
                     <label className="text-[10px] uppercase font-bold text-gray-500 mb-0.5 block">Remark</label>
                     <input type="text" value={item.remark} onChange={(e) => onUpdateLineItem(item.id, { remark: e.target.value })} placeholder="Details..."
                       className={`w-full bg-transparent px-2 py-1 rounded text-sm border ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-700'} outline-none`}
                     />
                   </div>
                   {/* Amount only at bottom of mobile card (no Status OK) */}
                   <div className="flex justify-end">
                     <div>
                       <label className="text-[10px] uppercase font-bold text-gray-500 block">Amount</label>
                       <input type="number" value={item.amount || ''} onChange={(e) => onUpdateLineItem(item.id, { amount: e.target.value })} placeholder="0.00"
                         className={`w-28 text-right bg-transparent px-2 py-1 rounded text-sm font-mono border ${isDarkMode ? 'border-gray-700 text-emerald-400' : 'border-gray-300 text-emerald-600'} outline-none`}
                       />
                     </div>
                   </div>
                 </div>
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