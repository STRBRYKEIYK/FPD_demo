import { useState, useEffect } from "react"
import { useAuth } from '../../../../contexts/AuthContext'
import { LuX, LuFileText, LuUser, LuCalendar, LuTrendingUp, LuDollarSign, LuInfo, LuBuilding2, LuMail, LuPhone, LuMapPin, LuHash, LuBriefcase } from "react-icons/lu"

export default function ViewRecordModal({ 
  isOpen, 
  onClose, 
  recordType = "invoice", 
  recordId, 
  apiService,
  formatCurrency,
  isDarkMode: propIsDarkMode = false // Kept for prop compatibility, but using Tailwind 'dark:' classes
}) {
  const { isDarkMode: authIsDarkMode } = useAuth()
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode
  const [loading, setLoading] = useState(false)
  const [record, setRecord] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && recordId) {
      fetchRecordDetails()
    } else {
      setRecord(null)
      setError(null)
    }
  }, [isOpen, recordId])

  const fetchRecordDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let data
      switch (recordType) {
        case 'invoice':
          data = await apiService.finance.getInvoices()
          const invoice = data.invoices?.find(inv => inv.id === recordId)
          setRecord(invoice)
          break
        case 'customer':
          data = await apiService.finance.getCustomer(recordId)
          setRecord(data.customer)
          break
        case 'expense':
        case 'monthly-bill':
        case 'voucher':
        case 'vale':
          setError('Record type not yet implemented')
          break
        default:
          setError('Unknown record type')
      }
    } catch (err) {
      console.error('Failed to fetch record details:', err)
      setError('Failed to load record details')
    } finally {
      setLoading(false)
    }
  }

  // Helper: is this invoice voided?
  const isVoidedRecord = record && (record.status === 'rejected' || record.status === 'cancelled')

  const renderInvoiceDetails = () => {
    if (!record) return null

    return (
      <div className="space-y-5">
        {/* Header Info */}
        <div className="rounded-2xl p-5 border bg-white dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-xl ${isVoidedRecord ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
              <LuFileText className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={`text-2xl font-bold text-gray-900 dark:text-white tracking-tight ${isVoidedRecord ? 'line-through opacity-60' : ''}`}>
                {record.invoice_number || record.id}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sales Invoice</p>
            </div>
          </div>

          {/* Voided banner */}
          {isVoidedRecord && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center gap-2">
              <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                ⚠ {record.status === 'rejected' ? 'Rejected' : 'Cancelled'} — Excluded from totals
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg ${
              record.sale_type === 'vatable' 
                ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' 
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
            } ${isVoidedRecord ? 'opacity-50 line-through' : ''}`}>
              {record.sale_type === 'vatable' ? 'Vatable Sale' : 'Zero-Rated Sale'}
            </span>
            <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg border ${
              record.status === 'paid'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                : record.status === 'rejected' || record.status === 'cancelled'
                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                : record.status === 'pending'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                : 'bg-stone-50 text-gray-700 border-gray-200 dark:bg-stone-800 dark:text-gray-400 dark:border-gray-700'
            }`}>
              {record.status || 'pending'}
            </span>
          </div>
        </div>

        {/* Customer & Date Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 border bg-stone-50/50 dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <LuUser className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Customer Information
              </h4>
            </div>
            <div className="space-y-3">
              <DetailRow label="Customer" value={record.customer_name} icon={<LuBuilding2 className="w-4 h-4" />} />
              <DetailRow label="Customer ID" value={record.customer_id} icon={<LuHash className="w-4 h-4" />} />
            </div>
          </div>
          
          <div className="rounded-2xl p-5 border bg-stone-50/50 dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <LuInfo className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Invoice Details
              </h4>
            </div>
            <div className="space-y-3">
              <DetailRow 
                label="Invoice Date" 
                value={new Date(record.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} 
                icon={<LuCalendar className="w-4 h-4" />}
              />
              <DetailRow label="Quarter" value={record.quarter} icon={<LuTrendingUp className="w-4 h-4" />} />
              <DetailRow 
                label="Created By" 
                value={record.created_by_name || `User ID: ${record.created_by}`} 
                icon={<LuUser className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className={`rounded-2xl p-5 border bg-white dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50 shadow-sm ${isVoidedRecord ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2 mb-5">
            <LuDollarSign className="w-5 h-5 text-emerald-500" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
              Financial Breakdown
            </h4>
            {isVoidedRecord && (
              <span className="ml-auto text-xs text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">Not counted in totals</span>
            )}
          </div>
          
          <div className="space-y-3">
            {/* Debit - Account Receivables */}
            <div className={`rounded-xl p-4 ${isVoidedRecord ? 'bg-stone-100 dark:bg-stone-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold uppercase tracking-wider ${isVoidedRecord ? 'text-gray-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  Account Receivables (DR)
                </span>
                <span className={`text-xl font-bold ${isVoidedRecord ? 'line-through text-gray-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatCurrency(record.account_receivables || 0)}
                </span>
              </div>
            </div>

            {/* Credits Breakdown */}
            <div className="rounded-xl p-4 border bg-stone-50 dark:bg-stone-900/50 border-gray-100 dark:border-gray-700/50 space-y-3">
              {record.sale_type === 'vatable' ? (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700/50">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                      Vatable Sales (CR)
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(record.vatable_sales || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      VAT Output Tax (CR)
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(record.vat_amount || record.vat_output_tax || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
                    Zero-Rated Sales (CR)
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(record.zero_rated_sales || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className={`rounded-xl p-4 ${isVoidedRecord ? 'bg-stone-200 dark:bg-stone-700' : 'bg-emerald-500'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-bold uppercase tracking-wider ${isVoidedRecord ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>
                  Total Amount
                </span>
                <span className={`text-2xl font-bold ${isVoidedRecord ? 'line-through text-gray-500 dark:text-gray-400' : 'text-white'}`}>
                  {formatCurrency(record.total_amount || record.account_receivables || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks */}
        {record.remarks && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <LuInfo className="w-4 h-4" /> Remarks
            </h4>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200/80">
              {record.remarks}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex gap-4 text-[11px] text-gray-400 dark:text-gray-500">
            {record.created_at && <span>Created: {new Date(record.created_at).toLocaleString('en-US')}</span>}
            {record.updated_at && <span>Updated: {new Date(record.updated_at).toLocaleString('en-US')}</span>}
          </div>
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500">ID: #{record.id}</p>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 italic mt-2">
          To edit this invoice, close this modal and use the inline edit button in the table.
        </p>
      </div>
    )
  }

  const renderCustomerDetails = () => {
    if (!record) return null

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-2xl p-5 border bg-white dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
              <LuBuilding2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {record.customer_name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Customer Profile</p>
            </div>
          </div>
          <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            {record.status || 'Active'}
          </span>
        </div>

        {/* Main Grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Information */}
          <div className="rounded-2xl p-5 border bg-stone-50/50 dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <LuMail className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Contact Information
              </h4>
            </div>
            <div className="space-y-3">
              <DetailRow label="Contact Person" value={record.contact_person || 'N/A'} icon={<LuUser className="w-4 h-4" />} />
              <DetailRow label="Email" value={record.email || 'N/A'} icon={<LuMail className="w-4 h-4" />} />
              <DetailRow label="Phone" value={record.phone || 'N/A'} icon={<LuPhone className="w-4 h-4" />} />
              <DetailRow label="Address" value={record.address || 'N/A'} icon={<LuMapPin className="w-4 h-4" />} />
            </div>
          </div>

          {/* Business Information */}
          <div className="rounded-2xl p-5 border bg-stone-50/50 dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <LuBriefcase className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Business Information
              </h4>
            </div>
            <div className="space-y-3">
              <DetailRow label="TIN" value={record.tin || record.tin_number || 'N/A'} icon={<LuHash className="w-4 h-4" />} />
              <DetailRow label="Business Style" value={record.business_style || 'N/A'} icon={<LuBriefcase className="w-4 h-4" />} />
            </div>
          </div>
        </div>

        {/* Statistics */}
        {(record.total_invoices !== undefined || record.total_sales !== undefined) && (
          <div className="rounded-2xl p-5 border bg-white dark:bg-stone-800/40 border-gray-100 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <LuTrendingUp className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                Sales Summary
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 border bg-stone-50 dark:bg-stone-900/50 border-gray-100 dark:border-gray-700/50 flex flex-col justify-center items-center text-center">
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Invoices</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{record.total_invoices || 0}</p>
              </div>
              <div className="rounded-xl p-3 border bg-stone-50 dark:bg-stone-900/50 border-gray-100 dark:border-gray-700/50 flex flex-col justify-center items-center text-center">
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Total Sales</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(record.total_sales || record.total_account_receivables || 0)}</p>
              </div>
              {record.last_invoice_date && (
                <div className="rounded-xl p-3 border bg-stone-50 dark:bg-stone-900/50 border-gray-100 dark:border-gray-700/50 flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Last Invoice</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{new Date(record.last_invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex gap-4 text-[11px] text-gray-400 dark:text-gray-500">
            {record.created_at && <span>Created: {new Date(record.created_at).toLocaleString('en-US')}</span>}
            {record.created_by_name && <span>By: {record.created_by_name}</span>}
          </div>
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500">Customer ID: #{record.id}</p>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading record details...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-16">
          <div className="inline-flex p-4 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 mb-4">
            <LuX size={32} />
          </div>
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      )
    }

    if (!record) {
      return (
        <div className="text-center py-16">
          <LuFileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No record found</p>
        </div>
      )
    }

    switch (recordType) {
      case 'invoice':
        return renderInvoiceDetails()
      case 'customer':
        return renderCustomerDetails()
      default:
        return (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">
              Record type "{recordType}" not yet implemented
            </p>
          </div>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close button */}
        <div className="sticky top-0 right-0 z-10 flex justify-end p-4 pointer-events-none">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/80 dark:bg-stone-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all pointer-events-auto"
            title="Close"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 pt-0 -mt-8">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

// Helper component for detail rows
function DetailRow({ label, value, icon }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs font-medium flex items-center gap-2 text-gray-500 dark:text-gray-400 min-w-[120px]">
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
        {label}
      </span>
      <span className="text-xs text-right flex-1 break-words font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  )
}