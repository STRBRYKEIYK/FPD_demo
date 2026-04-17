import { financeExtractionResponseSchema, financeDocumentSchema } from '../schemas/financeDocumentSchema';

const OCR_LATENCY_MS = 850;

const parseAmountFromName = (name) => {
  const match = String(name || '').match(/(\d+[\d,.]*)/);
  if (!match) return null;
  const numeric = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const inferVendorName = (fileName, context) => {
  const raw = String(fileName || '').replace(/\.[^.]+$/, '');
  if (raw.trim().length > 0) {
    return raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  const section = String(context?.source_section || context?.document_type || 'Finance Document')
    .replace(/[_-]+/g, ' ')
    .trim();
  return section || 'Finance Document';
};

const buildMockExtraction = (file, context) => {
  const inferredAmount = parseAmountFromName(file?.name);
  const fallbackAmount = Number((Math.random() * 8500 + 1200).toFixed(2));
  const totalAmount = inferredAmount ?? fallbackAmount;

  const invoiceDate = toIsoDate(file?.lastModified || Date.now()) || new Date().toISOString().slice(0, 10);
  const vendorName = inferVendorName(file?.name, context);
  const invoiceNumber = `MOCK-${Date.now().toString().slice(-6)}`;

  const result = {
    data: {
      total_amount: totalAmount,
      invoice_date: invoiceDate,
      vendor_name: vendorName,
      invoice_number: invoiceNumber,
      account_number: null,
      billing_period_start: null,
      billing_period_end: null,
      due_date: null,
      service_address: null,
    },
    confidence: {
      total_amount: 0.92,
      invoice_date: 0.9,
      vendor_name: 0.88,
      invoice_number: 0.86,
    },
    warnings: [
      'Demo OCR mode: extracted values are mock data and should be verified before posting.',
    ],
    ocr_tokens: [
      {
        word: vendorName.split(' ')[0] || 'Document',
        confidence: 0.91,
        x: 32,
        y: 44,
        width: 120,
        height: 20,
        polygon: [
          [32, 44],
          [152, 44],
          [152, 64],
          [32, 64],
        ],
      },
    ],
    source_file_url: file?.name || 'mock://finance-document',
  };

  return financeExtractionResponseSchema.parse(result);
};

export async function uploadFinanceDocument(file, context = {}) {
  await new Promise((resolve) => setTimeout(resolve, OCR_LATENCY_MS));
  return buildMockExtraction(file, context);
}

export async function confirmAndSaveFinanceDocument(input) {
  const validated = financeDocumentSchema.parse(input);

  return {
    success: true,
    saved_at: new Date().toISOString(),
    reference_id: `OCR-${Date.now()}`,
    document: validated,
  };
}
