import React, { useState, useEffect } from 'react'
import { LuX, LuTriangleAlert, LuLoader, LuBuilding2, LuUser, LuSave } from 'react-icons/lu'
import { useAuth } from '../../../../contexts/AuthContext'
import { 
  getInitialCustomerFormData, 
  validateCustomerData, 
  formatTIN
} from './customer-config'

const CustomerForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  customer = null,
  isEditing = false 
}) => {
  const [formData, setFormData] = useState(getInitialCustomerFormData(customer))
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { isDarkMode } = useAuth() // Kept for context consistency, using Tailwind dark classes

  // Reset form when customer changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialCustomerFormData(customer))
      setErrors({})
    }
  }, [isOpen, customer])

  // Auto-format TIN as user types
  useEffect(() => {
    if (formData.tin_number) {
      const formatted = formatTIN(formData.tin_number)
      if (formatted !== formData.tin_number) {
        setFormData(prev => ({ ...prev, tin_number: formatted }))
      }
    }
  }, [formData.tin_number])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error for this field on type
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleTINChange = (e) => {
    const value = e.target.value
    const digitsOnly = value.replace(/\D/g, '')
    
    if (digitsOnly.length <= 12) {
      setFormData(prev => ({ ...prev, tin_number: formatTIN(value) }))
      if (errors.tin_number) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.tin_number
          return newErrors
        })
      }
    }
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value
    const digitsOnly = value.replace(/\D/g, '')
    
    if (digitsOnly.length <= 12) {
      setFormData(prev => ({ ...prev, contact_number: value }))
      if (errors.contact_number) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.contact_number
          return newErrors
        })
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault() // Prevent default form submission
    
    if (isSubmitting) return 
    
    // Validate entire form at once
    const allErrors = validateCustomerData(formData)
    
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      return
    }

    setIsSubmitting(true)
    
    try {
      await onSubmit(formData)
      setFormData(getInitialCustomerFormData())
      setErrors({})
      onClose()
    } catch (error) {
      console.error('Failed to save customer:', error)
      const errorMessage = error.message || (typeof error === 'string' ? error : 'Failed to save customer')
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
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
        className="relative w-full max-w-4xl bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-stone-50/50 dark:bg-stone-800/50 border-b border-gray-100 dark:border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isEditing ? 'Edit Customer Profile' : 'Add New Customer'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
              Enter the business and contact details below.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white dark:bg-stone-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-all"
            title="Close"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Native form tag allows "Enter" key submission */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 p-6 md:p-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              
              {/* Left Column: Business Info */}
              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-2">
                  <LuBuilding2 size={16} /> Business Details
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Customer / Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    placeholder="e.g. Acme Corporation"
                    autoFocus
                    className={`w-full px-4 py-2.5 rounded-xl border bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                      errors.customer_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                  {errors.customer_name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.customer_name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    TIN (Tax Identification Number) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="tin_number"
                    value={formData.tin_number}
                    onChange={handleTINChange}
                    placeholder="XXX-XXX-XXX-XXX"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                      errors.tin_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                  {errors.tin_number && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.tin_number}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Business Style
                  </label>
                  <input
                    type="text"
                    name="business_style"
                    value={formData.business_style}
                    onChange={handleChange}
                    placeholder="e.g. Sole Proprietorship, Corporation"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Complete Address
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter full business address..."
                    rows="3"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Contact Info & Status */}
              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-2">
                  <LuUser size={16} /> Contact Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="contact_number"
                      value={formData.contact_number}
                      onChange={handlePhoneChange}
                      placeholder="09XX-XXX-XXXX"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                        errors.contact_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    />
                    {errors.contact_number && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.contact_number}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@company.com"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                  {errors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Internal Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Add any specific instructions or internal notes here..."
                    rows="2"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

            </div>

            {/* Submit Error Toast within modal */}
            {errors.submit && (
              <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                <LuTriangleAlert className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 bg-stone-50/50 dark:bg-stone-800/50 border-t border-gray-100 dark:border-gray-700/50 px-6 py-5 flex justify-end gap-3 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors shadow-emerald-500/20 shadow-lg text-sm"
            >
              {isSubmitting ? <LuLoader className="animate-spin" size={18} /> : <LuSave size={18} />}
              {isSubmitting ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomerForm