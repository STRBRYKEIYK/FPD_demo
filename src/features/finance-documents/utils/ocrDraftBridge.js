function asIsoDate(value) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!value || typeof value !== 'string') return todayIso;

  const trimmed = value.trim();
  const strictIsoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (strictIsoMatch) {
    const year = Number(strictIsoMatch[1]);
    const month = Number(strictIsoMatch[2]);
    const day = Number(strictIsoMatch[3]);

    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${strictIsoMatch[1]}-${strictIsoMatch[2]}-${strictIsoMatch[3]}`;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return todayIso;

  const parsedYear = parsed.getUTCFullYear();
  if (parsedYear < 1900 || parsedYear > 2100) return todayIso;

  return parsed.toISOString().slice(0, 10);
}

function asOptionalIsoDate(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const strictIsoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (strictIsoMatch) {
    const year = Number(strictIsoMatch[1]);
    const month = Number(strictIsoMatch[2]);
    const day = Number(strictIsoMatch[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${strictIsoMatch[1]}-${strictIsoMatch[2]}-${strictIsoMatch[3]}`;
    }
    return '';
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  if (year < 1900 || year > 2100) return '';
  return parsed.toISOString().slice(0, 10);
}

function asAmountString(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toFixed(2);
}

function asNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Number(value);
}

function deriveQuarter(dateString) {
  const month = new Date(dateString).getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function sanitizeInvoiceNumber(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits || String(value).trim();
}

function buildBaseRemark(sourceSection) {
  return `OCR prefill (${sourceSection || 'finance'})`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isLikelyNoiseToken(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return true;
  if (/^(?:ness|sdd|n\/a|na|none|null|unknown)$/i.test(normalized)) return true;
  if (/tin\s*no|no\s*tin\s*provided|tin\s*provided/i.test(normalized)) return true;
  if (normalized.length <= 3) return true;
  return false;
}

function isLikelyLabelPhrase(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return /account\s*number|customer\s*account|\bcan\b|due\s*date|billing\s*period|invoice\s*number|please\s*pay/.test(normalized);
}

function normalizeAccountReference(value) {
  const raw = normalizeText(value);
  if (!raw || isLikelyNoiseToken(raw)) return '';

  const compact = raw.replace(/\s+/g, '');
  const digitOnly = compact.replace(/\D/g, '');
  if (digitOnly.length >= 6) {
    return digitOnly;
  }

  const alnum = compact.replace(/[^A-Za-z0-9-]/g, '');
  if (alnum.length >= 6 && /\d/.test(alnum)) {
    return alnum;
  }

  return '';
}

function normalizeUtilityCategory(utilityType) {
  const normalized = normalizeText(utilityType).toLowerCase();
  if (normalized === 'internet') return 'communications';
  if (normalized === 'electricity') return 'electricity';
  if (normalized === 'water') return 'water';
  return 'other';
}

function classifyProvider(vendorName, utilityType, utilityProvider) {
  const normalizedUtilityProvider = normalizeText(utilityProvider);
  const utilityCategory = normalizeUtilityCategory(utilityType);
  if (normalizedUtilityProvider && utilityCategory !== 'other') {
    return { providerName: normalizedUtilityProvider, category: utilityCategory };
  }

  const normalized = normalizeText(vendorName).toLowerCase();

  if (!normalized) {
    return { providerName: '', category: 'other' };
  }

  if (/\bmeralco\b|manila\s*electric/.test(normalized)) {
    return { providerName: 'Meralco', category: 'electricity' };
  }

  if (/\bpldt\b|philippine\s*long\s*distance/.test(normalized)) {
    return { providerName: 'PLDT', category: 'communications' };
  }

  if (/converge\s*ict|\bconverge\b/.test(normalized)) {
    return { providerName: 'Converge ICT', category: 'communications' };
  }

  if (/\bglobe\b|globe\s*telecom/.test(normalized)) {
    return { providerName: 'Globe', category: 'communications' };
  }

  if (/manila\s*water/.test(normalized)) {
    return { providerName: 'Manila Water', category: 'water' };
  }

  if (/customer\s*account\s*number|\bcan\b/.test(normalized)) {
    return { providerName: 'Meralco', category: 'electricity' };
  }

  if (isLikelyLabelPhrase(normalized) || isLikelyNoiseToken(normalized)) {
    return { providerName: '', category: 'other' };
  }

  return { providerName: normalizeText(vendorName), category: 'other' };
}

function mapSalesInvoiceDraft(extracted, sourceSection) {
  const invoiceDate = asIsoDate(extracted.invoice_date);
  return {
    invoice_number: sanitizeInvoiceNumber(extracted.invoice_number),
    invoice_date: invoiceDate,
    customer_id: '',
    customer_name: extracted.vendor_name || '',
    is_new_customer: true,
    total_amount: asAmountString(extracted.total_amount),
    sale_type: 'vatable',
    quarter: deriveQuarter(invoiceDate),
    remarks: buildBaseRemark(sourceSection),
  };
}

function mapMonthlyBillDraft(extracted, sourceSection) {
  const invoiceDate = asIsoDate(extracted.invoice_date);
  const billingPeriodStart = asOptionalIsoDate(extracted.billing_period_start);
  const billingPeriodEnd = asOptionalIsoDate(extracted.billing_period_end);
  const dueDate = asOptionalIsoDate(extracted.due_date);
  const effectiveMonthAnchor = billingPeriodStart || invoiceDate;
  const date = new Date(effectiveMonthAnchor);
  const providerClassification = classifyProvider(
    extracted.vendor_name,
    extracted.utility_type,
    extracted.utility_provider,
  );
  const billReference = normalizeAccountReference(extracted.invoice_number);
  const extractedAccountNumber = normalizeAccountReference(extracted.account_number);
  const accountRef = extractedAccountNumber || billReference;
  const isCommunication = providerClassification.category === 'communications';
  const normalizedLocation = normalizeText(extracted.service_address);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    status: 'pending',
    payment_method: '',
    payment_date: '',
    items: [
      {
        category: providerClassification.category,
        provider_name: providerClassification.providerName,
        location: normalizedLocation,
        account_number: isCommunication ? '' : accountRef,
        soa_number: isCommunication ? accountRef : '',
        fee_name: '',
        description: buildBaseRemark(sourceSection),
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        due_date: dueDate,
        amount: asAmountString(extracted.total_amount),
      },
    ],
  };
}

function mapExpenseDraft(extracted, sourceSection) {
  return {
    date: asIsoDate(extracted.invoice_date),
    account_classification: '',
    particulars: extracted.invoice_number
      ? `${buildBaseRemark(sourceSection)} · Ref ${extracted.invoice_number}`
      : buildBaseRemark(sourceSection),
    company_supplier: extracted.vendor_name || '',
    address: '',
    tin: '',
    or_ci_si: extracted.invoice_number || '',
    vat_amount: '0.00',
    non_vat_amount: asAmountString(extracted.total_amount),
  };
}

function mapCashVoucherDraft(extracted, sourceSection) {
  return {
    voucher_date: asIsoDate(extracted.invoice_date),
    transaction_type: 'debit',
    company_payee_payor: extracted.vendor_name || '',
    cash_source: '',
    invoice_number: extracted.invoice_number || '',
    po_number: '',
    with_copy: false,
    status: 'pending',
    remarks: buildBaseRemark(sourceSection),
    lineItems: [
      {
        description: extracted.invoice_number
          ? `OCR Import - Ref ${extracted.invoice_number}`
          : 'OCR Import',
        reference: extracted.invoice_number || '',
        amount: asNumber(extracted.total_amount),
      },
    ],
  };
}

function mapCheckVoucherDraft(extracted, sourceSection) {
  return {
    voucher_date: asIsoDate(extracted.invoice_date),
    transaction_type: 'credit',
    company_payee_payor: extracted.vendor_name || '',
    bank_check_no: '',
    bank_deposited: '',
    discount_type: 'none',
    discount_value: 0,
    cleared_date: '',
    status: 'pending',
    remarks: buildBaseRemark(sourceSection),
    lineItems: [
      {
        po_number: '',
        si_number: extracted.invoice_number || '',
        dr_number: '',
        qi_number: '',
        remark: extracted.invoice_number
          ? `OCR Import - Ref ${extracted.invoice_number}`
          : 'OCR Import',
        includeInExpenses: true,
        with_copy: false,
        amount: asNumber(extracted.total_amount),
      },
    ],
  };
}

function mapPettyCashVoucherDraft(extracted, sourceSection) {
  return {
    voucher_date: asIsoDate(extracted.invoice_date),
    account_classification: '',
    company_supplier: extracted.vendor_name || '',
    lineItems: [
      {
        includeInExpenses: true,
        account_id: null,
        company_supplier: extracted.vendor_name || '',
        particulars: extracted.invoice_number
          ? `OCR Import - Ref ${extracted.invoice_number}`
          : buildBaseRemark(sourceSection),
        amount: asNumber(extracted.total_amount),
        vat_type: 'Non-VAT',
        reference: extracted.invoice_number || '',
      },
    ],
  };
}

export function mapOcrToFinanceDraft({ documentTypeHint, sourceSectionHint, extractedData }) {
  const sourceSection = sourceSectionHint || 'finance';
  const data = extractedData || {};

  switch (documentTypeHint) {
    case 'sales_invoice':
      return { target: 'sales_invoice', draft: mapSalesInvoiceDraft(data, sourceSection) };
    case 'bill':
      return { target: 'monthly_bill', draft: mapMonthlyBillDraft(data, sourceSection) };
    case 'expense':
      return { target: 'expense', draft: mapExpenseDraft(data, sourceSection) };
    case 'voucher': {
      if (String(sourceSection).includes('check')) {
        return { target: 'check_voucher', draft: mapCheckVoucherDraft(data, sourceSection) };
      }

      if (String(sourceSection).includes('petty')) {
        return { target: 'petty_cash_voucher', draft: mapPettyCashVoucherDraft(data, sourceSection) };
      }

      return { target: 'cash_voucher', draft: mapCashVoucherDraft(data, sourceSection) };
    }
    default:
      return null;
  }
}
