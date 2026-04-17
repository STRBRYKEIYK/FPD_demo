import React from 'react';
import { useAuth } from '../../../../contexts/AuthContext'
import { TrendingDown, TrendingUp, Wallet, CreditCard } from 'lucide-react';

/**
 * TransactionTypeSelector - Component for selecting Debit or Credit transaction type
 * 
 * @param {Object} props
 * @param {string} props.value - Current selected value ('debit' or 'credit')
 * @param {Function} props.onChange - Callback when selection changes
 * @param {boolean} props.isDarkMode - Dark mode flag
 * @param {string} props.voucherType - Type of voucher ('cash' or 'check')
 */
export default function TransactionTypeSelector({
  value,
  onChange,
  isDarkMode: propIsDarkMode = false,
  voucherType = 'cash'
}) {
  const { isDarkMode: authIsDarkMode } = useAuth()
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode
  const options = [
    {
      value: 'debit',
      label: 'Debit',
      subtitle: 'Money going out (expense/payment)',
      icon: TrendingDown,
      color: 'red',
      bgLight: 'bg-red-50',
      bgDark: 'bg-red-900/10',
      borderLight: 'border-red-200',
      borderDark: 'border-red-800',
      textLight: 'text-red-700',
      textDark: 'text-red-400',
      selectedBgLight: 'bg-red-100',
      selectedBgDark: 'bg-red-900/30',
      selectedBorderLight: 'border-red-500',
      selectedBorderDark: 'border-red-600',
      hoverBgLight: 'hover:bg-red-50',
      hoverBgDark: 'hover:bg-red-900/20'
    },
    {
      value: 'credit',
      label: 'Credit',
      subtitle: 'Money coming in (receipt/income)',
      icon: TrendingUp,
      color: 'green',
      bgLight: 'bg-green-50',
      bgDark: 'bg-green-900/10',
      borderLight: 'border-green-200',
      borderDark: 'border-green-800',
      textLight: 'text-green-700',
      textDark: 'text-green-400',
      selectedBgLight: 'bg-green-100',
      selectedBgDark: 'bg-green-900/30',
      selectedBorderLight: 'border-green-500',
      selectedBorderDark: 'border-green-600',
      hoverBgLight: 'hover:bg-green-50',
      hoverBgDark: 'hover:bg-green-900/20'
    }
  ];

  const getVoucherIcon = () => {
    return voucherType === 'cash' ? Wallet : CreditCard;
  };

  const VoucherIcon = getVoucherIcon();

  return (
    <div className="space-y-4">
      <div className={`text-center space-y-2 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
          isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <VoucherIcon size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
          <span className={`font-semibold text-sm uppercase tracking-wider ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Select Transaction Type
          </span>
        </div>
        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Choose whether this voucher represents money going out (Debit) or coming in (Credit)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`
                relative p-6 rounded-2xl border-2 transition-all duration-200
                ${isSelected
                  ? isDarkMode
                    ? `${option.selectedBgDark} ${option.selectedBorderDark}`
                    : `${option.selectedBgLight} ${option.selectedBorderLight}`
                  : isDarkMode
                    ? `${option.bgDark} ${option.borderDark} ${option.hoverBgDark}`
                    : `${option.bgLight} ${option.borderLight} ${option.hoverBgLight}`
                }
                ${isSelected ? 'ring-4' : ''}
                ${isSelected && isDarkMode ? 'ring-gray-800' : ''}
                ${isSelected && !isDarkMode ? `ring-${option.color}-100` : ''}
                hover:scale-105 hover:shadow-lg
                focus:outline-none focus:ring-4 
                ${isDarkMode ? 'focus:ring-gray-700' : 'focus:ring-gray-300'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${
                  isDarkMode ? option.selectedBgDark : option.selectedBgLight
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    isDarkMode ? 'bg-gradient-to-br from-white to-gray-200' : `bg-gradient-to-br from-${option.color}-600 to-${option.color}-700`
                  }`} />
                </div>
              )}

              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
                isDarkMode ? option.selectedBgDark : option.selectedBgLight
              }`}>
                <Icon 
                  size={32} 
                  className={isDarkMode ? option.textDark : option.textLight}
                  strokeWidth={2.5}
                />
              </div>

              {/* Label */}
              <div className="space-y-1">
                <h3 className={`text-xl font-bold tracking-tight ${
                  isDarkMode ? option.textDark : option.textLight
                }`}>
                  {option.label}
                </h3>
                <p className={`text-xs leading-relaxed ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {option.subtitle}
                </p>
              </div>

              {/* Decorative Background Pattern */}
              <div className="absolute bottom-0 right-0 w-24 h-24 opacity-5 pointer-events-none">
                <Icon size={96} className="transform translate-x-8 translate-y-8" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation Note */}
      {value && (
        <div className={`mt-4 p-4 rounded-xl border ${
          isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className="font-semibold">
              {value === 'debit' ? 'Debit Transaction:' : 'Credit Transaction:'}
            </span>{' '}
            {value === 'debit' 
              ? 'Use this for payments, expenses, or any cash/check going out of the company.'
              : 'Use this for receipts, refunds, or any cash/check coming into the company.'
            }
          </p>
        </div>
      )}
    </div>
  );
}
