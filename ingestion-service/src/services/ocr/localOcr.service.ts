import pdfParse from 'pdf-parse';
import { createWorker, PSM } from 'tesseract.js';
import mammoth from 'mammoth';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import type { ExtractionResult } from '../../types/shared.js';

type OcrImageVariant = { label: string; buffer: Buffer };
type UtilityBillType = 'electricity' | 'water' | 'internet';
type UtilityBillTypeOrUnknown = UtilityBillType | 'unknown';

type BillProviderDefinition = {
  canonicalName: string;
  utilityType: UtilityBillType;
  aliases: RegExp[];
  invoiceNumberPatterns: RegExp[];
  datePatterns: RegExp[];
  amountPatterns: RegExp[];
};

// ─────────────────────────────────────────────────────────────────────────────
//  Company-name OCR artifact correction
//  Must run before any pattern matching so the corrected text is used downstream.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fix the most common OCR mis-readings that affect field extraction.
 *
 * Notable corrections:
 *  • Standalone '8' between two letter-words → '&'
 *    e.g. "ENGINEERING WORKS 8 GENERAL SERVICES" → "... & GENERAL ..."
 *  • Lone 'l' / 'I' flanked by digits → '1'
 *  • Lone 'O' / 'o' inside numeric run → '0'
 *  • Strip invisible Unicode artifacts (zero-width space, BOM, etc.)
 */
function fixOcrArtifacts(text: string): string {
  if (!text) return text;

  // '8' surrounded by letter-words → '&'
  // Lookbehind: ≥2 letters (end of a word), lookahead: ≥2 letters (start of next word)
  let out = text.replace(/(?<=[A-Za-z]{2,} )8(?= [A-Za-z]{2,})/g, '&');

  // 'l' or 'I' between digits → '1'
  out = out.replace(/(?<=\d)[lI](?=\d)/g, '1');
  // 'O' / 'o' between digits → '0'
  out = out.replace(/(?<=\d)[Oo](?=\d)/g, '0');

  // Invisible / problematic Unicode
  out = out.replace(/[\u200b\u200c\u200d\ufeff\u00ad]/g, '');
  // Curly quotes → straight
  out = out.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  // TM / copyright symbols that occasionally appear near company names
  out = out.replace(/[©®™]/g, '');

  return out;
}

const BILL_PROVIDERS: BillProviderDefinition[] = [
  {
    canonicalName: 'Meralco',
    utilityType: 'electricity',
    aliases: [/\bmeralco\b/i, /manila\s*electric\s*company/i],
    invoiceNumberPatterns: [
      /(?:service\s*id(?:\s*no\.?)?|ac{1,2}ount\s*(?:no\.?|number)|customer\s*ac{1,2}ount\s*(?:no\.?|number)|can)\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ],
    datePatterns: [
      /(?:due\s*date|bill(?:ing)?\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ],
    amountPatterns: [
      /(?:amount\s*due|total\s*current\s*amount|total\s*amount\s*due|total\s*due)\s*[:#-]?\s*(?:php|₱|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ],
  },
  {
    canonicalName: 'PLDT',
    utilityType: 'internet',
    aliases: [/\bpldt\b/i, /philippine\s*long\s*distance/i],
    invoiceNumberPatterns: [
      /(?:billing\s*invoice(?:\s*no\.?)?|ac{1,2}ount\s*(?:no\.?|number)|soa\s*(?:no\.?|number)|reference\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ],
    datePatterns: [
      /(?:due\s*date|bill\s*date|statement\s*date|billing\s*date|invoice\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ],
    amountPatterns: [
      /(?:total\s*amount\s*due|amount\s*due|total\s*current\s*charges|current\s*charges)\s*[:#-]?\s*(?:php|₱|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ],
  },
  {
    canonicalName: 'Converge ICT',
    utilityType: 'internet',
    aliases: [/converge\s*ict/i, /\bconverge\b/i],
    invoiceNumberPatterns: [
      /(?:ac{1,2}ount\s*(?:no\.?|number)|ref(?:erence)?\s*(?:no\.?|number|#)|soa\s*(?:no\.?|number|#)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
    ],
    datePatterns: [
      /(?:due\s*date|billing\s*date|bill\s*date|statement\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ],
    amountPatterns: [
      /(?:total\s*amount\s*due|amount\s*due|outstanding\s*balance|balance\s*due)\s*[:#-]?\s*(?:php|₱|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ],
  },
  {
    canonicalName: 'Globe',
    utilityType: 'internet',
    aliases: [/\bglobe\b/i, /globe\s*telecom/i],
    invoiceNumberPatterns: [
      /(?:ac{1,2}ount\s*(?:no\.?|number)|billing\s*ac{1,2}ount\s*(?:no\.?|number)|reference\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ],
    datePatterns: [
      /(?:due\s*date|bill\s*date|billing\s*date|statement\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ],
    amountPatterns: [
      /(?:total\s*amount\s*due|amount\s*due|outstanding\s*balance|balance\s*due)\s*[:#-]?\s*(?:php|₱|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ],
  },
  {
    canonicalName: 'Manila Water',
    utilityType: 'water',
    aliases: [/manila\s*water/i],
    invoiceNumberPatterns: [
      // "Contract Account Number" or "Contract Acount Number" (OCR typo — one 'c')
      /contract\s*ac{1,2}ount\s*(?:no\.?|number)?\s*[:#-]?\s*([0-9]{5,})/i,
      /(?:ac{1,2}ount\s*(?:no\.?|number)|statement\s*(?:no\.?|number)|reference\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ],
    datePatterns: [
      /(?:due\s*date|bill\s*date|billing\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ],
    amountPatterns: [
      /(?:total\s*amount\s*due|amount\s*due|total\s*due|balance\s*due)\s*[:#-]?\s*(?:php|₱|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ],
  },
];

const UTILITY_TYPE_PATTERNS: Record<UtilityBillTypeOrUnknown, RegExp[]> = {
  electricity: [/\bkwh\b/i, /kilowatt\s*hour/i, /generation\s*charge/i, /distribution\s*charge/i, /electric(?:ity)?\s*bill/i, /manila\s*electric/i],
  water: [/\bwater\b/i, /\bm3\b/i, /cubic\s*meter/i, /sewer(?:age)?/i, /water\s*consumption/i, /manila\s*water/i],
  internet: [/\binternet\b/i, /broadband/i, /fiber/i, /dsl/i, /monthly\s*service\s*fee/i, /plan\s*\d+/i],
  unknown: [],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helper predicates
// ─────────────────────────────────────────────────────────────────────────────

function isLikelyBillDocument(documentTypeHint?: string): boolean {
  const n = (documentTypeHint || '').trim().toLowerCase();
  return n === 'bill' || n === 'monthly_bill' || n.includes('utility');
}

function isLikelyVoucherDocument(documentTypeHint?: string): boolean {
  const n = (documentTypeHint || '').trim().toLowerCase();
  return ['voucher', 'cash_voucher', 'check_voucher', 'petty_cash_voucher', 'payment_voucher'].some((k) => n.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Provider / utility detection
// ─────────────────────────────────────────────────────────────────────────────

function detectBillProvider(text: string): BillProviderDefinition | null {
  for (const provider of BILL_PROVIDERS) {
    if (provider.aliases.some((a) => a.test(text))) return provider;
  }
  return null;
}

function detectUtilityTypeBySignals(text: string): UtilityBillTypeOrUnknown {
  const scored = (['electricity', 'water', 'internet'] as UtilityBillType[])
    .map((type) => ({ type, score: UTILITY_TYPE_PATTERNS[type].reduce((s, p) => s + (p.test(text) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return (!best || best.score <= 0) ? 'unknown' : best.type;
}

function detectUtilityClassification(text: string, provider: BillProviderDefinition | null) {
  const utilityType = provider?.utilityType ?? detectUtilityTypeBySignals(text);
  return {
    utility_type: utilityType === 'unknown' ? null : utilityType,
    utility_provider: provider?.canonicalName ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Amount helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseAmountToken(token: string): number | null {
  const cleaned = token
    .replace(/[₱p]/gi, '')
    .replace(/[Oo](?=\d|\.|,|$)/g, '0')
    .replace(/[^0-9.,-]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

function looksLikeIdentifierNotAmount(raw: string): boolean {
  const stripped = raw.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(stripped)) return false;
  return stripped.length >= 8;
}

function collectAmounts(line: string): number[] {
  return [...line.matchAll(/([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/g)]
    .filter((m) => !looksLikeIdentifierNotAmount(m[1]))
    .map((m) => parseAmountToken(m[1]))
    .filter((v): v is number => v !== null);
}

function findCurrencyTaggedAmount(text: string): number | null {
  const matches = [...text.matchAll(/[₱p](?:hp)?\s*([0-9][0-9,]*\.\d{1,2})/gi)];
  const amounts = matches.map((m) => parseAmountToken(m[1])).filter((v): v is number => v !== null && v >= 1);
  return amounts.length > 0 ? Math.max(...amounts) : null;
}

function findTotalAmountDueLabel(text: string): number | null {
  const patterns = [
    /total\s*amount\s*due\s*[:\-]?\s*(?:[₱p](?:hp)?)?\s*([0-9][0-9,]*\.\d{1,2})/i,
    /total\s*amount\s*due\b[\s\S]{0,80}?(?:[₱p](?:hp)?)?\s*([0-9][0-9,]*\.\d{1,2})/i,
    /amount\s*due\s*[:\-]?\s*(?:[₱p](?:hp)?)?\s*([0-9][0-9,]*\.\d{1,2})/i,
    /please\s*pay\s*[:\-]?\s*(?:[₱p](?:hp)?)?\s*([0-9][0-9,]*\.\d{1,2})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const v = parseAmountToken(m[1]);
      if (v !== null && v >= 1) return v;
    }
  }
  return null;
}

function findLikelyBillAmount(text: string, provider: BillProviderDefinition | null): number | null {
  const direct = findTotalAmountDueLabel(text);
  if (direct !== null) return direct;
  const providerMatch = provider ? findFirstCaptured(text, provider.amountPatterns) : null;
  const genericMatch = findFirstCaptured(text, [
    /(?:total\s*amount\s*due|amount\s*due|total\s*due|balance\s*due|current\s*charges|outstanding\s*balance)\s*[:#-]?\s*(?:[₱p](?:hp)?)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
  ]);
  return parseAmountToken(providerMatch || genericMatch || '') ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const DATE_CAPTURE_PATTERN = '([A-Za-z]{3,9}\\s*\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{4}[\\/-]\\d{1,2}[\\/-]\\d{1,2})';

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const shortYear = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (shortYear) {
    const [, m, d, y] = shortYear;
    const fullYear = Number(y) < 50 ? 2000 + Number(y) : 1900 + Number(y);
    const parsed = new Date(`${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!Number.isNaN(parsed.getTime())) {
      return `${fullYear}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    return year >= 1900 && year <= 2100 ? trimmed : null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;
  return `${year}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function normalizeBillDate(raw: string): string | null {
  const normalized = normalizeDate(raw);
  if (!normalized) return null;
  const year = Number(normalized.slice(0, 4));
  const maxYear = new Date().getFullYear() + 1;
  return year >= 2015 && year <= maxYear ? normalized : null;
}

function findCapturedNearLabels(text: string, labels: string[], capturePattern: string, maxDistance = 120): string | null {
  for (const label of labels) {
    const expression = new RegExp(`${label}[\\s\\S]{0,${maxDistance}}?${capturePattern}`, 'i');
    const matched = text.match(expression);
    if (matched?.[1]) return matched[1].trim();
  }
  return null;
}

function findFirstCaptured(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function findLikelyBillDate(text: string, provider: BillProviderDefinition | null): string | null {
  const billDateLabel = findCapturedNearLabels(text, ['bill(?:ing)?\\s*dat(?:e)?', 'statement\\s*date', 'reading\\s*date'], DATE_CAPTURE_PATTERN, 400);
  if (billDateLabel) {
    const n = normalizeBillDate(billDateLabel);
    if (n) return n;
  }
  const providerDate = provider ? findFirstCaptured(text, provider.datePatterns) : null;
  if (providerDate) {
    const n = normalizeBillDate(providerDate);
    if (n) return n;
  }
  const dueDate = findCapturedNearLabels(text, ['due\\s*date', 'payment\\s*due'], DATE_CAPTURE_PATTERN, 400)
    || findFirstCaptured(text, [/(?:due\s*date|payment\s*due)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i]);
  const statementDate = findFirstCaptured(text, [/(?:bill(?:ing)?\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i]);
  return normalizeBillDate(dueDate || statementDate || '');
}

function findLikelyBillingPeriod(text: string): { start: string | null; end: string | null } {
  const PERIOD_LABEL = '(?:billing\\s*period|period\\s*covered|covered\\s*period|reading\\s*period)';
  // Multi-line: label → up to 400 chars → date → separator → date
  const nearbyMatch = text.match(
    new RegExp(`${PERIOD_LABEL}[\\s\\S]{0,400}?${DATE_CAPTURE_PATTERN}[\\s\\S]{0,80}?(?:to|\\-|–|—)[\\s\\S]{0,80}?${DATE_CAPTURE_PATTERN}`, 'i'),
  );
  if (nearbyMatch) return { start: normalizeBillDate(nearbyMatch[1]), end: normalizeBillDate(nearbyMatch[2]) };
  // Inline: "Billing Period: Sep 16 - Oct 17, 2024" or "Period Covered Sep 16 to Oct 17, 2024"
  const match = text.match(new RegExp(
    `${PERIOD_LABEL}\\s*[:#-]?\\s*([A-Za-z]{3,9}\\s*\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2})\\s*(?:to|\\-|–|—)\\s*([A-Za-z]{3,9}\\s*\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2})`,
    'i',
  ));
  if (!match) return { start: null, end: null };
  return { start: normalizeBillDate(match[1]), end: normalizeBillDate(match[2]) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Identifier / reference number helpers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeExtractedToken(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^[:#\-\s]+/g, '').replace(/^(?:No\.?\s*)+/i, '').replace(/^#+/g, '').trim();
  return cleaned || null;
}

function sanitizeBillIdentifier(raw: string | null, minLength = 5): string | null {
  const cleaned = sanitizeExtractedToken(raw);
  if (!cleaned) return null;
  const compact = cleaned.replace(/\s+/g, '');
  if (compact.length < minLength || !/\d/.test(compact)) return null;
  return compact;
}

function findLikelyBillReferenceNumber(text: string, provider: BillProviderDefinition | null): string | null {
  if (provider?.canonicalName === 'PLDT') {
    const v = findFirstCaptured(text, [
      /billing\s*invoice(?:\s*no\.?)?\s*[:#-]?\s*([0-9A-Z-]{5,})/i,
      /soa\s*(?:no\.?|number|#)?\s*[:#-]?\s*([0-9A-Z-]{5,})/i,
    ]);
    if (v && sanitizeBillIdentifier(v, 4)) return sanitizeBillIdentifier(v, 4);
  }

  if (provider?.canonicalName === 'Manila Water') {
    // "Invoice No." label in billing information section
    const v = findFirstCaptured(text, [
      /invoice\s*no\.?\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ]);
    if (v && sanitizeBillIdentifier(v, 5)) return sanitizeBillIdentifier(v, 5);
  }

  const byLabel = findCapturedNearLabels(text, ['invoice\\s*(?:no\\.?|number|#)', 'bill\\s*(?:no\\.?|number|#)', 'soa\\s*(?:no\\.?|number|#)', 'ref(?:erence)?\\s*(?:no\\.?|number|#)?'], '([A-Z0-9-]{4,})');
  const normalizedByLabel = sanitizeBillIdentifier(byLabel, 4);
  if (normalizedByLabel) return normalizedByLabel;
  const providerValue = provider ? findFirstCaptured(text, provider.invoiceNumberPatterns) : null;
  const genericValue = findFirstCaptured(text, [
    /(?:invoice\s*(?:no\.?|number|#)|ac{1,2}ount\s*(?:no\.?|number)|service\s*id(?:\s*no\.?)?|soa\s*(?:no\.?|number|#)|statement\s*(?:no\.?|number)|contract\s*ac{1,2}ount\s*(?:no\.?|number)|billing\s*ac{1,2}ount\s*(?:no\.?|number)|reference\s*(?:no\.?|number|#)|ref\s*(?:no\.?|number|#)?|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
  ]);
  return sanitizeBillIdentifier(providerValue || genericValue, 4);
}

function findLikelyBillAccountNumber(text: string, provider: BillProviderDefinition | null): string | null {
  // ── Provider-specific patterns (highest priority) ──────────────────────────

  if (provider?.canonicalName === 'PLDT') {
    const v = findFirstCaptured(text, [
      /ac{1,2}ount\s*(?:no\.?|number)\s*[:#-]?\s*([0-9]{7,})/i,
      /telephone\s*(?:no\.?|number)\s*[:#-]?\s*([0-9]{7,})/i,
      /subscriber\s*(?:no\.?|number)\s*[:#-]?\s*([0-9]{7,})/i,
    ]);
    if (v) return sanitizeBillIdentifier(v, 5);
  }

  if (provider?.canonicalName === 'Meralco') {
    // "Customer Account Number (CAN)" or just "CAN"
    const v = findCapturedNearLabels(text, ['customer\\s*ac{1,2}ount\\s*number\\s*\\(\\s*can\\s*\\)', '\\bcan\\b'], '([A-Z0-9-]{6,})')
      || findFirstCaptured(text, [
        /customer\s*ac{1,2}ount\s*number\s*\(\s*can\s*\)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
        /\bcan\b\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
      ]);
    if (v) return sanitizeBillIdentifier(v);
  }

  if (provider?.canonicalName === 'Manila Water') {
    // "Contract Account Number" or "Contract Acount Number" (OCR typo — one 'c')
    // The value may be on the next line (inside highlighted box)
    const v = findFirstCaptured(text, [
      /contract\s*ac{1,2}ount\s*(?:no\.?|number)?\s*[:#\-]?\s*\n?\s*([0-9]{5,})/i,
      /contract\s*ac{1,2}ount\s*(?:no\.?|number)?\s*[:#\-]?\s*([0-9]{5,})/i,
    ]) || findCapturedNearLabels(text, [
      'contract\\s*ac{1,2}ount\\s*(?:no\\.?|number)?',
    ], '([0-9]{5,})', 300);
    if (v) return sanitizeBillIdentifier(v, 5);

    // Also try "CAN:" on Meralco-style Manila Water bills
    const can = findFirstCaptured(text, [/\bcan\b\s*[:#-]?\s*([0-9]{5,})/i]);
    if (can) return sanitizeBillIdentifier(can, 5);
  }

  if (provider?.canonicalName === 'Converge ICT') {
    const v = findFirstCaptured(text, [
      /ac{1,2}ount\s*no\.?\s*[:#-]?\s*([0-9]{6,})/i,
      /subscriber\s*(?:no\.?|number)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    ]);
    if (v) return sanitizeBillIdentifier(v, 5);
  }

  if (provider?.canonicalName === 'Globe') {
    const v = findFirstCaptured(text, [
      /ac{1,2}ount\s*(?:no\.?|number)\s*[:#-]?\s*([0-9]{6,})/i,
      /subscriber\s*(?:no\.?|number)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    ]);
    if (v) return sanitizeBillIdentifier(v, 5);
  }

  // ── Generic fallback ───────────────────────────────────────────────────────
  const generic = findFirstCaptured(text, [
    /(?:customer\s*ac{1,2}ount\s*number\s*\(\s*can\s*\)|contract\s*ac{1,2}ount\s*(?:no\.?|number)|ac{1,2}ount\s*(?:no\.?|number)|acct\s*(?:no\.?|number)|service\s*id(?:\s*no\.?)?|subscriber\s*(?:no\.?|number)|client\s*id|account\s*id)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
  ]);
  return sanitizeBillIdentifier(generic);
}

function findLikelyServiceAddress(lines: string[]): string | null {
  // 1. Try a labeled address line first (highest confidence)
  const allText = lines.join('\n');
  const labeledMatch = allText.match(
    /(?:service\s*address|installation\s*address|address\s*of\s*service|customer\s*address|billing\s*address|premises\s*address)\s*[:#-]?\s*(.{8,100})/i,
  );
  if (labeledMatch) {
    const candidate = labeledMatch[1].trim();
    if (candidate && !/^(?:n\/?a|none|see\s*above)$/i.test(candidate)) return candidate;
  }

  // 2. Heuristic: scan first 25 lines for an address-looking line,
  //    skipping company header lines (provider names, legal suffixes, etc.)
  const headerLines = lines.slice(0, 25);
  const skipPattern = /invoice|bill|date|route|meter|reading|number|customer\s*account|can|tin|print\s*seq|page\s*\d+|\bcompany\b|\binc\b|\bcorp\b|\bltd\b|co\.\s*inc|water\s*company|electric\s*company|telecom|pldt|meralco|converge|globe/i;
  const addressPattern = /street|st\.?\b|barangay|brgy|city|ave\b|avenue|road|rd\b|subd|subdivision|luzon|metro|blk|lot|sitio/i;
  const candidates = headerLines.map((l) => l.trim()).filter((l) => l.length >= 8).filter((l) => !skipPattern.test(l));
  return candidates.find((l) => addressPattern.test(l)) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Invoice / receipt field helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeOcrText(text: string): string {
  // Apply low-level artifact correction first
  let out = fixOcrArtifacts(text);

  return out
    .replace(/№|Nº|N°/g, ' No ')
    .replace(/[""]/g, '"')
    .replace(/[']/g, "'")
    .replace(/\u00A0/g, ' ')
    // Pipe characters that are NOT inside likely barcode regions → space
    // (barcode suppression already blanks those regions in Python, but stray
    //  pipes still appear in non-barcode content)
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n');
}

function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function findLikelyTotalAmount(text: string, lines: string[]): number | null {
  const direct = findTotalAmountDueLabel(text);
  if (direct !== null) return direct;

  const tagged = findCurrencyTaggedAmount(text);
  if (tagged !== null) return tagged;

  const weighted: Array<{ value: number; weight: number }> = [];

  const bottomLines = lines.slice(Math.max(0, Math.floor(lines.length * 0.65)));
  const bottomLabeledLines = bottomLines.filter((l) => /total|amount\s*due|balance\s*due|net\s*payable|php|₱|\$/i.test(l));

  for (const line of bottomLabeledLines) {
    for (const amount of collectAmounts(line)) {
      weighted.push({ value: amount, weight: 1.15 });
    }
  }
  for (const line of bottomLines) {
    for (const amount of collectAmounts(line)) {
      if (amount >= 10) weighted.push({ value: amount, weight: 0.95 });
    }
  }
  const labeledAnywhere = lines.filter((l) => /total|amount\s*due|balance\s*due|net\s*payable/i.test(l));
  for (const line of labeledAnywhere) {
    for (const amount of collectAmounts(line)) {
      weighted.push({ value: amount, weight: 0.9 });
    }
  }
  const decimalAmounts = [...text.matchAll(/([\d]{1,3}(?:,[\d]{3})*\.\d{1,2})/g)]
    .map((m) => parseAmountToken(m[1]))
    .filter((v): v is number => v !== null && v >= 10);
  if (decimalAmounts.length > 0) weighted.push({ value: Math.max(...decimalAmounts), weight: 0.55 });

  if (!weighted.length) return null;
  weighted.sort((a, b) => b.weight !== a.weight ? b.weight - a.weight : b.value - a.value);
  return weighted[0].value;
}

function findLikelyInvoiceDate(text: string, lines: string[]): string | null {
  const datePattern = /([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i;
  const shortDatePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})\b/;
  const skipContext = /b\.?i\.?r|permit|tin|valid|issued|received|delivered|signature|printed\s*name/i;
  const headerLines = lines.slice(0, 40);

  for (const line of headerLines) {
    if (!/(?:invoice\s*date|\bdate\b|dated)/i.test(line) || skipContext.test(line)) continue;
    const shortM = line.match(shortDatePattern);
    if (shortM) {
      const n = normalizeDate(shortM[1]);
      if (n) return n;
    }
    const m = line.match(datePattern);
    if (m) {
      const n = normalizeDate(m[1]);
      if (n) return n;
    }
  }

  for (const line of headerLines) {
    if (skipContext.test(line)) continue;
    const shortM = line.match(shortDatePattern);
    if (shortM) {
      const n = normalizeDate(shortM[1]);
      if (n) return n;
    }
    const m = line.match(datePattern);
    if (m) {
      const n = normalizeDate(m[1]);
      if (n) return n;
    }
  }

  const fallbackMatches = [...text.matchAll(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})\b/g)];
  for (const m of fallbackMatches) {
    if (skipContext.test(text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + m[0].length + 30))) continue;
    const n = normalizeDate(m[1]);
    if (n) return n;
  }

  return null;
}

/**
 * Apply company-name specific OCR artifact fixes to a raw string.
 * In addition to the global fixes in fixOcrArtifacts, handle the case where
 * Tesseract splits the word "and"/"AND" from a company name and we need to
 * normalise "AND" → "&" for consistent matching.
 *
 * NOTE: We deliberately do NOT blindly replace all "AND" → "&" because many
 * legitimate words contain "and" (e.g. "Standard"). The replacement only
 * fires when "AND" sits between two capitalized words typical of company names.
 */
function sanitizeCompanyName(raw: string): string {
  if (!raw) return raw;
  let out = fixOcrArtifacts(raw);
  // Normalise "8" between word-boundary letters (already handled by fixOcrArtifacts)
  // Also normalise all-caps " AND " between two capitalized tokens → " & "
  out = out.replace(/(?<=[A-Z]{2,}\s)\bAND\b(?=\s[A-Z]{2,})/g, '&');
  return out.trim();
}

function findLikelyVendorName(text: string, lines: string[]): string | null {
  // Voucher payee pattern
  const payeeMatch = text.match(/(?:payee|payor)\s*[:#-]?\s*([^\n\r]{4,80})/i);
  if (payeeMatch?.[1]) {
    const cleaned = sanitizeCompanyName(payeeMatch[1].replace(/\s{2,}.*/, '').replace(/[|]+/g, ' ').trim());
    if (cleaned.length >= 4) return cleaned;
  }

  const labeledPatterns = [
    /(?:sold\s*to|company|customer|billed\s*to|bill\s*to|vendor|supplier|from)\s*[:#-]?\s*([^\n\r]+)/i,
  ];
  const headerText = lines.slice(0, 45).join('\n');
  const labeled = findFirstMatch(headerText, labeledPatterns);
  if (labeled) {
    const cleaned = sanitizeCompanyName(labeled.replace(/\s{2,}.*/g, '').replace(/[|]+/g, ' ').trim());
    if (cleaned && cleaned.length >= 4) return cleaned;
  }

  // Check top lines for company/organization name
  const topLines = lines.slice(0, 10);
  for (const line of topLines) {
    const trimmed = sanitizeCompanyName(line.trim());
    if (trimmed.length < 4) continue;
    if (/invoice|amount|date|bill|voucher|address|terms|salesman|tin|vat|bir/i.test(trimmed)) continue;
    if (/^[A-Z][A-Za-z0-9 .,&'()\-/]+$/.test(trimmed) && trimmed.length >= 5) return trimmed;
  }

  const fallback = lines.slice(0, 35).find((l) =>
    /^[A-Za-z][A-Za-z0-9 .,&'()-]{4,}$/.test(l)
    && !/invoice|amount|date|bill|voucher|stock|description|address|terms|salesman/i.test(l),
  );
  return fallback ? sanitizeCompanyName(fallback) : null;
}

function findLikelyInvoiceNumber(text: string, lines: string[]): string | null {
  const headerText = lines.slice(0, 45).join('\n');

  const phInvoice = findFirstMatch(headerText, [
    /(?:sales\s*invoice|si)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(?:No\.?\s*)?([A-Z0-9\/-]{2,})/i,
    /(?:\binvoice\b|\bsi\b)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(?:No\s*)?([A-Z0-9\/-]{2,})/i,
    /n[o°][\s.:]+([0-9]{3,10})\b/i,
    /(?:\bno\.?|#)\s*[:#-]?\s*(\d{3,10})\b/i,
  ]);
  const normalizedPhInvoice = sanitizeExtractedToken(phInvoice);
  if (normalizedPhInvoice) return normalizedPhInvoice;

  const anywhere = findFirstMatch(text, [
    /(?:\binvoice\b\s*(?:no\.?|number|#)|\bsi\b\s*no\.?|reference\s*(?:no\.?|#)?|ref\s*(?:no\.?|#)?|voucher\s*no\.?|bill\s*no\.?)\s*[:#-]?\s*(?:No\s*)?([A-Z0-9\/-]{2,})/i,
  ]);
  return sanitizeExtractedToken(anywhere);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Confidence / quality estimation
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Number(Math.max(0, Math.min(1, v)).toFixed(2));
}

function estimateDocumentQuality(text: string, lines: string[]): number {
  const compact = text.replace(/\s+/g, '');
  if (!compact.length) return 0;
  const alnumChars = (compact.match(/[A-Za-z0-9]/g) || []).length;
  return clamp01(Math.min(compact.length / 900, 1) * 0.5 + Math.min(lines.length / 45, 1) * 0.2 + (alnumChars / compact.length) * 0.3);
}

function buildConfidenceScores(fields: { total_amount: number | null; invoice_date: string | null; vendor_name: string | null; invoice_number: string | null }, context: { normalizedText: string; lines: string[] }) {
  const docQuality = estimateDocumentQuality(context.normalizedText, context.lines);
  const strongTotal = /(?:grand\s*total|total\s*amount\s*due|total\s*amount|amount\s*due|balance\s*due|net\s*payable|\btotal\b)\s*[:#-]?/i.test(context.normalizedText);
  const strongDate = /(?:invoice\s*date|dated|\bdate\b)\s*[:#-]?/i.test(context.normalizedText);
  const strongVendor = /(?:vendor|supplier|payee|billed\s*by|from)\s*[:#-]?/i.test(context.normalizedText);
  const strongInvoiceNo = /(?:invoice\s*(?:no\.?|number|#)|reference\s*(?:no\.?|#)?|ref\s*(?:no\.?|#)?|voucher\s*no\.?|bill\s*no\.?)\s*[:#-]?/i.test(context.normalizedText);
  return {
    confidence: {
      total_amount: fields.total_amount !== null ? clamp01(0.58 + docQuality * 0.24 + (strongTotal ? 0.14 : 0.04)) : clamp01(0.06 + docQuality * 0.12),
      invoice_date: fields.invoice_date !== null ? clamp01(0.56 + docQuality * 0.22 + (strongDate ? 0.16 : 0.05)) : clamp01(0.05 + docQuality * 0.11),
      vendor_name: fields.vendor_name !== null ? clamp01(0.52 + docQuality * 0.24 + (strongVendor ? 0.14 : 0.06)) : clamp01(0.05 + docQuality * 0.11),
      invoice_number: fields.invoice_number !== null ? clamp01(0.55 + docQuality * 0.23 + (strongInvoiceNo ? 0.15 : 0.05)) : clamp01(0.05 + docQuality * 0.11),
    },
    docQuality,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Spreadsheet / Word helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTextFromSpreadsheet(bytes: Buffer): string {
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const chunks: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    chunks.push(`Sheet: ${sheetName}`);
    chunks.push(XLSX.utils.sheet_to_csv(sheet, { blankrows: false }));
  }
  return chunks.join('\n').trim();
}

async function extractTextFromWord(bytes: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return (result.value || '').trim();
  }
  return bytes.toString('utf8').replace(/\u0000/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tesseract.js (browser/Node) OCR — improved multi-variant pipeline
// ─────────────────────────────────────────────────────────────────────────────

type SharedTesseractWorker = Awaited<ReturnType<typeof createWorker>>;

let sharedTesseractWorkerPromise: Promise<SharedTesseractWorker> | null = null;
let sharedTesseractJobChain: Promise<void> = Promise.resolve();

function getSharedTesseractWorker(): Promise<SharedTesseractWorker> {
  if (!sharedTesseractWorkerPromise) {
    sharedTesseractWorkerPromise = createWorker('eng').catch((error) => {
      sharedTesseractWorkerPromise = null;
      throw error;
    });
  }

  return sharedTesseractWorkerPromise;
}

function runWithSharedTesseractWorker<T>(task: (worker: SharedTesseractWorker) => Promise<T>): Promise<T> {
  const nextJob = sharedTesseractJobChain.then(async () => task(await getSharedTesseractWorker()));
  sharedTesseractJobChain = nextJob.then(() => undefined, () => undefined);
  return nextJob;
}

async function extractTextWithTesseract(bytes: Buffer): Promise<string> {
  return runWithSharedTesseractWorker(async (worker) => {
    const variants: OcrImageVariant[] = [];

    variants.push({ label: 'original', buffer: bytes });

    try {
      const normalized = await sharp(bytes)
        .rotate()
        .grayscale()
        .clahe({ width: 8, height: 8 })
        .normalize()
        .sharpen({ sigma: 1.2 })
        .resize({ width: 2800, withoutEnlargement: true })
        .toBuffer();
      variants.push({ label: 'clahe_normalized', buffer: normalized });
    } catch {
      try {
        const normalized = await sharp(bytes)
          .rotate().grayscale().normalize().sharpen()
          .resize({ width: 2600, withoutEnlargement: true })
          .toBuffer();
        variants.push({ label: 'normalized', buffer: normalized });
      } catch { /* ignore */ }
    }

    try {
      const thresholded = await sharp(bytes)
        .rotate().grayscale().median(1).normalize()
        .threshold(155)
        .resize({ width: 2800, withoutEnlargement: true })
        .toBuffer();
      variants.push({ label: 'thresholded', buffer: thresholded });
    } catch { /* ignore */ }

    try {
      const highContrast = await sharp(bytes)
        .rotate()
        .modulate({ saturation: 0 })
        .linear(1.8, -(128 * 0.8))
        .normalize()
        .resize({ width: 2600, withoutEnlargement: true })
        .toBuffer();
      variants.push({ label: 'high_contrast', buffer: highContrast });
    } catch { /* ignore */ }

    const psmModes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT];
    let bestText = '';
    let bestScore = -1;

    for (const variant of variants) {
      for (const psm of psmModes) {
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: psm,
            preserve_interword_spaces: '1',
          });
          const result = await worker.recognize(variant.buffer);
          const candidateText = (result.data.text || '').trim();
          const score = scoreRecognizedText(candidateText);
          if (score > bestScore) {
            bestScore = score;
            bestText = candidateText;
          }
          if (bestScore > 0.85) break;
        } catch { /* ignore */ }
      }
      if (bestScore > 0.85) break;
    }

    return bestText;
  });
}

function scoreRecognizedText(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  const compact = trimmed.replace(/\s+/g, '');
  if (!compact) return 0;
  const lengthScore = Math.min(compact.length / 1200, 1);
  const lineScore = Math.min(trimmed.split(/\r?\n/).filter(Boolean).length / 40, 1);
  const alphaNumRatio = (compact.match(/[A-Za-z0-9]/g) || []).length / compact.length;
  const keywords = ['invoice', 'amount', 'total', 'date', 'tin', 'vat', 'php', 'peso', 'billing', 'due'];
  const kwBonus = keywords.filter((k) => trimmed.toLowerCase().includes(k)).length / keywords.length;
  return lengthScore * 0.45 + lineScore * 0.15 + alphaNumRatio * 0.25 + kwBonus * 0.15;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main extraction logic
// ─────────────────────────────────────────────────────────────────────────────

function extractFromText(text: string, context: { documentTypeHint?: string } = {}): ExtractionResult {
  // Apply OCR artifact corrections before any other processing
  const correctedText = fixOcrArtifacts(text);
  const normalizedText = normalizeOcrText(correctedText);
  const normalizedLines = normalizedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const billHint = isLikelyBillDocument(context.documentTypeHint);
  const voucherHint = isLikelyVoucherDocument(context.documentTypeHint);
  const detectedProvider = detectBillProvider(normalizedText);

  const billTotalAmount = billHint || detectedProvider ? findLikelyBillAmount(normalizedText, detectedProvider) : null;
  const billDate = billHint || detectedProvider ? findLikelyBillDate(normalizedText, detectedProvider) : null;
  const billReferenceNumber = billHint || detectedProvider ? findLikelyBillReferenceNumber(normalizedText, detectedProvider) : null;
  const billAccountNumber = billHint || detectedProvider ? findLikelyBillAccountNumber(normalizedText, detectedProvider) : null;
  const billPeriod = billHint || detectedProvider ? findLikelyBillingPeriod(normalizedText) : { start: null, end: null };
  const billDueDate = billHint || detectedProvider
    ? normalizeBillDate(
      findCapturedNearLabels(normalizedText, ['due\\s*date', 'payment\\s*due'], DATE_CAPTURE_PATTERN, 400)
      || findFirstCaptured(normalizedText, [/(?:due\s*date|payment\s*due)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i])
      || '',
    )
    : null;
  const billServiceAddress = billHint || detectedProvider ? findLikelyServiceAddress(normalizedLines) : null;
  const utilityClassification = billHint || detectedProvider
    ? detectUtilityClassification(normalizedText, detectedProvider)
    : { utility_type: null, utility_provider: null };

  const total_amount = billTotalAmount ?? findLikelyTotalAmount(normalizedText, normalizedLines);
  const invoice_date = (billHint || detectedProvider)
    ? (billDate ?? billPeriod.end ?? billPeriod.start ?? null)
    : findLikelyInvoiceDate(normalizedText, normalizedLines);
  const vendor_name = detectedProvider?.canonicalName ?? findLikelyVendorName(normalizedText, normalizedLines);

  const invoice_number = voucherHint
    ? (findFirstCaptured(normalizedText, [/(?:voucher|check\s*voucher|cv)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(\d{2,})/i])
      || billReferenceNumber
      || findLikelyInvoiceNumber(normalizedText, normalizedLines))
    : (billReferenceNumber ?? billAccountNumber ?? findLikelyInvoiceNumber(normalizedText, normalizedLines));

  const { confidence, docQuality } = buildConfidenceScores(
    { total_amount, invoice_date, vendor_name, invoice_number },
    { normalizedText, lines: normalizedLines },
  );

  const warnings: string[] = [];
  if (total_amount === null) warnings.push('Local OCR could not confidently find total amount.');
  if (invoice_date === null) warnings.push('Local OCR could not confidently find invoice date.');
  if (vendor_name === null) warnings.push('Local OCR could not confidently find vendor/supplier name.');
  if (invoice_number === null) warnings.push('Local OCR could not confidently find invoice/reference number.');
  if (docQuality < 0.35) warnings.push('Document readability is low. Use a clearer scan for better OCR quality.');

  return {
    data: {
      total_amount,
      invoice_date,
      vendor_name,
      invoice_number,
      account_number: billAccountNumber,
      billing_period_start: billPeriod.start,
      billing_period_end: billPeriod.end,
      due_date: billDueDate,
      service_address: billServiceAddress,
      utility_type: utilityClassification.utility_type,
      utility_provider: utilityClassification.utility_provider,
    },
    confidence,
    warnings,
  };
}

export function extractFromRawText(text: string, context: { documentTypeHint?: string } = {}): ExtractionResult {
  return extractFromText(text, context);
}

export async function extractWithLocalOcr(candidate: {
  mimeType: string;
  bytes: Buffer;
  documentTypeHint?: string;
}): Promise<ExtractionResult> {
  let rawText = '';
  const extractionWarnings: string[] = [];

  if (candidate.mimeType === 'application/pdf') {
    const parsed = await pdfParse(candidate.bytes);
    rawText = parsed.text || '';
    if (rawText.replace(/\s+/g, '').length < 40) {
      try {
        const rasterizedPage = await sharp(candidate.bytes, { density: 250 })
          .png({ quality: 100 })
          .toBuffer();
        const tesseractText = await extractTextWithTesseract(rasterizedPage);
        if (tesseractText.trim()) {
          rawText = tesseractText;
          extractionWarnings.push('PDF text layer is weak. Applied local OCR on rasterized document image.');
        }
      } catch {
        extractionWarnings.push('PDF appears image-based and OCR fallback rasterization failed.');
      }
    }
  } else if (
    candidate.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    candidate.mimeType === 'application/vnd.ms-excel'
  ) {
    rawText = extractTextFromSpreadsheet(candidate.bytes);
  } else if (
    candidate.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    candidate.mimeType === 'application/msword'
  ) {
    rawText = await extractTextFromWord(candidate.bytes, candidate.mimeType);
  } else {
    rawText = await extractTextWithTesseract(candidate.bytes);
  }

  const extracted = extractFromRawText(rawText, { documentTypeHint: candidate.documentTypeHint });
  const shouldAddHeuristicWarning = extracted.warnings.length > 0;

  return {
    ...extracted,
    warnings: shouldAddHeuristicWarning
      ? [...extractionWarnings, ...extracted.warnings, 'Extracted using local OCR heuristic mode. Review values carefully.']
      : [...extractionWarnings, ...extracted.warnings],
  };
}