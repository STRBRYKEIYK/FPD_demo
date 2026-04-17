import { useState, useRef } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { LuX, LuDownload, LuUpload, LuFileSpreadsheet, LuFileText, LuCircleAlert, LuCircleCheck, LuLoader } from 'react-icons/lu'
import {
  exportInvoicesToCSV,
  exportInvoicesToExcel,
  exportInvoicesToPDF,
  parseInvoiceCSV,
  parseInvoiceExcel,
  validateImportedInvoices,
  downloadInvoiceTemplate
} from '../../../../utils/finance-import-export'

export default function ImportExportModal({ 
  isOpen, 
  onClose, 
  mode, // 'import' or 'export'
  invoices = [], // For export
  onImportComplete, // Callback after successful import
  showToast,
  isDarkMode: propIsDarkMode = false
}) {

  const { isDarkMode: authIsDarkMode } = useAuth()
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode

  const [importFile, setImportFile] = useState(null)
  const [importMode, setImportMode] = useState('add') // 'add', 'update', 'replace'
  const [importPreview, setImportPreview] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleExport = (format) => {
    try {
      if (format === 'csv') {
        exportInvoicesToCSV(invoices, `sales_invoices_export_${new Date().toISOString().split('T')[0]}.csv`)
      } else if (format === 'excel') {
        exportInvoicesToExcel(invoices, `sales_invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`)
      } else if (format === 'pdf') {
        exportInvoicesToPDF(invoices, `sales_invoices_export_${new Date().toISOString().split('T')[0]}.pdf`)
      }
      showToast?.('Export Successful!', 'success')
      onClose()
    } catch (error) {
      showToast?.(error.message, 'error')
    }
  }

  const handleDownloadTemplate = (format) => {
    try {
      downloadInvoiceTemplate(format)
      showToast?.('Template downloaded successfully', 'success')
    } catch (error) {
      showToast?.(error.message, 'error')
    }
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImportFile(file)
    setImportErrors([])
    setImportPreview(null)

    try {
      setImportLoading(true)
      
      const fileExtension = file.name.split('.').pop().toLowerCase()
      
      let parseResult
      if (fileExtension === 'csv') {
        parseResult = await parseInvoiceCSV(file)
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        parseResult = await parseInvoiceExcel(file)
      } else {
        throw new Error('Unsupported file format. Please upload CSV or Excel file.')
      }

      const { validInvoices, errors } = validateImportedInvoices(parseResult.invoices)
      
      setImportPreview(validInvoices)
      setImportErrors(errors)
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        showToast?.(`Some rows had issues: ${parseResult.errors.length} warnings`, 'warning')
      }
    } catch (error) {
      showToast?.(error.message, 'error')
      setImportFile(null)
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportConfirm = async () => {
    if (!importPreview || importPreview.length === 0) {
      showToast?.('No valid invoices to import', 'error')
      return
    }

    try {
      setImportLoading(true)
      await onImportComplete?.(importPreview, importMode)
      showToast?.('Import completed successfully', 'success')
      handleReset()
      onClose()
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setImportLoading(false)
    }
  }

  const handleReset = () => {
    setImportFile(null)
    setImportPreview(null)
    setImportErrors([])
    setImportMode('add')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className={`relative ${isDarkMode ? 'bg-stone-900 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`sticky top-0 ${isDarkMode ? 'bg-stone-900 border-gray-700' : 'bg-white border-gray-200'} p-6 z-10`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {mode === 'export' ? 'Export Sales Invoices' : 'Import Sales Invoices'}
              </h2>
              <button
                onClick={onClose}
                className={`p-2 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-stone-800' : 'text-gray-500 hover:text-gray-700 hover:bg-stone-100'} transition-all rounded-full`}
              >
                <LuX size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {mode === 'export' ? (
              <div className="space-y-4">
                <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Choose a format to export your sales invoices ({invoices.length} invoices)
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <LuDownload className="w-6 h-6" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <LuFileSpreadsheet className="w-6 h-6" />
                    <span>Export as Excel</span>
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <LuFileText className="w-6 h-6" />
                    <span>Export as PDF</span>
                  </button>
                </div>

                <div className={`mt-6 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-3`}>Download empty template for importing:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDownloadTemplate('csv')}
                      className={`flex items-center justify-center gap-2 ${isDarkMode ? 'bg-stone-700 hover:bg-stone-600 text-white' : 'bg-stone-200 hover:bg-stone-300 text-gray-900'} px-4 py-3 rounded-lg font-medium transition-all`}
                    >
                      <LuDownload className="w-5 h-5" />
                      <span>CSV Template</span>
                    </button>
                    <button
                      onClick={() => handleDownloadTemplate('excel')}
                      className={`flex items-center justify-center gap-2 ${isDarkMode ? 'bg-stone-700 hover:bg-stone-600 text-white' : 'bg-stone-200 hover:bg-stone-300 text-gray-900'} px-4 py-3 rounded-lg font-medium transition-all`}
                    >
                      <LuDownload className="w-5 h-5" />
                      <span>Excel Template</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Instructions */}
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-100 mb-2 flex items-center gap-2">
                    <LuCircleAlert className="w-5 h-5" />
                    Import Instructions
                  </h4>
                  <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
                    <li>Upload a CSV or Excel file with your sales invoice data</li>
                    <li>Required: Invoice Number, Customer Name, Invoice Date, Sale Type, Total Amount</li>
                    <li>Optional: TIN, Address, Business Style, Description</li>
                    <li>Download a template above to see the correct format</li>
                    <li>Choose to <strong>add new</strong>, <strong>update existing</strong>, or <strong>replace all</strong> invoices</li>
                  </ul>
                </div>

                {/* Import Mode Selection */}
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Import Mode
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setImportMode('add')}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        importMode === 'add'
                          ? 'bg-blue-600 text-white'
                          : `${isDarkMode ? 'bg-stone-700 text-gray-300 hover:bg-stone-600' : 'bg-stone-200 text-gray-900 hover:bg-stone-300'}`
                      }`}
                    >
                      Add New Only
                    </button>
                    <button
                      onClick={() => setImportMode('update')}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        importMode === 'update'
                          ? 'bg-blue-600 text-white'
                          : `${isDarkMode ? 'bg-stone-700 text-gray-300 hover:bg-stone-600' : 'bg-stone-200 text-gray-900 hover:bg-stone-300'}`
                      }`}
                    >
                      Update Existing
                    </button>
                    <button
                      onClick={() => setImportMode('replace')}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        importMode === 'replace'
                          ? 'bg-red-600 text-white'
                          : `${isDarkMode ? 'bg-stone-700 text-gray-300 hover:bg-stone-600' : 'bg-stone-200 text-gray-900 hover:bg-stone-300'}`
                      }`}
                    >
                      Replace All
                    </button>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                    {importMode === 'add' && 'Only create new invoices, skip if invoice number exists'}
                    {importMode === 'update' && 'Update if exists, create if new'}
                    {importMode === 'replace' && '⚠️ Delete ALL existing invoices and import new ones'}
                  </p>
                </div>

                {/* File Upload */}
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Upload File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportFileChange}
                    className={`block w-full text-sm 
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-600 file:text-white
                      hover:file:bg-blue-700
                      cursor-pointer
                      rounded-lg border ${isDarkMode ? 'text-gray-300 bg-stone-800 border-gray-700' : 'text-gray-700 bg-stone-50 border-gray-200'}`}
                  />
                </div>

                {/* Loading State */}
                {importLoading && (
                  <div className={`flex items-center justify-center gap-2 py-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    <LuLoader className="w-5 h-5 animate-spin" />
                    <span>Processing file...</span>
                  </div>
                )}

                {/* Preview */}
                {importPreview && importPreview.length > 0 && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                    <h4 className="font-semibold text-green-100 mb-2 flex items-center gap-2">
                      <LuCircleCheck className="w-5 h-5" />
                      Ready to Import
                    </h4>
                    <p className="text-sm text-green-300">
                      {importPreview.length} valid invoice(s) ready to import
                    </p>
                  </div>
                )}

                {/* Errors */}
                {importErrors && importErrors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                    <h4 className="font-semibold text-red-100 mb-2 flex items-center gap-2">
                      <LuCircleAlert className="w-5 h-5" />
                      Errors Found ({importErrors.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-2 text-sm text-red-300">
                      {importErrors.slice(0, 5).map((error, idx) => (
                        <div key={idx} className="text-xs">
                          Row {error.row}: {error.errors ? error.errors.join(', ') : error.error}
                        </div>
                      ))}
                      {importErrors.length > 5 && (
                        <p className="text-xs text-red-400 italic">...and {importErrors.length - 5} more errors</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {importPreview && importPreview.length > 0 && (
                  <div className={`flex gap-3 justify-end pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button
                      onClick={handleReset}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium ${isDarkMode ? 'bg-stone-700 hover:bg-stone-600 text-white' : 'bg-stone-200 hover:bg-stone-300 text-gray-900'}`}
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleImportConfirm}
                      disabled={importLoading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {importLoading ? (
                        <>
                          <LuLoader className="w-4 h-4 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <LuUpload className="w-4 h-4" />
                          <span>Import {importPreview.length} Invoice(s)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

