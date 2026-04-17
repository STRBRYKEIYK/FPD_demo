import React, { useCallback, useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  FileCheck,
  FileWarning,
  RefreshCw,
  Trash2,
  Info,
} from 'lucide-react';
import {
  generateValesImportTemplate,
  parseValesImportFile,
} from '../../../../utils/imports/ValesImportTemplate';

export default function ValesImportModal({ isOpen, onClose, onImport, isDarkMode }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      await generateValesImportTemplate();
    } catch (error) {
      console.error('Failed to download template:', error);
      setParseErrors([{ type: 'error', message: 'Failed to download template' }]);
    }
  };

  const handleDrag = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setDragActive(true);
    if (event.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const files = event.dataTransfer.files;
    if (files && files[0]) await handleFile(files[0]);
  }, []);

  const handleFileInput = async (event) => {
    const files = event.target.files;
    if (files && files[0]) await handleFile(files[0]);
  };

  const resetFile = () => {
    setSelectedFile(null);
    setParseErrors([]);
  };

  const handleFile = async (file) => {
    setParseErrors([]);

    if (!file.name.endsWith('.xlsx')) {
      setParseErrors([{ type: 'error', message: 'File must be an Excel file (.xlsx)' }]);
      return;
    }

    if (file.name !== 'import_vales.xlsx') {
      setParseErrors([{ type: 'error', message: `Invalid file name. Expected "import_vales.xlsx" but got "${file.name}"` }]);
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const { vales, errors } = await parseValesImportFile(file);
      const nextErrors = [];

      if (errors.length > 0) {
        errors.forEach((error) => {
          nextErrors.push({
            type: 'error',
            message: `Row ${error.row}: ${error.errors.join(', ')}`,
          });
        });
      }

      if (vales.length === 0) {
        nextErrors.push({ type: 'warning', message: 'No valid vales found in the file.' });
      } else {
        nextErrors.push({ type: 'success', message: `Ready to import ${vales.length} vale(s).` });
      }

      setParseErrors(nextErrors);
    } catch (error) {
      setParseErrors([{ type: 'error', message: `Parsing error: ${error.message}` }]);
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const { vales } = await parseValesImportFile(selectedFile);
      await onImport(vales);
      onClose();
    } catch (error) {
      setParseErrors([{ type: 'error', message: `Import failed: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasSuccess = parseErrors.some((entry) => entry.type === 'success');
  const hasCriticalErrors = parseErrors.some((entry) => entry.type === 'error');
  const canImport = selectedFile && hasSuccess && !hasCriticalErrors;

  if (!isOpen) return null;

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className={`relative rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ${bgColor}`}>
        <div className={`px-6 py-5 border-b flex justify-between items-center ${borderColor}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-neutral-800/60 text-neutral-200' : 'bg-neutral-100 text-neutral-800'}`}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${textColor}`}>Import Vales</h3>
              <p className={`text-sm ${textSecondary}`}>Bulk create vales via Excel template</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-neutral-900/40 border-neutral-700/50' : 'bg-neutral-100/50 border-neutral-200'}`}>
            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-800'}`}>
              <Info size={16} /> Quick Guide
            </h4>
            <ul className={`space-y-2 text-xs ${isDarkMode ? 'text-neutral-200/80' : 'text-neutral-900/70'}`}>
              <li className="flex items-start gap-2"><span className="font-bold opacity-50">1.</span><span>Download the vales template.</span></li>
              <li className="flex items-start gap-2"><span className="font-bold opacity-50">2.</span><span>Fill data and keep headers unchanged.</span></li>
              <li className="flex items-start gap-2"><span className="font-bold opacity-50">3.</span><span>Name file exactly <strong>import_vales.xlsx</strong>.</span></li>
              <li className="flex items-start gap-2"><span className="font-bold opacity-50">4.</span><span>Provide required numeric/date fields before import.</span></li>
            </ul>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className={`w-full group relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all duration-200 mb-6 ${isDarkMode ? 'border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 text-gray-400 hover:text-green-400' : 'border-gray-300 hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-700'}`}
          >
            <div className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-800 group-hover:bg-green-500/20' : 'bg-gray-200 group-hover:bg-green-200'}`}>
              <Download size={18} />
            </div>
            <span className="font-medium text-sm">Download Template (import_vales.xlsx)</span>
          </button>

          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative group border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${dragActive ? 'border-neutral-500 bg-neutral-100/50 dark:bg-neutral-900/20' : `${borderColor} hover:border-neutral-400 hover:bg-gray-50 dark:hover:bg-gray-800/50`}`}
            >
              <input type="file" accept=".xlsx" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-neutral-200 text-neutral-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-neutral-500'}`}>
                <Upload size={28} />
              </div>
              <p className={`text-lg font-bold mb-1 ${textColor}`}>Drag & drop file here</p>
              <p className={`text-sm ${textSecondary}`}>or click to browse from your computer</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${borderColor} ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${hasCriticalErrors ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {hasCriticalErrors ? <FileWarning size={24} /> : <FileCheck size={24} />}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${textColor}`}>{selectedFile.name}</p>
                    <p className={`text-xs ${textSecondary}`}>{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button onClick={resetFile} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className={`rounded-xl border overflow-hidden ${borderColor} ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`}>
                <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b ${borderColor} ${textSecondary}`}>
                  Validation Status
                </div>
                <div className="max-h-[150px] overflow-y-auto p-2 space-y-1">
                  {isProcessing && (
                    <div className="flex items-center gap-2 p-2 text-xs text-neutral-500">
                      <RefreshCw size={12} className="animate-spin" /> Analyzing file...
                    </div>
                  )}

                  {!isProcessing && parseErrors.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 p-2 rounded text-xs ${entry.type === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : entry.type === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}
                    >
                      {entry.type === 'error' && <X size={14} className="mt-0.5 shrink-0" />}
                      {entry.type === 'warning' && <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                      {entry.type === 'success' && <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                      <span>{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`px-6 py-5 border-t flex justify-end gap-3 ${borderColor} ${bgColor}`}>
          <button onClick={onClose} className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport || isProcessing}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-neutral-800/20 flex items-center gap-2 transition-all ${!canImport || isProcessing ? 'bg-gray-400 cursor-not-allowed opacity-70' : 'bg-neutral-900 hover:bg-neutral-800 active:scale-95'}`}
          >
            {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <FileCheck size={18} />}
            {isProcessing ? 'Processing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
