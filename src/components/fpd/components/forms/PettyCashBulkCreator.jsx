import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Plus, Save, ChevronDown, ChevronRight, 
  Trash2, FileText, MapPin, Hash, DollarSign, 
  Calendar, Briefcase, Building, Upload, Loader2
} from 'lucide-react';
import apiService from '../../../../utils/api/api-service';
import { useAuth } from "../../../../contexts/AuthContext";
import { ToastContainer } from '../main_ui/Toast';
import { useToast } from '../../hooks/useToast';

function proofDocumentsJsonToText(value) {
  if (value == null || value === '') return '';

  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return '';
    }
  }

  if (!Array.isArray(parsed)) return '';

  return parsed
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (!entry || typeof entry !== 'object') return '';
      const label = String(entry.label || entry.name || '').trim();
      const reference = String(entry.reference || entry.url || entry.path || '').trim();
      if (label && reference && label !== reference) return `${label} | ${reference}`;
      return label || reference;
    })
    .filter(Boolean)
    .join('\n');
}

function proofDocumentsTextToJson(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (lines.length === 0) return JSON.stringify([]);

  const docs = lines.map((line, index) => {
    const parts = line.split('|');
    if (parts.length > 1) {
      const label = (parts.shift() || '').trim();
      const reference = parts.join('|').trim();
      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label || `Document ${index + 1}`,
      };
    }
    return {
      label: line,
      reference: line,
    };
  });

  return JSON.stringify(docs);
}

function uploadedProofDocumentToLine(uploaded, fallbackName) {
  const label = String(
    uploaded?.original_name || uploaded?.originalName || fallbackName || 'Document',
  ).trim();
  const reference = String(
    uploaded?.reference || uploaded?.url || uploaded?.path || '',
  ).trim();

  if (!reference) return '';
  if (label && label !== reference) return `${label} | ${reference}`;
  return reference;
}

/**
 * Modern, Card-Based Bulk Creator for Petty Cash Vouchers
 * Eliminates horizontal scrolling by stacking vouchers vertically.
 */
export default function PettyCashBulkCreator({ 
  isOpen, 
  onClose, 
  onSubmit, 
  chartOfAccounts = [], 
  isDarkMode,
  createdBy,
  editMode = false,
  initialData = null,
  initialDraft = null,
  initialDrafts = [],
}) {
  const buildVouchersFromInitialData = (data) => {
    const lineItems = (data.line_items || []).map((item, index) => ({
      id: `line-${Date.now()}-${index}`,
      includeInExpenses: item.include_in_expenses == 1,
      account_id: item.account_id || null,
      company_supplier: item.location || '',
      particulars: item.description || '',
      amount: parseFloat(item.vat_amount || 0) + parseFloat(item.non_vat_amount || 0),
      vat_type: parseFloat(item.vat_amount || 0) > 0 ? 'VAT' : 'Non-VAT',
      reference: item.reference || ''
    }));

    return [{
      id: `voucher-${Date.now()}`,
      voucher_id: data.id,
      voucher_number: data.voucher_number,
      voucher_date: data.voucher_date,
      account_classification: data.account_classification || '',
      company_supplier: (lineItems[0] && lineItems[0].company_supplier) ? lineItems[0].company_supplier : (data.company_supplier || ''),
      lineItems: lineItems.length > 0 ? lineItems : [createEmptyLineItem()],
      proof_documents_text: proofDocumentsJsonToText(data.proof_documents_json),
      expanded: true
    }];
  };

  // --- STATE MANAGEMENT (Preserved exactly as is) ---
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
        return {
          ...createEmptyVoucher(),
          ...draft,
          lineItems: normalizedLineItems,
          proof_documents_text:
            draft.proof_documents_text ??
            proofDocumentsJsonToText(draft.proof_documents_json),
        };
      });
    }
    if (!editMode && initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      return [{
        ...createEmptyVoucher(),
        ...initialDraft,
        lineItems: normalizedLineItems,
        proof_documents_text:
          initialDraft.proof_documents_text ??
          proofDocumentsJsonToText(initialDraft.proof_documents_json),
      }];
    }
    return [createEmptyVoucher()];
  });
  
  const [nextVoucherNumber, setNextVoucherNumber] = useState(null);
  const [voucherSequenceUnavailable, setVoucherSequenceUnavailable] = useState(false);
  const [uploadingProofVoucherId, setUploadingProofVoucherId] = useState(null);
  const modalRef = useRef(null);
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();
  const firstSupplierRefs = useRef({});
  const hydrationSignatureRef = useRef('');
  const VOUCHER_NUMBER_PATTERN = /^PCV-\d{4}-\d{3}$/;

  const setFirstSupplierRef = (voucherId, el) => {
    if (!voucherId) return;
    if (el) firstSupplierRefs.current[voucherId] = el;
    else delete firstSupplierRefs.current[voucherId];
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!editMode && isOpen) fetchNextVoucherNumber();
  }, [editMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      hydrationSignatureRef.current = '';
      return;
    }

    const buildHydrationSignature = () => {
      if (editMode) {
        return `edit:${initialData?.id ?? 'none'}:${initialData?.voucher_number ?? ''}:${initialData?.updated_at ?? ''}`;
      }

      if (Array.isArray(initialDrafts) && initialDrafts.length > 0) {
        const draftSignature = initialDrafts
          .map((draft) => {
            const lineCount = Array.isArray(draft?.lineItems) ? draft.lineItems.length : 0;
            return [
              draft?.voucher_number || '',
              draft?.voucher_date || '',
              draft?.account_classification || '',
              draft?.company_supplier || '',
              lineCount,
            ].join('::');
          })
          .join('|');

        return `drafts:${initialDrafts.length}:${draftSignature}`;
      }

      if (initialDraft) {
        const lineCount = Array.isArray(initialDraft?.lineItems) ? initialDraft.lineItems.length : 0;
        return [
          'draft',
          initialDraft?.voucher_number || '',
          initialDraft?.voucher_date || '',
          initialDraft?.account_classification || '',
          initialDraft?.company_supplier || '',
          lineCount,
        ].join(':');
      }

      return 'empty';
    };

    const nextSignature = buildHydrationSignature();
    if (hydrationSignatureRef.current === nextSignature) {
      return;
    }
    hydrationSignatureRef.current = nextSignature;

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
          return {
            ...createEmptyVoucher(),
            ...draft,
            lineItems: normalizedLineItems,
            proof_documents_text:
              draft.proof_documents_text ??
              proofDocumentsJsonToText(draft.proof_documents_json),
          };
        }),
      );
    } else if (initialDraft) {
      const normalizedLineItems = Array.isArray(initialDraft.lineItems) && initialDraft.lineItems.length > 0
        ? initialDraft.lineItems.map((item) => ({
            ...createEmptyLineItem(),
            ...item,
          }))
        : [createEmptyLineItem()];
      setVouchers([{
        ...createEmptyVoucher(),
        ...initialDraft,
        lineItems: normalizedLineItems,
        proof_documents_text:
          initialDraft.proof_documents_text ??
          proofDocumentsJsonToText(initialDraft.proof_documents_json),
      }]);
    } else {
      setVouchers([createEmptyVoucher()]);
    }
  }, [isOpen, editMode, initialData?.id, initialData?.voucher_number, initialData?.updated_at, initialDraft, initialDrafts]);

  // Auto-focus the first line-item supplier when modal opens or vouchers change
  useEffect(() => {
    if (!isOpen) return;
    // small delay to ensure DOM refs are attached
    const t = setTimeout(() => {
      const firstId = vouchers[0]?.id;
      const el = firstSupplierRefs.current[firstId];
      if (el && typeof el.focus === 'function') el.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, vouchers.length]);

  const fetchNextVoucherNumber = async () => {
    try {
      const response = await apiService.finance.request('/api/finance-payroll/petty-cash-vouchers?action=next-voucher-number');
      const sequence = response.voucher_number || response.data?.voucher_number || null;
      if (sequence && VOUCHER_NUMBER_PATTERN.test(sequence)) {
        setNextVoucherNumber(sequence);
        setVoucherSequenceUnavailable(false);
        return;
      }
      throw new Error('Invalid voucher sequence from server');
    } catch (error) {
      console.error('Failed to fetch next voucher number:', error);
      setNextVoucherNumber(null);
      setVoucherSequenceUnavailable(true);
    }
  };

  function createEmptyVoucher() {
    return {
      id: `voucher-${Date.now()}-${Math.random()}`,
      voucher_date: new Date().toISOString().split('T')[0],
      account_classification: '',
      company_supplier: '',
      lineItems: [createEmptyLineItem()],
      proof_documents_text: '',
      expanded: true
    };
  }

  function createEmptyLineItem() {
    return {
      id: `line-${Date.now()}-${Math.random()}`,
      includeInExpenses: false,
      account_id: null,
      company_supplier: '',
      particulars: '',
      amount: 0,
      vat_type: 'Non-VAT',
      reference: ''
    };
  }

  // --- HANDLERS (Preserved) ---
  const handleAddVouchers = (count) => {
    const newVouchers = Array.from({ length: count }, () => createEmptyVoucher());
    setVouchers(prev => {
      const merged = [...prev, ...newVouchers];
      // focus first supplier of the first new voucher after render
      setTimeout(() => {
        const id = newVouchers[0]?.id;
        const el = firstSupplierRefs.current[id];
        if (el && typeof el.focus === 'function') el.focus();
      }, 50);
      return merged;
    });
  };

  const handleDeleteVoucher = (voucherId) => {
    if (vouchers.length === 1) {
      showWarning?.('Cannot delete the last voucher');
      return;
    }
    setVouchers(vouchers.filter(v => v.id !== voucherId));
  };

  const handleUpdateVoucher = (voucherId, updates) => {
    setVouchers(vouchers.map(v => v.id === voucherId ? { ...v, ...updates } : v));
  };

  const handleProofUpload = async (voucherId, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setUploadingProofVoucherId(voucherId);
    try {
      const uploadedLines = [];

      for (const file of files) {
        const response = await apiService.finance.uploadProofDocument(file, {
          module: 'petty_cash',
        });
        const uploaded = response?.uploaded || response?.data?.uploaded || null;
        const line = uploadedProofDocumentToLine(uploaded, file.name);
        if (line) uploadedLines.push(line);
      }

      if (!uploadedLines.length) return;

      setVouchers((prev) =>
        prev.map((voucher) => {
          if (voucher.id !== voucherId) return voucher;
          const existing = String(voucher.proof_documents_text || '').trim();
          const nextText = existing
            ? `${existing}\n${uploadedLines.join('\n')}`
            : uploadedLines.join('\n');
          return { ...voucher, proof_documents_text: nextText };
        }),
      );
    } catch (error) {
      console.error('Failed to upload proof document:', error);
      showError?.('Failed to upload proof document: ' + (error.message || 'Unknown error'));
    } finally {
      setUploadingProofVoucherId(null);
    }
  };

  const toggleExpanded = (voucherId) => {
    setVouchers(vouchers.map(v => v.id === voucherId ? { ...v, expanded: !v.expanded } : v));
  };

  const handleAddLineItem = (voucherId) => {
    setVouchers(vouchers.map(v => {
      if (v.id !== voucherId) return v;
      const newLineItems = [...v.lineItems, createEmptyLineItem()];
      const firstSupplier = (newLineItems[0] && newLineItems[0].company_supplier) ? newLineItems[0].company_supplier : '';
      return { ...v, lineItems: newLineItems, company_supplier: firstSupplier };
    }));
  };

  const handleUpdateLineItem = (voucherId, lineItemId, updates) => {
    setVouchers(vouchers.map(v => {
      if (v.id !== voucherId) return v;
      const newLineItems = v.lineItems.map(li => li.id === lineItemId ? { ...li, ...updates } : li);
      const firstSupplier = (newLineItems[0] && newLineItems[0].company_supplier) ? newLineItems[0].company_supplier : '';
      return { ...v, lineItems: newLineItems, company_supplier: firstSupplier };
    }));
  };

  const handleDeleteLineItem = (voucherId, lineItemId) => {
    setVouchers(vouchers.map(v => {
      if (v.id !== voucherId) return v;
      let newLineItems = v.lineItems.filter(li => li.id !== lineItemId);
      if (newLineItems.length === 0) newLineItems = [createEmptyLineItem()];
      const firstSupplier = (newLineItems[0] && newLineItems[0].company_supplier) ? newLineItems[0].company_supplier : '';
      return { ...v, lineItems: newLineItems, company_supplier: firstSupplier };
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
        const newLineItems = lines.map((line) => ({ ...createEmptyLineItem(), [field]: line.trim().toUpperCase() }));
        const combined = [...currentLineItems, ...newLineItems];
        const firstSupplier = (combined[0] && combined[0].company_supplier) ? combined[0].company_supplier : '';
        return { ...v, lineItems: combined, company_supplier: firstSupplier };
      }));
    }
  };

  const getVoucherNumberPreview = (index) => {
    if (editMode) return vouchers[0]?.voucher_number || 'N/A';
    if (!nextVoucherNumber) return voucherSequenceUnavailable ? 'UNAVAILABLE' : '...';
    
    const match = nextVoucherNumber.match(/^(PCV-\d{4}-)(\d{3})$/);
    if (match) {
      const prefix = match[1];
      const baseNumber = parseInt(match[2]);
      const newNumber = baseNumber + index;
      return `${prefix}${String(newNumber).padStart(3, '0')}`;
    }
    
    return voucherSequenceUnavailable ? 'UNAVAILABLE' : nextVoucherNumber;
  };

  const isVoucherSequenceReady = editMode || (nextVoucherNumber && VOUCHER_NUMBER_PATTERN.test(nextVoucherNumber));

  const calculateTotals = () => {
    let totalVAT = 0;
    let totalNonVAT = 0;
    vouchers.forEach(voucher => {
      voucher.lineItems.forEach(item => {
        const amount = parseFloat(item.amount) || 0;
        if (item.vat_type === 'VAT') totalVAT += amount;
        else totalNonVAT += amount;
      });
    });
    return { totalVAT, totalNonVAT, grandTotal: totalVAT + totalNonVAT };
  };

  const handleSaveAll = async () => {
    try {
      if (!editMode && !isVoucherSequenceReady) {
        showError?.('Voucher number sequence is unavailable. Please retry fetching and save again.');
        return;
      }

        for (const voucher of vouchers) {
            if (!voucher.voucher_date) { showWarning?.('Please fill in the date for all vouchers'); return; }
            if (!voucher.account_classification) { showWarning?.('Please select particulars for all vouchers'); return; }
            const hasAmount = voucher.lineItems.some(item => parseFloat(item.amount) > 0);
            if (!hasAmount) { showWarning?.('Each voucher must have at least one line item with an amount'); return; }
          const firstSupplier = (voucher.lineItems && voucher.lineItems[0] && (voucher.lineItems[0].company_supplier || '').trim()) || '';
          if (!firstSupplier) { showWarning?.('Please fill the Company/Supplier on the FIRST line item for all vouchers'); return; }
        }

        for (const voucher of vouchers) {
            let amount_vat = 0;
            let amount_non_vat = 0;
            let voucherAccountId = null;
            if (voucher.account_classification) {
                const account = chartOfAccounts.find(acc => acc.account_name === voucher.account_classification);
                voucherAccountId = account ? account.id : null;
            }
            
            const validLineItems = voucher.lineItems
                .filter(item => parseFloat(item.amount) > 0)
                .map(item => {
                const amount = parseFloat(item.amount);
                // Preserve the user's selection: if VAT type is 'VAT' keep amount in vat_amount,
                // if 'Non-VAT' keep it in non_vat_amount. Do not pre-calculate splits.
                if (item.vat_type === 'VAT') amount_vat += amount;
                else amount_non_vat += amount;

                return {
                  account_id: item.account_id || voucherAccountId,
                  location: item.company_supplier || voucher.company_supplier || null,
                  description: item.particulars || null,
                  reference: item.reference || null,
                  vat_amount: item.vat_type === 'VAT' ? amount : 0,
                  non_vat_amount: item.vat_type === 'Non-VAT' ? amount : 0,
                  include_in_expenses: item.includeInExpenses ? 1 : 0
                };
            });

            const voucherData = {
                voucher_date: voucher.voucher_date,
                account_classification: voucher.account_classification,
                company_supplier: voucher.company_supplier || null,
                amount_vat,
                amount_non_vat,
                proof_documents_json: proofDocumentsTextToJson(voucher.proof_documents_text),
              ...(editMode ? {} : { status: 'draft' }),
                created_by: createdBy,
                line_items: validLineItems
            };

            await onSubmit(voucherData);
        }

        const message = editMode ? 'Voucher updated successfully!' : `Successfully created ${vouchers.length} voucher(s)!`;
        showSuccess?.(message);
        onClose();
    } catch (error) {
        console.error('Failed to save vouchers:', error);
        showError?.('Failed to save vouchers: ' + (error.message || 'Unknown error'));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div 
        ref={modalRef}
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase}`}
      >
        {/* --- HEADER --- */}
        <div className={`sticky top-0 z-20 px-6 py-4 border-b ${borderCol} ${bgCard} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
               <FileText className="w-5 h-5 text-purple-500" />
               {editMode ? 'Edit Petty Cash Voucher' : 'Bulk Create Petty Cash'}
            </h2>
            <div className={`mt-1 flex items-center gap-4 text-xs ${textSecondary}`}>
              <span>Rows: <strong className={textPrimary}>{vouchers.length}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span>VAT: <strong className="text-green-500">₱{totals.totalVAT.toLocaleString()}</strong></span>
              <span>Non-VAT: <strong className="text-blue-500">₱{totals.totalNonVAT.toLocaleString()}</strong></span>
              <span className="hidden sm:inline">|</span>
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">Total: <strong>₱{totals.grandTotal.toLocaleString()}</strong></span>
            </div>
            {!editMode && voucherSequenceUnavailable && (
              <div className={`mt-2 text-xs font-medium ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                Voucher number sequence unavailable. Save is disabled until sequence is fetched.
                <button
                  type="button"
                  onClick={fetchNextVoucherNumber}
                  className={`ml-2 underline ${isDarkMode ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-800'}`}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleSaveAll}
              disabled={!isVoucherSequenceReady}
              className="flex-1 sm:flex-none px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400/60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} /> {editMode ? 'Update' : 'Save All'}
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
              voucherNumber={getVoucherNumberPreview(index)}
              chartOfAccounts={chartOfAccounts}
              editMode={editMode}
              isDarkMode={isDarkMode}
              onUpdate={(u) => handleUpdateVoucher(voucher.id, u)}
              onDelete={() => handleDeleteVoucher(voucher.id)}
              onToggleExpanded={() => toggleExpanded(voucher.id)}
              onAddLineItem={() => handleAddLineItem(voucher.id)}
              onUpdateLineItem={(lid, u) => handleUpdateLineItem(voucher.id, lid, u)}
              onDeleteLineItem={(lid) => handleDeleteLineItem(voucher.id, lid)}
              onPasteLineItem={(f, e) => handlePasteLineItem(voucher.id, f, e)}
              onUploadProof={(e) => handleProofUpload(voucher.id, e)}
              uploadingProof={uploadingProofVoucherId === voucher.id}
              firstSupplierRef={setFirstSupplierRef}
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
  );
}

/**
 * Individual Petty Cash Card
 */
function VoucherCard({
  voucher,
  index,
  voucherNumber,
  chartOfAccounts,
  editMode,
  onUpdate,
  onDelete,
  onToggleExpanded,
  onAddLineItem,
  onDeleteLineItem,
  onUpdateLineItem,
  onPasteLineItem,
  onUploadProof,
  uploadingProof,
  firstSupplierRef,
  isDarkMode: propIsDarkMode,
  createdBy
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  // Register/cleanup first-supplier ref with parent
  useEffect(() => {
    return () => {
      if (firstSupplierRef) firstSupplierRef(voucher.id, null);
    };
  }, [voucher.id, firstSupplierRef]);
  // Calculations
  const voucherVAT = voucher.lineItems.filter(item => item.vat_type === 'VAT').reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const voucherNonVAT = voucher.lineItems.filter(item => item.vat_type === 'Non-VAT').reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const voucherTotal = voucherVAT + voucherNonVAT;

  // Theme Helpers
  const cardBg = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-stone-950 border-gray-700 focus:border-purple-500 text-white' : 'bg-white border-gray-300 focus:border-purple-500 text-gray-900';
  const labelCol = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`rounded-xl border shadow-sm transition-all duration-200 ${cardBg} ${borderCol}`}>
        {/* --- CARD HEADER --- */}
        <div className="p-4">
             {/* Top Row: Title + Stats */}
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={onToggleExpanded} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                    {voucher.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="flex flex-col leading-tight">
                    <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${isDarkMode ? 'bg-stone-800 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                      {voucherNumber}
                    </span>
                    <span className={`text-xs opacity-80 truncate max-w-[240px] ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {voucher.company_supplier || 'Untitled Supplier'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                        <p className={`text-[10px] uppercase font-bold tracking-wider ${labelCol}`}>Total Amount</p>
                        <p className="text-lg font-bold font-mono text-purple-500">₱{voucherTotal.toLocaleString()}</p>
                    </div>
                    {!editMode && (
                        <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Header Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                 {/* Date */}
                <div className="md:col-span-3">
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

                {/* Particulars (Chart of Accounts) */}
                <div className="md:col-span-7">
                    <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Particulars / Classification</label>
                    <div className="relative">
                        <Briefcase size={14} className={`absolute left-2.5 top-2.5 ${labelCol}`} />
                        <select
                            value={voucher.account_classification}
                            onChange={(e) => onUpdate({ account_classification: e.target.value })}
                            className={`w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all appearance-none ${inputBg}`}
                        >
                            <option value="">Select Particulars...</option>
                            {chartOfAccounts
                                .filter(account => account.is_active !== false && account.status === 'active')
                                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                .map(account => (
                                <option key={account.id} value={account.account_name}>
                                    {account.account_name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className={`absolute right-3 top-3 pointer-events-none ${labelCol}`} />
                    </div>
                </div>

                    <div className="md:col-span-10">
                      <label className={`block text-xs font-medium mb-1 ${labelCol}`}>Proof Documents (one per line)</label>
                      <textarea
                        rows={2}
                        value={voucher.proof_documents_text || ''}
                        onChange={(e) => onUpdate({ proof_documents_text: e.target.value })}
                        placeholder="Receipt #12345 | https://..."
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition-all resize-y ${inputBg}`}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <label
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                            isDarkMode
                              ? 'bg-stone-900 border-gray-700 text-gray-200 hover:bg-stone-800'
                              : 'bg-stone-50 border-gray-300 text-gray-700 hover:bg-stone-100'
                          } ${uploadingProof ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {uploadingProof ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Upload size={12} />
                          )}
                          {uploadingProof ? 'Uploading...' : 'Attach Files'}
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={uploadingProof}
                            onChange={onUploadProof}
                          />
                        </label>
                        <span className="text-[11px] text-gray-500">
                          Upload adds link entries automatically.
                        </span>
                      </div>
                    </div>

                {/* Company/Supplier input hidden — voucher shows representative at top */}
            </div>
        </div>

        {/* --- BODY (Line Items) --- */}
        {voucher.expanded && (
             <div className={`border-t ${borderCol}`}>
                {/* Desktop Table Header */}
                <div className={`hidden sm:grid grid-cols-[40px_50px_1.5fr_2fr_120px_100px_120px_30px] gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70 ${isDarkMode ? 'bg-stone-800/50' : 'bg-stone-50'}`}>
                    <div className="text-center">#</div>
                    <div className="text-center" title="Include in Expenses">Exp</div>
                    <div>Company/Supplier</div> {/* Renamed from Location */}
                    <div>Particulars</div> {/* Renamed from Description */}
                    <div>Reference</div>
                    <div>VAT Type</div>
                    <div className="text-right">Amount</div>
                    <div></div>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {voucher.lineItems.map((item, i) => (
                         <div key={item.id} className="group relative grid grid-cols-1 sm:grid-cols-[40px_50px_1.5fr_2fr_120px_100px_120px_30px] gap-2 px-4 py-3 items-start hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            {/* Mobile Index */}
                            <div className={`text-xs text-center pt-2 ${labelCol} sm:block hidden`}>{i + 1}</div>
                            
                            {/* Expense Toggle */}
                            <div className="flex justify-center pt-1.5">
                                <label className="relative inline-flex items-center cursor-pointer">
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

                            {/* Company/Supplier */}
                            <div className="w-full">
                                <label className="sm:hidden text-[10px] uppercase font-bold text-gray-500 mb-1 block">Company/Supplier</label> {/* Renamed from Location */}
                                <div className="relative">
                                    <MapPin size={12} className={`absolute left-2 top-2.5 ${labelCol} sm:hidden`} />
                                    <input 
                                      type="text" 
                                      value={item.company_supplier}  // Updated key
                                      ref={(el) => { if (i === 0 && firstSupplierRef) firstSupplierRef(voucher.id, el); }}
                                      onChange={(e) => onUpdateLineItem(item.id, { company_supplier: e.target.value.toUpperCase() })} // Updated key
                                      onPaste={(e) => onPasteLineItem('company_supplier', e)} // Updated key
                                      placeholder={i === 0 ? "Company/Supplier (required)" : "Company/Supplier"} // Mark first as required
                                      className={`w-full bg-transparent px-1 sm:pl-1 pl-6 py-1 rounded text-sm border border-transparent focus:border-purple-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all uppercase ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'} ${i === 0 ? 'ring-2 ring-purple-500/40 dark:ring-purple-400/30 bg-purple-50 dark:bg-purple-900/10' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* Particulars */}
                            <div className="w-full">
                                <label className="sm:hidden text-[10px] uppercase font-bold text-gray-500 mb-1 block">Particulars</label> {/* Renamed from Description */}
                                <input 
                                    type="text" 
                                    value={item.particulars}  // Updated key
                                    onChange={(e) => onUpdateLineItem(item.id, { particulars: e.target.value.toUpperCase() })} // Updated key
                                    onPaste={(e) => onPasteLineItem('particulars', e)} // Updated key
                                    placeholder="Particulars" // Updated placeholder
                                    className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-purple-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all uppercase ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                                />
                            </div>

                            {/* Reference */}
                            <div className="w-full">
                                <label className="sm:hidden text-[10px] uppercase font-bold text-gray-500 mb-1 block">Reference</label>
                                <div className="relative">
                                    <Hash size={12} className={`absolute left-2 top-2.5 ${labelCol} sm:hidden`} />
                                    <input 
                                        type="text" 
                                        value={item.reference} 
                                        onChange={(e) => onUpdateLineItem(item.id, { reference: e.target.value.toUpperCase() })}
                                        onPaste={(e) => onPasteLineItem('reference', e)}
                                        placeholder="OR/Ref"
                                        className={`w-full bg-transparent px-1 sm:pl-1 pl-6 py-1 rounded text-sm border border-transparent focus:border-purple-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all uppercase ${isDarkMode ? 'text-gray-300 placeholder-gray-700' : 'text-gray-700 placeholder-gray-300'}`}
                                    />
                                </div>
                            </div>

                            {/* VAT Type */}
                            <div className="w-full">
                                <label className="sm:hidden text-[10px] uppercase font-bold text-gray-500 mb-1 block">VAT</label>
                                <select
                                    value={item.vat_type}
                                    onChange={(e) => onUpdateLineItem(item.id, { vat_type: e.target.value })}
                                    className={`w-full bg-transparent px-1 py-1 rounded text-sm border border-transparent focus:border-purple-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                                >
                                    <option value="Non-VAT">Non-VAT</option>
                                    <option value="VAT">VAT</option>
                                </select>
                            </div>

                            {/* Amount */}
                            <div className="w-full">
                                <label className="sm:hidden text-[10px] uppercase font-bold text-gray-500 mb-1 block">Amount</label>
                                <div className="relative">
                                    <DollarSign size={12} className={`absolute left-2 top-2.5 ${labelCol} sm:hidden`} />
                                    <input 
                                        type="number" 
                                        value={item.amount || ''} 
                                        onChange={(e) => onUpdateLineItem(item.id, { amount: e.target.value })}
                                        placeholder="0.00"
                                        step="0.01"
                                        className={`w-full bg-transparent text-left sm:text-right px-1 sm:pl-1 pl-6 py-1 rounded text-sm font-mono border border-transparent focus:border-purple-500 hover:border-gray-300 dark:hover:border-gray-600 outline-none transition-all ${isDarkMode ? 'text-emerald-400 placeholder-gray-700' : 'text-emerald-600 placeholder-gray-300'}`}
                                    />
                                </div>
                            </div>

                            {/* Delete Button */}
                            <button 
                                onClick={() => onDeleteLineItem(item.id)}
                                className="absolute top-2 right-2 sm:static flex items-center justify-center pt-1.5 text-gray-400 hover:text-red-500 transition-colors sm:opacity-0 group-hover:opacity-100"
                            >
                                <X size={14} />
                            </button>
                         </div>
                    ))}
                </div>

                <div className={`px-4 py-3 ${isDarkMode ? 'bg-stone-800/30' : 'bg-stone-50'}`}>
                    <button 
                        onClick={onAddLineItem}
                        className={`text-xs font-semibold flex items-center gap-1 transition-colors ${isDarkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
                    >
                        <Plus size={14} /> Add Line Item
                    </button>
                </div>
             </div>
        )}
    </div>
  );
}
