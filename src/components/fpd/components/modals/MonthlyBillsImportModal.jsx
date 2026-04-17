import React, { useState, useCallback } from 'react';
import { 
  Upload, Download, FileSpreadsheet, AlertCircle, 
  CheckCircle2, X, FileCheck, FileWarning, RefreshCw, Trash2, Info 
} from 'lucide-react';
import { generateMonthlyBillsImportTemplate, parseMonthlyBillsImportFile } from '../../../../utils/imports/MonthlyBillsImportTemplate';

/**
 * Modern Import Modal for Monthly Bills
 * Features a refined drag-and-drop zone and clean status reporting.
 */
export default function MonthlyBillsImportModal({ isOpen, onClose, onImport, isDarkMode }) {
  // --- STATE ---
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HANDLERS ---
  const handleDownloadTemplate = async () => {
    try {
      await generateMonthlyBillsImportTemplate();
    } catch (error) {
      console.error('Failed to download template:', error);
      setParseErrors([{ type: 'error', message: 'Failed to download template' }]);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) await handleFile(files[0]);
  }, []);

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files && files[0]) await handleFile(files[0]);
  };

  const resetFile = () => {
    setSelectedFile(null);
    setParseErrors([]);
  };

  const handleFile = async (file) => {
    setParseErrors([]);
    
    // Basic Validation
    if (!file.name.endsWith('.xlsx')) {
      setParseErrors([{ type: 'error', message: 'File must be an Excel file (.xlsx)' }]);
      return;
    }

    // Strict filename check
    if (file.name !== 'import_monthly_bills.xlsx') {
      setParseErrors([{ 
        type: 'error', 
        message: `Invalid file name. Expected "import_monthly_bills.xlsx" but got "${file.name}"` 
      }]);
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const { bills, errors } = await parseMonthlyBillsImportFile(file);

      const newErrors = [];
      
      // Process Row Errors
      if (errors.length > 0) {
        errors.forEach(err => {
          newErrors.push({
            type: 'error',
            message: `Row ${err.row}: ${err.errors.join(', ')}`,
            data: err.data
          });
        });
      }

      // Process General Status
      if (bills.length === 0) {
        newErrors.push({ type: 'warning', message: 'No valid bills found in the file.' });
      } else {
        const totalItems = bills.reduce((sum, bill) => sum + bill.items.length, 0);
        newErrors.push({ 
            type: 'success', 
            message: `Found ${bills.length} bill period(s) with ${totalItems} item(s) ready to import.` 
        });
      }

      setParseErrors(newErrors);
    } catch (error) {
      setParseErrors([{ type: 'error', message: 'Parsing error: ' + error.message }]);
      setSelectedFile(null);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const { bills } = await parseMonthlyBillsImportFile(selectedFile);
      await onImport(bills);
      onClose();
      setSelectedFile(null);
      setParseErrors([]);
    } catch (error) {
      setParseErrors([{ type: 'error', message: 'Import failed: ' + error.message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- DERIVED STATE ---
  const hasSuccess = parseErrors.some(e => e.type === 'success');
  const hasCriticalErrors = parseErrors.some(e => e.type === 'error');
  const canImport = selectedFile && hasSuccess && !hasCriticalErrors;

  if (!isOpen) return null;

  // --- UI CONSTANTS ---
  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className={`relative rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ${bgColor}`}>
        
        {/* HEADER */}
        <div className={`px-6 py-5 border-b flex justify-between items-center ${borderColor}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${textColor}`}>Import Monthly Bills</h3>
              <p className={`text-sm ${textSecondary}`}>Bulk import from Excel template</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* INSTRUCTIONS CARD */}
          <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-blue-900/10 border-blue-800/50' : 'bg-blue-50/50 border-blue-100'}`}>
            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
              <Info size={16} />
              Quick Guide
            </h4>
            <ul className={`space-y-2 text-xs ${isDarkMode ? 'text-blue-200/80' : 'text-blue-900/70'}`}>
                <li className="flex items-start gap-2">
                  <span className="font-bold opacity-50">1.</span> 
                  <span>Download the template using the button below.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold opacity-50">2.</span> 
                  <span>Fill in bill data. <strong>Do not change headers</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold opacity-50">3.</span> 
                  <span>Name file exactly <strong>import_monthly_bills.xlsx</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold opacity-50">4.</span> 
                  <span>System will group items by bill period automatically.</span>
                </li>
            </ul>
          </div>

          {/* Download Template Action */}
          <button
            onClick={handleDownloadTemplate}
            className={`w-full group relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all duration-200 mb-6 ${
                isDarkMode 
                ? 'border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 text-gray-400 hover:text-green-400' 
                : 'border-gray-300 hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-700'
            }`}
          >
            <div className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-800 group-hover:bg-green-500/20' : 'bg-gray-200 group-hover:bg-green-200'}`}>
                <Download size={18} />
            </div>
            <span className="font-medium text-sm">Download Template (import_monthly_bills.xlsx)</span>
          </button>

          {/* UPLOAD AREA */}
          {!selectedFile ? (
            // EMPTY STATE - DROPZONE
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              className={`relative group border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' 
                  : `${borderColor} hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50`
              }`}
            >
              <input type="file" accept=".xlsx" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                dragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-blue-500'
              }`}>
                <Upload size={28} />
              </div>
              <p className={`text-lg font-bold mb-1 ${textColor}`}>Drag & drop file here</p>
              <p className={`text-sm ${textSecondary}`}>or click to browse from your computer</p>
            </div>
          ) : (
            // FILE SELECTED STATE
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${borderColor} ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${hasCriticalErrors ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                     {hasCriticalErrors ? <FileWarning size={24}/> : <FileCheck size={24} />}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${textColor}`}>{selectedFile.name}</p>
                    <p className={`text-xs ${textSecondary}`}>
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button onClick={resetFile} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* VALIDATION CONSOLE */}
              <div className={`rounded-xl border overflow-hidden ${borderColor} ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`}>
                 <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b ${borderColor} ${textSecondary}`}>
                    Validation Status
                 </div>
                 <div className="max-h-[150px] overflow-y-auto p-2 space-y-1">
                    {isProcessing && (
                      <div className="flex items-center gap-2 p-2 text-xs text-blue-500">
                        <RefreshCw size={12} className="animate-spin"/> Analyzing file...
                      </div>
                    )}
                    
                    {!isProcessing && parseErrors.map((error, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-2 rounded text-xs ${
                        error.type === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        error.type === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}>
                         {error.type === 'error' && <X size={14} className="mt-0.5 shrink-0"/>}
                         {error.type === 'warning' && <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
                         {error.type === 'success' && <CheckCircle2 size={14} className="mt-0.5 shrink-0"/>}
                         <span>{error.message}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className={`px-6 py-5 border-t flex justify-end gap-3 ${borderColor} ${bgColor}`}>
           <button 
             onClick={onClose}
             className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
               isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
             }`}
           >
             Cancel
           </button>
           <button 
             onClick={handleImport}
             disabled={!canImport || isProcessing}
             className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all ${
               !canImport || isProcessing
                 ? 'bg-gray-400 cursor-not-allowed opacity-70' 
                 : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
             }`}
           >
             {isProcessing ? <RefreshCw size={16} className="animate-spin"/> : <FileCheck size={18} />}
             {isProcessing ? 'Processing...' : 'Import Data'}
           </button>
        </div>
      </div>
    </div>
  );
}