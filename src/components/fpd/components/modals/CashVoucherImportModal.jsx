import React, { useState, useCallback } from 'react';
import { 
  Upload, Download, FileSpreadsheet, AlertCircle, 
  CheckCircle, X, FileCheck, FileWarning, Info 
} from 'lucide-react';
import { generateCashVoucherImportTemplate, parseCashVoucherImportFile } from '../../../../utils/imports/CashVoucherImportTemplate';

/**
 * Modern Import Modal for Cash Vouchers
 * Features a refined drag-and-drop zone and clean status reporting.
 */
export default function CashVoucherImportModal({ isOpen, onClose, onImport, isDarkMode }) {
  // --- STATE (Preserved) ---
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HANDLERS (Preserved) ---
  const handleDownloadTemplate = async () => {
    try {
      await generateCashVoucherImportTemplate();
    } catch (error) {
      console.error('Failed to download template:', error);
      setParseErrors([{ type: 'error', message: 'Failed to download template' }]);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFile(files[0]);
    }
  }, []);

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    setParseErrors([]);

    if (!file.name.endsWith('.xlsx')) {
      setParseErrors([{ type: 'error', message: 'File must be an Excel file (.xlsx)' }]);
      return;
    }

    if (file.name !== 'import_cash.xlsx') {
      setParseErrors([
        {
          type: 'error',
          message: `Invalid file name. Expected "import_cash.xlsx" but got "${file.name}"`
        }
      ]);
      return;
    }

    setSelectedFile(file);

    try {
      const { vouchers, errors } = await parseCashVoucherImportFile(file);

      if (errors.length > 0) {
        setParseErrors(
          errors.map((err) => ({
            type: 'error',
            message: `Row ${err.row}: ${err.errors.join(', ')}`,
            data: err.data
          }))
        );
      }

      if (vouchers.length === 0) {
        setParseErrors((prev) => [
          ...prev,
          {
            type: 'warning',
            message: 'No valid vouchers found in the file'
          }
        ]);
      } else {
        setParseErrors((prev) => [
          ...prev,
          {
            type: 'success',
            message: `Found ${vouchers.length} voucher(s) ready to import`
          }
        ]);
      }
    } catch (error) {
      setParseErrors([{ type: 'error', message: error.message }]);
      setSelectedFile(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const { vouchers } = await parseCashVoucherImportFile(selectedFile);
      await onImport(vouchers);
      onClose();
    } catch (error) {
      setParseErrors([{ type: 'error', message: 'Import failed: ' + error.message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasValidData = selectedFile && parseErrors.some((e) => e.type === 'success');
  const hasErrors = parseErrors.some((e) => e.type === 'error');

  if (!isOpen) return null;

  // --- THEME HELPERS ---
  const bgCard = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border transition-all ${bgCard} ${borderCol}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${borderCol}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${textPrimary}`}>
                Import Cash Vouchers
              </h3>
              <p className={`text-sm ${textSecondary}`}>
                Bulk create via Excel template
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Instructions Card */}
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-blue-50/50 border-blue-100'}`}>
            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
              <Info size={16} />
              Quick Guide
            </h4>
            <ul className={`space-y-2 text-xs ${isDarkMode ? 'text-gray-300' : 'text-blue-900/70'}`}>
               <li className="flex items-start gap-2">
                 <span className="font-bold opacity-50">1.</span> 
                 <span>Download the template using the button below.</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="font-bold opacity-50">2.</span> 
                 <span>Fill in data. <strong>Do not change headers</strong>.</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="font-bold opacity-50">3.</span> 
                 <span>Name file exactly <strong>import_cash.xlsx</strong>.</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="font-bold opacity-50">4.</span> 
                 <span>For Debit use <strong>dr_amount</strong>, for Credit use <strong>cr_amount</strong>.</span>
               </li>
            </ul>
          </div>

          {/* Download Template Action */}
          <button
            onClick={handleDownloadTemplate}
            className={`w-full group relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                isDarkMode 
                ? 'border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 text-gray-400 hover:text-green-400' 
                : 'border-gray-300 hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-700'
            }`}
          >
            <div className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-800 group-hover:bg-green-500/20' : 'bg-gray-200 group-hover:bg-green-200'}`}>
                <Download size={18} />
            </div>
            <span className="font-medium text-sm">Download Template (import_cash.xlsx)</span>
          </button>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
                : selectedFile
                ? isDarkMode ? 'border-green-500/50 bg-green-500/5' : 'border-green-500 bg-green-50'
                : isDarkMode ? 'border-gray-700 bg-gray-800/30 hover:border-gray-600' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <div className={`mb-4 p-4 rounded-full transition-colors ${
                selectedFile 
                    ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' 
                    : dragActive 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' 
                        : isDarkMode ? 'bg-gray-800 text-gray-500' : 'bg-white text-gray-400 shadow-sm'
            }`}>
              {selectedFile ? <FileCheck size={32} /> : <Upload size={32} />}
            </div>

            <div className="text-center space-y-1 relative z-0">
                <p className={`text-base font-semibold ${textPrimary}`}>
                    {selectedFile ? selectedFile.name : 'Drag & drop file here'}
                </p>
                <p className={`text-xs ${textSecondary}`}>
                    {selectedFile ? 'Click to change file' : 'or click to browse'}
                </p>
            </div>
          </div>

          {/* Validation Logs */}
          {parseErrors.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Validation Results</h4>
                    <span className="text-xs text-gray-500">{parseErrors.length} message(s)</span>
                </div>
                
                <div className={`max-h-[200px] overflow-y-auto rounded-xl border ${isDarkMode ? 'border-gray-800 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                    {parseErrors.map((error, index) => (
                        <div
                        key={index}
                        className={`p-3 text-sm flex items-start gap-3 border-b last:border-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} ${
                            error.type === 'error'
                            ? isDarkMode ? 'bg-red-950/20 text-red-300' : 'bg-red-50 text-red-700'
                            : error.type === 'warning'
                            ? isDarkMode ? 'bg-amber-950/20 text-amber-300' : 'bg-amber-50 text-amber-700'
                            : isDarkMode ? 'bg-green-950/20 text-green-300' : 'bg-green-50 text-green-700'
                        }`}
                        >
                        <div className="shrink-0 mt-0.5">
                            {error.type === 'success' && <CheckCircle size={16} />}
                            {error.type === 'warning' && <AlertCircle size={16} />}
                            {error.type === 'error' && <FileWarning size={16} />}
                        </div>
                        <span className="leading-snug">{error.message}</span>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${borderCol} ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleImport}
            disabled={!hasValidData || hasErrors || isProcessing}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                !hasValidData || hasErrors || isProcessing
                ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 hover:shadow-blue-500/30'
            }`}
          >
            {isProcessing ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                </>
            ) : (
                <>
                    <FileCheck size={18} />
                    <span>Import Data</span>
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}