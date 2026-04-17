import React, { useState, useRef } from 'react';
import { useAuth } from '../../../../contexts/AuthContext'
import { X, Plus } from 'lucide-react';

/**
 * TagInput Component - For entering multiple values (PO numbers, SI numbers, etc.)
 * 
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} props.placeholder - Input placeholder
 * @param {Array<string>} props.values - Current tag values
 * @param {Function} props.onChange - Callback when values change
 * @param {boolean} props.isDarkMode - Dark mode flag
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {React.Component} props.icon - Optional icon component
 * @param {string} props.helperText - Optional helper text
 */
export default function TagInput({
  label,
  placeholder = "Type and press Enter to add",
  values = [],
  onChange,
  isDarkMode: propIsDarkMode = false,
  disabled = false,
  icon: Icon = null,
  helperText = null
}) {
  const { isDarkMode: authIsDarkMode } = useAuth()
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      // Remove last tag when backspace on empty input
      removeTag(values.length - 1);
    }
  };

  const addTag = (value) => {
    if (!value) return;
    
    // Prevent duplicates
    if (values.includes(value)) {
      setInputValue('');
      return;
    }

    onChange([...values, value]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const removeTag = (index) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Split by common delimiters (comma, semicolon, newline)
    const newValues = pastedText
      .split(/[,;\n]+/)
      .map(v => v.trim())
      .filter(v => v && !values.includes(v));
    
    if (newValues.length > 0) {
      onChange([...values, ...newValues]);
    }
    setInputValue('');
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
          isDarkMode ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {Icon && <Icon size={12} />}
          {label}
        </label>
      )}

      {/* Tag Container */}
      <div
        className={`min-h-[42px] p-2 rounded-xl border-2 transition-all ${
          disabled
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed'
            : isDarkMode
              ? 'bg-gray-800 border-gray-700 hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-900/50'
              : 'bg-white border-gray-200 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2">
          {/* Render Tags */}
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode
                  ? 'bg-blue-900/30 text-blue-300 border border-blue-800'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span>{value}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(index);
                  }}
                  className={`p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors`}
                  aria-label={`Remove ${value}`}
                >
                  <X size={14} />
                </button>
              )}
            </span>
          ))}

          {/* Input Field */}
          {!disabled && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={values.length === 0 ? placeholder : ''}
              className={`flex-1 min-w-[120px] bg-transparent outline-none text-sm ${
                isDarkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              }`}
            />
          )}
        </div>
      </div>

      {/* Helper Text */}
      {helperText && (
        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          {helperText}
        </p>
      )}

      {/* Quick Add Button (optional enhancement) */}
      {inputValue.trim() && (
        <button
          type="button"
          onClick={() => addTag(inputValue.trim())}
          className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isDarkMode
              ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          <Plus size={14} />
          Add "{inputValue.trim()}"
        </button>
      )}

      {/* Value Count */}
      {values.length > 0 && (
        <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {values.length} {values.length === 1 ? 'item' : 'items'} added
        </div>
      )}
    </div>
  );
}
