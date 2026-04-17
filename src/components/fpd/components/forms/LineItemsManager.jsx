import React, { useState, useEffect } from 'react';
import { useAuth } from "../../../../contexts/AuthContext";
import { Plus, Trash2, X } from 'lucide-react';

/**
 * LineItemsManager - Universal component for managing voucher line items
 * Supports: Cash Vouchers, Check Vouchers, Petty Cash Vouchers
 * 
 * Features:
 * - Petty Cash: VAT/Non-VAT per line, shows VAT/Non-VAT/Total summaries
 * - Cash/Check: Debit/Credit per line, shows Debit/Credit totals
 * - Check: Optional discount (% or amount)
 */
export default function LineItemsManager({
  voucherType = 'cash', // 'cash' | 'check' | 'petty_cash'
  lineItems = [],
  onChange,
  transactionType = null, // For cash/check: 'debit' or 'credit'
  isDarkMode: propIsDarkMode = false,
  showDiscount = false, // Only for check vouchers
  discount = { type: 'none', value: 0 }, // { type: 'percent' | 'amount' | 'none', value: number }
  onDiscountChange = null
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const [items, setItems] = useState(lineItems);

  useEffect(() => {
    setItems(lineItems);
  }, [lineItems]);

  const addLineItem = () => {
    const newItem = {
      id: Date.now(),
      description: '',
      amount: 0,
      ...(voucherType === 'petty_cash' 
        ? { vat_type: 'non_vatable', reference: '' }
        : { type: transactionType || 'debit', reference: '' }
      )
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    onChange(updatedItems);
  };

  const removeLineItem = (id) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    onChange(updatedItems);
  };

  const updateLineItem = (id, field, value) => {
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setItems(updatedItems);
    onChange(updatedItems);
  };

  // Calculate totals
  const calculateTotals = () => {
    if (voucherType === 'petty_cash') {
      const vatTotal = items
        .filter(item => item.vat_type === 'vatable')
        .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      const nonVatTotal = items
        .filter(item => item.vat_type === 'non_vatable')
        .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      return {
        vatTotal,
        nonVatTotal,
        grandTotal: vatTotal + nonVatTotal
      };
    } else {
      // Cash/Check vouchers
      const debitTotal = items
        .filter(item => item.type === 'debit')
        .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      const creditTotal = items
        .filter(item => item.type === 'credit')
        .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      let subtotal = transactionType === 'debit' ? debitTotal : creditTotal;
      let discountAmount = 0;

      if (showDiscount && discount.type !== 'none' && discount.value > 0) {
        if (discount.type === 'percent') {
          discountAmount = (subtotal * parseFloat(discount.value || 0)) / 100;
        } else {
          discountAmount = parseFloat(discount.value || 0);
        }
      }

      const finalTotal = Math.max(0, subtotal - discountAmount);

      return {
        debitTotal,
        creditTotal,
        subtotal,
        discountAmount,
        finalTotal
      };
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Line Items {items.length > 0 && `(${items.length})`}
          </h3>
          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            {voucherType === 'petty_cash' 
              ? 'Add itemized expenses with VAT/Non-VAT classification'
              : 'Add itemized transactions with reference numbers'}
          </p>
        </div>
        <button
          type="button"
          onClick={addLineItem}
          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <Plus size={14} />
          Add Line Item
        </button>
      </div>

      {/* Line Items List */}
      {items.length === 0 ? (
        <div className={`p-8 text-center border-2 border-dashed rounded-lg ${
          isDarkMode ? 'border-gray-700 bg-stone-800/50' : 'border-gray-300 bg-stone-50'
        }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No line items yet. Click "Add Line Item" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border ${
                isDarkMode 
                  ? 'bg-stone-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Item Number */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  isDarkMode ? 'bg-gray-900/30 text-blue-400' : 'bg-gray-100 text-blue-700'
                }`}>
                  {index + 1}
                </div>

                {/* Item Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Description */}
                  <div className="md:col-span-5">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Description *
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Item description"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDarkMode
                          ? 'bg-stone-700 border-gray-600 text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div className="md:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      className={`w-full px-3 py-2 text-sm rounded-lg border font-mono focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDarkMode
                          ? 'bg-stone-700 border-gray-600 text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                      required
                    />
                  </div>

                  {/* VAT Type (Petty Cash) or Transaction Type (Cash/Check) */}
                  <div className="md:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {voucherType === 'petty_cash' ? 'VAT Type' : 'Type'}
                    </label>
                    {voucherType === 'petty_cash' ? (
                      <select
                        value={item.vat_type}
                        onChange={(e) => updateLineItem(item.id, 'vat_type', e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                          isDarkMode
                            ? 'bg-stone-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="vatable">VAT</option>
                        <option value="non_vatable">Non-VAT</option>
                      </select>
                    ) : (
                      <select
                        value={item.type}
                        onChange={(e) => updateLineItem(item.id, 'type', e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                          isDarkMode
                            ? 'bg-stone-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    )}
                  </div>

                  {/* Reference */}
                  <div className="md:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Reference
                    </label>
                    <input
                      type="text"
                      value={item.reference}
                      onChange={(e) => updateLineItem(item.id, 'reference', e.target.value)}
                      placeholder="P.O./S.I."
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDarkMode
                          ? 'bg-stone-700 border-gray-600 text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-red-400 hover:bg-red-900/30'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discount Section (Check Vouchers Only) */}
      {showDiscount && voucherType === 'check' && items.length > 0 && (
        <div className={`p-4 rounded-lg border ${
          isDarkMode ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200'
        }`}>
          <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
            Discount (Optional)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Discount Type
              </label>
              <select
                value={discount.type}
                onChange={(e) => onDiscountChange({ ...discount, type: e.target.value, value: e.target.value === 'none' ? 0 : discount.value })}
                className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none ${
                  isDarkMode
                    ? 'bg-stone-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="none">No Discount</option>
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed Amount (₱)</option>
              </select>
            </div>
            {discount.type !== 'none' && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {discount.type === 'percent' ? 'Percentage' : 'Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={discount.type === 'percent' ? '100' : undefined}
                  value={discount.value}
                  onChange={(e) => onDiscountChange({ ...discount, value: parseFloat(e.target.value) || 0 })}
                  placeholder={discount.type === 'percent' ? '0.00' : '0.00'}
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-mono focus:ring-2 focus:ring-orange-500 outline-none ${
                    isDarkMode
                      ? 'bg-stone-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            )}
            {discount.type !== 'none' && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Discount Value
                </label>
                <div className={`px-3 py-2 text-sm rounded-lg border font-mono ${
                  isDarkMode
                    ? 'bg-stone-800 border-gray-700 text-orange-300'
                    : 'bg-orange-100 border-orange-300 text-orange-800'
                }`}>
                  ₱{totals.discountAmount?.toFixed(2) || '0.00'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Totals Summary */}
      {items.length > 0 && (
        <div className={`p-4 rounded-lg border-2 ${
          isDarkMode 
            ? 'bg-green-900/20 border-green-700' 
            : 'bg-green-50 border-green-200'
        }`}>
          <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
            Summary
          </h4>
          
          {voucherType === 'petty_cash' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total VAT
                </p>
                <p className={`text-lg font-mono font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                  ₱{totals.vatTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Non-VAT
                </p>
                <p className={`text-lg font-mono font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                  ₱{totals.nonVatTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Grand Total
                </p>
                <p className={`text-xl font-mono font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                  ₱{totals.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Debit
                  </p>
                  <p className={`text-lg font-mono font-bold ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                    ₱{totals.debitTotal.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Credit
                  </p>
                  <p className={`text-lg font-mono font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                    ₱{totals.creditTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              
              {showDiscount && voucherType === 'check' && (
                <>
                  {discount.type !== 'none' && (
                    <div className="pt-2 border-t border-green-300 dark:border-green-700">
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Subtotal
                        </p>
                        <p className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          ₱{totals.subtotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <p className={`text-xs font-semibold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                          Discount ({discount.type === 'percent' ? `${discount.value}%` : '₱'})
                        </p>
                        <p className={`text-sm font-mono ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                          -₱{totals.discountAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-green-400 dark:border-green-600">
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Final Total
                        </p>
                        <p className={`text-xl font-mono font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                          ₱{totals.finalTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
