// ============================================================================
// customer-config.js
// Customer form configuration and utilities
// ============================================================================

/**
 * Validate TIN (Tax Identification Number) format
 * Philippine TIN format: XXX-XXX-XXX-XXX
 */
export const validateTIN = (tin) => {
  if (!tin) return { valid: false, message: 'TIN is required' }
  
  // Remove all non-digit characters
  const digitsOnly = tin.replace(/\D/g, '')
  
  if (digitsOnly.length !== 12) {
    return { valid: false, message: 'TIN must be 12 digits' }
  }
  
  return { valid: true, message: 'Valid TIN' }
}

/**
 * Format TIN with dashes
 */
export const formatTIN = (tin) => {
  if (!tin) return ''
  
  const digitsOnly = tin.replace(/\D/g, '')
  
  if (digitsOnly.length <= 3) return digitsOnly
  if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`
  if (digitsOnly.length <= 9) return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
  
  return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 9)}-${digitsOnly.slice(9, 12)}`
}

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email) return { valid: true, message: '' } // Email is optional
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' }
  }
  
  return { valid: true, message: 'Valid email' }
}

/**
 * Validate Philippine mobile number
 */
export const validatePhoneNumber = (phone) => {
  if (!phone) return { valid: true, message: '' } // Phone is optional
  
  const digitsOnly = phone.replace(/\D/g, '')
  
  // Philippine mobile numbers: 09XX-XXX-XXXX (11 digits) or +639XX-XXX-XXXX (12 digits with country code)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
    return { valid: true, message: 'Valid mobile number' }
  }
  
  if (digitsOnly.length === 12 && digitsOnly.startsWith('639')) {
    return { valid: true, message: 'Valid mobile number' }
  }
  
  // Landline: 8 digits or with area code (10-11 digits)
  if (digitsOnly.length >= 7 && digitsOnly.length <= 11) {
    return { valid: true, message: 'Valid phone number' }
  }
  
  return { valid: false, message: 'Invalid phone number format' }
}

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return ''
  
  const digitsOnly = phone.replace(/\D/g, '')
  
  // Philippine mobile: 09XX-XXX-XXXX
  if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`
  }
  
  // With country code: +639XX-XXX-XXXX
  if (digitsOnly.length === 12 && digitsOnly.startsWith('639')) {
    return `+${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5, 8)}-${digitsOnly.slice(8)}`
  }
  
  return phone
}

/**
 * Payment terms options
 */
export const PAYMENT_TERMS_OPTIONS = [
  { value: 'cod', label: 'Cash on Delivery (COD)' },
  { value: 'net-7', label: 'Net 7 Days' },
  { value: 'net-15', label: 'Net 15 Days' },
  { value: 'net-30', label: 'Net 30 Days' },
  { value: 'net-45', label: 'Net 45 Days' },
  { value: 'net-60', label: 'Net 60 Days' },
  { value: 'net-90', label: 'Net 90 Days' },
  { value: 'custom', label: 'Custom Terms' }
]

/**
 * Get initial form data
 */
export const getInitialCustomerFormData = (customer = null) => {
  if (customer) {
    return {
      // Basic Information (finance_customers)
      customer_name: customer.customer_name || '',
      address: customer.address || '',
      tin_number: customer.tin_number || '',
      business_style: customer.business_style || '',
      contact_person: customer.contact_person || '',
      contact_number: customer.contact_number || '',
      email: customer.email || '',
      status: customer.status || 'active',
      
      // Business Details (finance_customer_info)
      payment_terms: customer.payment_terms || 'net-30',
      credit_limit: customer.credit_limit || '',
      discount_rate: customer.discount_rate || '',
      notes: customer.notes || ''
    }
  }
  
  return {
    // Basic Information
    customer_name: '',
    address: '',
    tin_number: '',
    business_style: '',
    contact_person: '',
    contact_number: '',
    email: '',
    status: 'active',
    
    // Business Details
    payment_terms: 'net-30',
    credit_limit: '',
    discount_rate: '',
    notes: ''
  }
}

/**
 * Validate customer form data
 */
export const validateCustomerData = (data, step = null) => {
  const errors = {}
  
  // Step 1: Basic Information
  if (step === null || step === 1) {
    if (!data.customer_name || data.customer_name.trim() === '') {
      errors.customer_name = 'Customer name is required'
    }
    
    if (!data.tin_number || data.tin_number.trim() === '') {
      errors.tin_number = 'TIN is required'
    } else {
      const tinValidation = validateTIN(data.tin_number)
      if (!tinValidation.valid) {
        errors.tin_number = tinValidation.message
      }
    }
    
    if (data.email) {
      const emailValidation = validateEmail(data.email)
      if (!emailValidation.valid) {
        errors.email = emailValidation.message
      }
    }
    
    if (data.contact_number) {
      const phoneValidation = validatePhoneNumber(data.contact_number)
      if (!phoneValidation.valid) {
        errors.contact_number = phoneValidation.message
      }
    }
  }
  
  // Step 2: Business Details
  if (step === null || step === 2) {
    if (data.credit_limit && parseFloat(data.credit_limit) < 0) {
      errors.credit_limit = 'Credit limit cannot be negative'
    }
    
    if (data.discount_rate) {
      const discountRate = parseFloat(data.discount_rate)
      if (discountRate < 0 || discountRate > 100) {
        errors.discount_rate = 'Discount rate must be between 0 and 100'
      }
    }
  }
  
  return errors
}
