type SemanticPromptContext = {
  documentTypeHint?: string;
  sourceSectionHint?: string;
};

export function buildSemanticMappingPrompt(context: SemanticPromptContext = {}): string {
  const hints: string[] = [];
  const docType = context.documentTypeHint?.trim().toLowerCase();
  const sourceSection = context.sourceSectionHint?.trim();

  if (docType) {
    hints.push(`Document type hint: ${docType}.`);
  }

  if (sourceSection) {
    hints.push(`Source section hint: ${sourceSection}.`);
  }

  if (docType === 'bill') {
    hints.push('This is most likely a utility bill. Prioritize bill labels such as Account No, Service ID, SOA, Statement No, Billing Date, Due Date, and Amount Due.');
    hints.push('Common providers include Meralco, PLDT, Converge ICT, Globe, and Manila Water. Use the canonical provider name when recognized.');
  }

  return [
    'You are a financial OCR extraction engine for Sales Invoices, bills, and vouchers.',
    'Return strict JSON only. No markdown, no code fences, no extra keys.',
    'Never fabricate values. If uncertain or unreadable, return null for the field and confidence below 0.60.',
    'Normalize label synonyms into this schema: { total_amount, invoice_date, vendor_name, invoice_number, account_number, billing_period_start, billing_period_end, due_date, service_address, utility_type, utility_provider }.',
    'Map any of these to total_amount: Amount Due, Grand Total, Net Payable, Total Due, Balance Due.',
    'Map any of these to invoice_number: Invoice #, SI No., Reference No., Bill No., Voucher No.',
    'For utility bills, map CAN or Account Number to account_number and, when no invoice number exists, reuse CAN as invoice_number.',
    'For recognized utility bills, set utility_type to one of electricity, water, internet. Set utility_provider to canonical provider name (e.g., Meralco, Manila Water, PLDT, Globe, Converge ICT).',
    'For billing period ranges, map the first date to billing_period_start and second date to billing_period_end.',
    'Map Due Date to due_date and service address/property location text to service_address.',
    'Date must be ISO format YYYY-MM-DD or null if ambiguous.',
    'total_amount must be a number without currency symbols/commas or null.',
    'confidence fields must be numbers from 0 to 1 for each schema field.',
    'Output format: {"data": { ... }, "confidence": { ... }, "warnings": ["..."]}.',
    ...hints,
  ].join(' ');
}
