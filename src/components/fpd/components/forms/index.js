// ============================================================================
// forms/index.js
// Export all form components and configurations
// ============================================================================

export { default as CustomerForm } from './CustomerForm'
export { default as MonthlyBillsBulkCreator } from './MonthlyBillsBulkCreator'
export { default as ProvidersBulkCreator } from './ProvidersBulkCreator'
export { PROVIDER_CATEGORIES, getCategoryIcon, getCategoryLabel } from './providers-config'
export { validateTIN, formatTIN, validateEmail, validatePhoneNumber } from './customer-config'