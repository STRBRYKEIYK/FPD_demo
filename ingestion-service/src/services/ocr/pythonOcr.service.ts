import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface, type Interface as ReadLineInterface } from 'node:readline';
import { promisify } from 'node:util';
import type { ExtractionResult, IngestionCandidate, OcrToken } from '../../types/shared.js';
import { extractFromRawText } from './localOcr.service.js';

const execFileAsync = promisify(execFile);

type PythonOcrToken = {
  word: string;
  confidence?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  polygon?: number[][];
};

type PythonOcrResponse = {
  ok: boolean;
  text?: string;
  tokens?: PythonOcrToken[];
  warnings?: string[];
  error?: string;
};

type PersistentWorkerResponse = {
  id?: string;
  ok?: boolean;
  result?: PythonOcrResponse;
  error?: string;
};

type PendingWorkerRequest = {
  resolve: (value: PythonOcrResponse) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
};

type PersistentWorkerState = {
  process: ChildProcessWithoutNullStreams;
  stdout: ReadLineInterface;
  pending: Map<string, PendingWorkerRequest>;
};

let persistentWorker: PersistentWorkerState | null = null;
let persistentWorkerStartup: Promise<PersistentWorkerState> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
//  OCR artifact helpers (mirrors fixes in localOcr.service.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fix '8' → '&' between letter-words in a company / payee name string.
 * Also normalise all-caps "AND" between two all-caps words → "&".
 */
function fixCompanyNameArtifacts(raw: string): string {
  if (!raw) return raw;
  // '8' between two letter sequences → '&'
  let out = raw.replace(/(?<=[A-Za-z]{2,} )8(?= [A-Za-z]{2,})/g, '&');
  // All-caps "AND" between capitalised words → '&'
  out = out.replace(/(?<=[A-Z]{2,}\s)\bAND\b(?=\s[A-Z]{2,})/g, '&');
  // Strip invisible / problematic characters
  out = out.replace(/[\u200b\u200c\u200d\ufeff\u00ad©®™]/g, '');
  return out.trim();
}

/** Normalise an organisation name token: allow & and standard punctuation. */
function normalizeOrganizationToken(token: string): string {
  // Allow letters, digits, & . , ' ( ) - / space
  return fixCompanyNameArtifacts(
    String(token || '').replace(/[^A-Za-z0-9&.,'()\-/\s]/g, '').replace(/\s+/g, ' ').trim(),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Token guards
// ─────────────────────────────────────────────────────────────────────────────

function isBarcodeNoiseToken(word: string): boolean {
  if (word.length < 4) return false;
  const stripped = word.replace(/[|IIl1!]/g, '');
  if (stripped.length === 0 && word.length >= 6) return true;
  if (stripped.length <= 1 && word.length >= 8) return true;
  return false;
}

function normalizePythonTokens(tokens: PythonOcrToken[] | undefined): OcrToken[] {
  if (!Array.isArray(tokens)) return [];
  return tokens
    .map((token) => {
      const word = String(token.word || '').trim();
      if (!word || isBarcodeNoiseToken(word)) return null;
      const x = Number.isFinite(token.x) ? Number(token.x) : 0;
      const y = Number.isFinite(token.y) ? Number(token.y) : 0;
      const width = Number.isFinite(token.width) ? Number(token.width) : 0;
      const height = Number.isFinite(token.height) ? Number(token.height) : 0;
      const confidenceRaw = Number.isFinite(token.confidence) ? Number(token.confidence) : 0;
      const confidence = Math.max(0, Math.min(confidenceRaw, 1));
      const polygon: [number, number][] = Array.isArray(token.polygon) && token.polygon.length === 4
        ? token.polygon.map((pair) => [Number(pair?.[0] || 0), Number(pair?.[1] || 0)] as [number, number])
        : [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
      return { word, confidence: Number(confidence.toFixed(4)), x, y, width, height, polygon } satisfies OcrToken;
    })
    .filter((token): token is OcrToken => token !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Type checks
// ─────────────────────────────────────────────────────────────────────────────

function isImageMimeType(mimeType: string): boolean {
  return mimeType === 'image/jpeg' || mimeType === 'image/png';
}

function extensionFromMimeType(mimeType: string): string {
  return mimeType === 'image/png' ? '.png' : '.jpg';
}

function scriptPathFromEnv(): string {
  const envPath = process.env.OCR_PYTHON_SCRIPT?.trim();
  return envPath || path.resolve(process.cwd(), 'python', 'ocr_worker.py');
}

function isLikelyBillDocument(documentTypeHint?: string): boolean {
  const n = (documentTypeHint || '').trim().toLowerCase();
  return n === 'bill' || n === 'monthly_bill' || n.includes('utility');
}

function isLikelyInvoiceOrReceiptDocument(documentTypeHint?: string): boolean {
  const n = (documentTypeHint || '').trim().toLowerCase();
  if (!n) return true;
  return ['invoice', 'receipt', 'official_receipt', 'official-receipt', 'sales_invoice', 'sales-invoice'].some((h) => n.includes(h));
}

function isLikelyVoucherDocument(documentTypeHint?: string): boolean {
  const n = (documentTypeHint || '').trim().toLowerCase();
  return ['voucher', 'cash_voucher', 'cash-voucher', 'check_voucher', 'check-voucher', 'payment_voucher', 'payment-voucher'].some((h) => n.includes(h));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Date / amount token normalizers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDateFromParts(dayToken: string, monthToken: string, yearToken: string, minYear = 2000): string | null {
  const day = Number(dayToken.replace(/\D/g, ''));
  const year = Number(yearToken.replace(/\D/g, ''));
  // Keep the full lowercase word — full month names like "February" must work.
  const monthRaw = monthToken.trim().toLowerCase().replace(/[^a-z]/g, '');
  const monthMap: Record<string, number> = {
    // 3-char abbreviations (most common in PH bills)
    jan: 1, feb: 2, mar: 3, mch: 3, apr: 4, may: 5,
    jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    // Full month names — "February 21, 2026" style (PLDT payment stub, Manila Water)
    january: 1, february: 2, march: 3, april: 4,
    june: 6, july: 7, august: 8, september: 9,
    october: 10, november: 11, december: 12,
  };
  // Try the full key first, then fall back to the first 3 chars (handles "Sept" → "sep").
  const month = monthMap[monthRaw] ?? monthMap[monthRaw.slice(0, 3)];
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  if (day < 1 || day > 31) return null;
  const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
  if (fullYear < minYear || fullYear > new Date().getFullYear() + 1) return null;
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeNumericDateToken(token: string, minYear = 2000): string | null {
  const cleaned = token.replace(/[^\d/-]/g, '');
  const parts = cleaned.split(/[/-]/).filter(Boolean);
  if (parts.length !== 3) return null;
  let first = Number(parts[0]);
  let second = Number(parts[1]);
  let year = Number(parts[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return null;
  if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;
  if (year < minYear || year > new Date().getFullYear() + 1) return null;
  let month = first, day = second;
  if (first > 12 && second <= 12) { day = first; month = second; }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeAmountToken(token: string): number | null {
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

function looksLikeIdentifierToken(word: string): boolean {
  const stripped = word.replace(/[,\s]/g, '');
  return /^\d+$/.test(stripped) && stripped.length >= 8;
}

function normalizeIdentifierToken(token: string, minLength = 4): string | null {
  const raw = (token || '').trim();
  if (!raw) return null;
  // Reject tokens that look like currency amounts BEFORE stripping punctuation:
  // e.g. "1,388.00", "112.90", "1,511.90" — these are charges, not identifiers.
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(raw) || /^\d+\.\d{2}$/.test(raw)) return null;
  const cleaned = raw.replace(/^[:#\-\s]+/g, '').replace(/[:#\-\s]+$/g, '').replace(/[^A-Za-z0-9\/-]/g, '');
  if (cleaned.length < minLength || !/\d/.test(cleaned)) return null;
  // Reject date-shaped tokens
  if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleaned)) return null;
  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Token-level spatial helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether a token word matches a label pattern.
 *
 * Strips non-alpha characters so that "No.", "No:", "No" all match /^no$/i,
 * and "Account" / "Acount" (OCR typo — one c) both match /^ac{1,2}ount$/i.
 */
function matchesLabel(word: string, pattern: RegExp): boolean {
  return pattern.test(word.replace(/[^A-Za-z]/g, ''));
}

function findAnchor(tokens: OcrToken[], first: RegExp, second: RegExp): { x: number; y: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!matchesLabel(token.word, first)) continue;
    const nearby = tokens.find((c) =>
      matchesLabel(c.word, second)
      && Math.abs(c.y - token.y) <= 35
      && c.x >= token.x
      && c.x - token.x <= 420,
    );
    if (nearby) return { x: token.x, y: Math.min(token.y, nearby.y) };
  }
  return null;
}

function findSingleAnchor(tokens: OcrToken[], pattern: RegExp): { x: number; y: number } | null {
  for (const token of tokens) {
    if (matchesLabel(token.word, pattern)) return { x: token.x, y: token.y };
  }
  return null;
}

/**
 * Find a three-word label anchor: first + second + third consecutive tokens
 * on approximately the same line, returning the position of the first token.
 */
function findThreeWordAnchor(
  tokens: OcrToken[],
  first: RegExp,
  second: RegExp,
  third: RegExp,
): { x: number; y: number } | null {
  for (let i = 0; i < tokens.length - 2; i++) {
    const t0 = tokens[i];
    if (!matchesLabel(t0.word, first)) continue;
    const t1 = tokens.find((c, j) =>
      j > i
      && matchesLabel(c.word, second)
      && Math.abs(c.y - t0.y) <= 35
      && c.x > t0.x
      && c.x - t0.x <= 500,
    );
    if (!t1) continue;
    const t2 = tokens.find((c, j) =>
      j > i
      && matchesLabel(c.word, third)
      && Math.abs(c.y - t0.y) <= 35
      && c.x > t1.x,
    );
    if (t2) return { x: t0.x, y: t0.y };
  }
  return null;
}

function findDateNearAnchor(tokens: OcrToken[], anchor: { x: number; y: number }, minYear = 2000): string | null {
  const candidates = tokens
    .filter((t) => t.y >= anchor.y && t.y <= anchor.y + 220)
    .filter((t) => t.x >= anchor.x - 300 && t.x <= anchor.x + 900)
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);

  for (const c of candidates) {
    const d = normalizeNumericDateToken(c.word, minYear);
    if (d) return d;
  }

  for (let i = 0; i < candidates.length - 2; i++) {
    const [a, b, c] = [candidates[i]?.word || '', candidates[i + 1]?.word || '', candidates[i + 2]?.word || ''];
    if (!/^\d{1,2}$/.test(a.replace(/\D/g, ''))) continue;
    if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(b)) continue;
    if (!/^\d{2,4}$/.test(c.replace(/\D/g, ''))) continue;
    const n = normalizeDateFromParts(a, b, c, minYear);
    if (n) return n;
  }
  return null;
}

/**
 * Find an identifier token near an anchor position.
 * Expanded ignored-words list covers common OCR label fragments that would
 * otherwise be misidentified as account/reference numbers.
 */
function findIdentifierNearAnchor(tokens: OcrToken[], anchor: { x: number; y: number }, minLength = 4): string | null {
  const ignored = /^(account|acoount|acount|acct|number|no|ref|reference|soa|statement|contract|subscriber|invoice|billing|customer|telephone|service)$/i;
  const candidates = tokens
    .filter((t) => t.y >= anchor.y - 25 && t.y <= anchor.y + 260)
    .filter((t) => t.x >= anchor.x - 30 && t.x <= anchor.x + 1100)
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .filter((t) => !ignored.test(t.word.replace(/[^A-Za-z]/g, '').toLowerCase()))
    .map((t) => ({ value: normalizeIdentifierToken(t.word, minLength), confidence: t.confidence, length: t.word.length }))
    .filter((item): item is { value: string; confidence: number; length: number } => item.value !== null);

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.confidence !== a.confidence ? b.confidence - a.confidence : b.length - a.length);
  return candidates[0].value;
}

function findIdentifierSameLineAfterAnchor(tokens: OcrToken[], anchor: { x: number; y: number }, minLength = 4): string | null {
  return tokens
    .filter((t) => Math.abs(t.y - anchor.y) <= 28 && t.x >= anchor.x && t.x <= anchor.x + 1200)
    .sort((a, b) => a.x - b.x)
    .map((t) => normalizeIdentifierToken(t.word, minLength))
    .find((v): v is string => v !== null) ?? null;
}

function findBillingPeriodNearAnchor(tokens: OcrToken[], anchor: { x: number; y: number }): { start: string | null; end: string | null } {
  const candidates = tokens
    .filter((t) => t.y >= anchor.y && t.y <= anchor.y + 260)
    .filter((t) => t.x >= anchor.x - 50 && t.x <= anchor.x + 1300)
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);

  const found: string[] = [];
  for (let i = 0; i < candidates.length - 2; i++) {
    const [a, b, c] = [candidates[i]?.word || '', candidates[i + 1]?.word || '', candidates[i + 2]?.word || ''];
    if (!/^\d{1,2}$/.test(a.replace(/\D/g, ''))) continue;
    if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(b)) continue;
    if (!/^\d{4}$/.test(c.replace(/\D/g, ''))) continue;
    const n = normalizeDateFromParts(a, b, c, 2015);
    if (n && !found.includes(n)) { found.push(n); if (found.length >= 2) break; }
  }
  return { start: found[0] || null, end: found[1] || null };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOTAL AMOUNT DUE — token-level (highest priority)
// ─────────────────────────────────────────────────────────────────────────────

function findTotalAmountDueAnchor(tokens: OcrToken[]): { x: number; y: number } | null {
  for (const t of tokens) {
    if (/total\s*amount\s*due/i.test(t.word)) return { x: t.x, y: t.y };
  }
  const pleasePay = findAnchor(tokens, /^please$/i, /^pay$/i);
  if (pleasePay) return pleasePay;

  for (let i = 0; i < tokens.length; i++) {
    if (!/^total$/i.test(tokens[i].word.replace(/[^A-Za-z]/g, ''))) continue;
    const totalToken = tokens[i];
    const amountToken = tokens.find((t, j) =>
      j > i && /^amount$/i.test(t.word.replace(/[^A-Za-z]/g, ''))
      && Math.abs(t.y - totalToken.y) <= 30 && t.x > totalToken.x && t.x - totalToken.x <= 500,
    );
    if (!amountToken) continue;
    const dueToken = tokens.find((t, j) =>
      j > i && /^due$/i.test(t.word.replace(/[^A-Za-z]/g, ''))
      && Math.abs(t.y - totalToken.y) <= 30 && t.x > amountToken.x,
    );
    if (dueToken || amountToken) return { x: totalToken.x, y: totalToken.y };
  }
  return findAnchor(tokens, /^amount$/i, /^due$/i);
}

function findTotalAmountNearAnchor(tokens: OcrToken[], anchor: { x: number; y: number }): number | null {
  const candidates = tokens
    .filter((t) => t.y >= anchor.y - 10 && t.y <= anchor.y + 120)
    .filter((t) => t.x > anchor.x)
    .filter((t) => !looksLikeIdentifierToken(t.word))
    .sort((a, b) => a.y === b.y ? b.x - a.x : a.y - b.y);

  for (const t of candidates) {
    if (t.word.includes('.')) {
      const amount = normalizeAmountToken(t.word);
      if (amount !== null && amount >= 1) return amount;
    }
  }
  for (const t of candidates) {
    const amount = normalizeAmountToken(t.word);
    if (amount !== null && amount >= 1) return amount;
  }
  return null;
}

function findAmountNearAnchor(tokens: OcrToken[], anchor: { x: number; y: number }): number | null {
  const parsedAmounts = tokens
    .filter((t) => t.y >= anchor.y - 20 && t.y <= anchor.y + 280)
    .filter((t) => t.x >= anchor.x - 80)
    .filter((t) => !looksLikeIdentifierToken(t.word))
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((t) => normalizeAmountToken(t.word))
    .filter((v): v is number => v !== null && v >= 10);
  return parsedAmounts.length > 0 ? Math.max(...parsedAmounts) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Voucher-specific extraction
// ─────────────────────────────────────────────────────────────────────────────

function findLikelyVoucherTotalFromTokens(tokens: OcrToken[]): number | null {
  const amountAnchor = findSingleAnchor(tokens, /^amount$/i);
  if (amountAnchor) {
    const v = findAmountNearAnchor(tokens, amountAnchor);
    if (v) return v;
  }
  const pageMaxX = tokens.reduce((max, t) => Math.max(max, t.x + t.width), 0);
  const rightThreshold = pageMaxX > 0 ? pageMaxX * 0.55 : 0;
  const rightCandidates = tokens
    .filter((t) => t.y >= 80 && t.x >= rightThreshold && !looksLikeIdentifierToken(t.word))
    .map((t) => normalizeAmountToken(t.word))
    .filter((v): v is number => v !== null && v >= 10);
  if (rightCandidates.length) return Math.max(...rightCandidates);
  const allCandidates = tokens
    .filter((t) => t.y >= 120 && !looksLikeIdentifierToken(t.word))
    .map((t) => normalizeAmountToken(t.word))
    .filter((v): v is number => v !== null && v >= 10);
  return allCandidates.length > 0 ? Math.max(...allCandidates) : null;
}

/**
 * Extract voucher payee name from tokens positioned right of the "PAYEE" label.
 * Applies company-name artifact correction (8 → &, AND → &).
 */
function findVoucherPayeeFromTokens(tokens: OcrToken[]): string | null {
  const payeeAnchor = findSingleAnchor(tokens, /^payee$/i)
    || findAnchor(tokens, /^company$/i, /^payee$/i)
    || findAnchor(tokens, /^payor$/i, /^payee$/i);
  if (!payeeAnchor) return null;

  const stopLabels = /^(date|particulars|amount|check|voucher|no|number)$/i;
  const lineTokens = tokens
    .filter((t) => Math.abs(t.y - payeeAnchor.y) <= 42)
    .filter((t) => t.x > payeeAnchor.x + 40 && t.x <= payeeAnchor.x + 1700)
    .sort((a, b) => a.x - b.x);

  const words: string[] = [];
  for (const t of lineTokens) {
    const cleaned = normalizeOrganizationToken(t.word);
    if (!cleaned) continue;
    if (stopLabels.test(cleaned.replace(/[^A-Za-z]/g, ''))) break;
    words.push(cleaned);
    if (words.length >= 14) break;
  }
  const candidate = fixCompanyNameArtifacts(words.join(' ').replace(/\s{2,}/g, ' ').trim());
  return candidate.length >= 6 ? candidate : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utility provider inference
// ─────────────────────────────────────────────────────────────────────────────

function detectUtilityProviderFromContext(
  tokens: OcrToken[],
  existingVendorName?: string | null,
  rawText?: string,
): { provider: string | null; utilityType: 'internet' | 'water' | 'electricity' | null } {
  const blob = `${tokens.map((t) => t.word).join(' ')} ${existingVendorName || ''} ${rawText || ''}`.toLowerCase();
  if (/\bconverge\b|converge\s*ict/.test(blob)) return { provider: 'Converge ICT', utilityType: 'internet' };
  if (/\bpldt\b|philippine\s*long\s*distance/.test(blob)) return { provider: 'PLDT', utilityType: 'internet' };
  if (/\bglobe\b|globe\s*telecom/.test(blob)) return { provider: 'Globe', utilityType: 'internet' };
  if (/\bmeralco\b|manila\s*electric/.test(blob)) return { provider: 'Meralco', utilityType: 'electricity' };
  if (/manila\s*water/.test(blob)) return { provider: 'Manila Water', utilityType: 'water' };
  // Heuristic PLDT detection
  const pldtScore = [/telephone\s*number/, /billing\s*invoice/, /my\s*home/, /pay\s*express/, /pld[ti1]/]
    .reduce((s, p) => s + (p.test(blob) ? 1 : 0), 0);
  if (pldtScore >= 2) return { provider: 'PLDT', utilityType: 'internet' };
  return { provider: null, utilityType: null };
}

function isNoiseVendorName(value: string | null | undefined): boolean {
  const n = String(value || '').trim().toLowerCase();
  if (!n || n.length <= 4) return true;
  if (/tin\s*no|no\s*tin\s*provided|account\s*number|billing\s*information|invoice\s*no|due\s*date/.test(n)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Date fallback helpers
// ─────────────────────────────────────────────────────────────────────────────

function findTopAreaDate(tokens: OcrToken[], minYear = 2000): string | null {
  const top = tokens.filter((t) => t.y <= 520).sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
  for (const t of top) {
    const d = normalizeNumericDateToken(t.word, minYear);
    if (d) return d;
  }
  for (let i = 0; i < top.length - 2; i++) {
    const [a, b, c] = [top[i]?.word || '', top[i + 1]?.word || '', top[i + 2]?.word || ''];
    if (!/^[\d\W]{1,4}\d{1,2}$/.test(a)) continue;
    if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(b)) continue;
    if (!/^[\d\W]*\d{4}$/.test(c)) continue;
    const n = normalizeDateFromParts(a, b, c, minYear);
    if (n) return n;
  }
  return null;
}

function findDateInRawText(rawText: string | undefined, minYear = 2000): string | null {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const numericMatches = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) || [];
  for (const m of numericMatches) {
    const n = normalizeNumericDateToken(m, minYear);
    if (n) return n;
  }
  const dayMonthYear = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,./-]*\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,./-]*\s*(\d{2,4})\b/gi;
  let m = dayMonthYear.exec(text);
  while (m) {
    const n = normalizeDateFromParts(m[1], m[2], m[3], minYear);
    if (n) return n;
    m = dayMonthYear.exec(text);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Enrichment: bill fields from tokens
// ─────────────────────────────────────────────────────────────────────────────

function enrichBillDatesFromTokens(extracted: ExtractionResult, tokens: OcrToken[], rawText?: string): ExtractionResult {
  const d = { ...extracted.data };
  const inferred = detectUtilityProviderFromContext(tokens, d.vendor_name, rawText);

  if (!d.utility_provider && inferred.provider) d.utility_provider = inferred.provider;
  if (!d.utility_type && inferred.utilityType) d.utility_type = inferred.utilityType;
  // When we can positively identify a utility provider (PLDT, Meralco, etc.),
  // always use the canonical name — heuristic text extraction often picks up
  // bill body copy (e.g. "Balance from Previous invoice...") instead of the
  // provider name, and isNoiseVendorName() can't detect all such cases.
  if (inferred.provider) d.vendor_name = inferred.provider;

  // ── TOTAL AMOUNT DUE ──────────────────────────────────────────────────────
  const tadAnchor = findTotalAmountDueAnchor(tokens);
  if (tadAnchor) {
    const amount = findTotalAmountNearAnchor(tokens, tadAnchor);
    if (amount !== null && (d.total_amount === null || d.total_amount === undefined || Math.abs(amount - Number(d.total_amount)) > 0.01)) {
      d.total_amount = amount;
    }
  }

  // ── DUE DATE ──────────────────────────────────────────────────────────────
  const dueAnchor = findAnchor(tokens, /^due$/i, /^date$/i);
  if (!d.due_date && dueAnchor) d.due_date = findDateNearAnchor(tokens, dueAnchor, 2015);

  // ── BILL / INVOICE DATE ───────────────────────────────────────────────────
  const billDateAnchor = findAnchor(tokens, /^bill$/i, /^(dat|date)$/i);
  if (!d.invoice_date && billDateAnchor) d.invoice_date = findDateNearAnchor(tokens, billDateAnchor, 2015);

  const billingPeriodAnchor = findAnchor(tokens, /^billing$/i, /^period$/i);
  if (billingPeriodAnchor) {
    const period = findBillingPeriodNearAnchor(tokens, billingPeriodAnchor);
    if (!d.billing_period_start) d.billing_period_start = period.start;
    if (!d.billing_period_end) d.billing_period_end = period.end;
    if (!d.invoice_date) d.invoice_date = period.end || period.start;
  }

  if (!d.invoice_date) {
    const invoiceDateAnchor = findAnchor(tokens, /^invoice$/i, /^date$/i);
    if (invoiceDateAnchor) d.invoice_date = findDateNearAnchor(tokens, invoiceDateAnchor, 2015);
  }

  // ── ACCOUNT NUMBER ────────────────────────────────────────────────────────
  if (!d.account_number) {
    // Manila Water: "Contract Account Number" or "Contract Acount Number" (OCR typo)
    // Try the three-word anchor first, then fall back to two-word.
    const contractAnchor =
      findThreeWordAnchor(tokens, /^contract$/i, /^ac{1,2}ount$/i, /^number$/i) ||
      findAnchor(tokens, /^contract$/i, /^ac{1,2}ount$/i);
    if (contractAnchor) {
      d.account_number =
        findIdentifierSameLineAfterAnchor(tokens, contractAnchor, 5) ||
        findIdentifierNearAnchor(tokens, contractAnchor, 5);
    }
  }

  if (!d.account_number) {
    // "Customer Account Number (CAN)" — Meralco style
    const canAnchor =
      findAnchor(tokens, /^customer$/i, /^ac{1,2}ount$/i) ||
      findSingleAnchor(tokens, /^can$/i);
    if (canAnchor) {
      d.account_number =
        findIdentifierSameLineAfterAnchor(tokens, canAnchor, 6) ||
        findIdentifierNearAnchor(tokens, canAnchor, 6);
    }
  }

  if (!d.account_number) {
    // Generic: "Account No" / "Account Number" / "Telephone Number" / "Subscriber"
    const accountAnchor =
      findAnchor(tokens, /^ac{1,2}ount$/i, /^(no|number)$/i) ||
      findSingleAnchor(tokens, /^ac{1,2}ount$|^acct$/i) ||
      findAnchor(tokens, /^telephone$/i, /^number$/i) ||
      findSingleAnchor(tokens, /^subscriber$/i);
    if (accountAnchor) {
      d.account_number =
        findIdentifierSameLineAfterAnchor(tokens, accountAnchor, 6) ||
        findIdentifierNearAnchor(tokens, accountAnchor, 6);
    }
  }

  // ── INVOICE / REFERENCE NUMBER ────────────────────────────────────────────
  if (!d.invoice_number) {
    // "Billing Invoice" — PLDT style
    const billingInvoiceAnchor = findAnchor(tokens, /^billing$/i, /^invoice$/i);
    if (billingInvoiceAnchor) {
      d.invoice_number =
        findIdentifierSameLineAfterAnchor(tokens, billingInvoiceAnchor, 4) ||
        findIdentifierNearAnchor(tokens, billingInvoiceAnchor, 4);
    }
  }

  if (!d.invoice_number) {
    // SOA / Reference / Statement — generic
    const invoiceAnchor =
      findSingleAnchor(tokens, /^soa$/i) ||
      findAnchor(tokens, /^ref(?:erence)?$/i, /^(no|number)$/i) ||
      findSingleAnchor(tokens, /^statement$/i) ||
      // "Invoice No." standalone
      findAnchor(tokens, /^invoice$/i, /^(no|number)$/i);
    if (invoiceAnchor) {
      d.invoice_number =
        findIdentifierSameLineAfterAnchor(tokens, invoiceAnchor, 4) ||
        findIdentifierNearAnchor(tokens, invoiceAnchor, 4);
    }
  }

  // Last resort: if no invoice number but account number found, use account number
  if (!d.invoice_number && d.account_number) d.invoice_number = d.account_number;

  return { ...extracted, data: d };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Enrichment: voucher fields from tokens
// ─────────────────────────────────────────────────────────────────────────────

function enrichVoucherFieldsFromTokens(extracted: ExtractionResult, tokens: OcrToken[], rawText?: string): ExtractionResult {
  const d = { ...extracted.data };

  // Date
  if (!d.invoice_date) {
    const dateAnchor =
      findAnchor(tokens, /^voucher$/i, /^date$/i) ||
      findAnchor(tokens, /^check$/i, /^voucher$/i) ||
      findSingleAnchor(tokens, /^date$/i);
    if (dateAnchor) d.invoice_date = findDateNearAnchor(tokens, dateAnchor, 2000);
  }
  if (!d.invoice_date) d.invoice_date = findTopAreaDate(tokens, 2000);
  if (!d.invoice_date) d.invoice_date = findDateInRawText(rawText, 2000);

  // Amount
  const tokenAmount = findLikelyVoucherTotalFromTokens(tokens);
  const hasTotalWarning = extracted.warnings.some((w) => w === 'Local OCR could not confidently find total amount.');
  if (tokenAmount !== null) {
    if (d.total_amount === null || d.total_amount === undefined || hasTotalWarning || tokenAmount > Number(d.total_amount || 0) * 1.3) {
      d.total_amount = tokenAmount;
    }
  }

  // Payee — with company-name artifact correction applied inside findVoucherPayeeFromTokens
  const tokenPayee = findVoucherPayeeFromTokens(tokens);
  if (tokenPayee) d.vendor_name = tokenPayee;

  // Voucher number
  if (!d.invoice_number) {
    const cvAnchor =
      findAnchor(tokens, /^check$/i, /^voucher$/i) ||
      findSingleAnchor(tokens, /^voucher$/i) ||
      findAnchor(tokens, /^voucher$/i, /^(no|number|#)$/i);
    if (cvAnchor) {
      d.invoice_number =
        findIdentifierSameLineAfterAnchor(tokens, cvAnchor, 1) ||
        findIdentifierNearAnchor(tokens, cvAnchor, 1);
    }
  }

  return { ...extracted, data: d };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Enrichment: invoice / receipt date from tokens
// ─────────────────────────────────────────────────────────────────────────────

function enrichInvoiceOrReceiptDateFromTokens(extracted: ExtractionResult, tokens: OcrToken[]): ExtractionResult {
  if (extracted.data.invoice_date) return extracted;
  const d = { ...extracted.data };

  const anchors: Array<{ first: RegExp; second: RegExp }> = [
    { first: /^invoice$/i, second: /^date$/i },
    { first: /^bill$/i, second: /^(date|dat)$/i },
    { first: /^receipt$/i, second: /^date$/i },
    { first: /^dated$/i, second: /^on$/i },
  ];
  for (const def of anchors) {
    const anchor = findAnchor(tokens, def.first, def.second);
    if (!anchor) continue;
    const date = findDateNearAnchor(tokens, anchor, 2000);
    if (date) { d.invoice_date = date; break; }
  }
  if (!d.invoice_date) d.invoice_date = findTopAreaDate(tokens, 2000);

  return { ...extracted, data: d };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Persistent worker management
// ─────────────────────────────────────────────────────────────────────────────

function isPersistentWorkerEnabled(): boolean {
  const raw = (process.env.OCR_PYTHON_PERSISTENT || '1').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function teardownPersistentWorker(state: PersistentWorkerState, reason: Error): void {
  for (const pending of state.pending.values()) {
    clearTimeout(pending.timeout);
    pending.reject(reason);
  }
  state.pending.clear();
  state.stdout.close();
  if (!state.process.killed) state.process.kill();
  if (persistentWorker === state) persistentWorker = null;
}

function handlePersistentWorkerLine(state: PersistentWorkerState, line: string): void {
  const trimmed = String(line || '').trim();
  if (!trimmed) return;
  let parsed: PersistentWorkerResponse;
  try { parsed = JSON.parse(trimmed) as PersistentWorkerResponse; } catch { return; }
  const requestId = String(parsed.id || '');
  if (!requestId) return;
  const pending = state.pending.get(requestId);
  if (!pending) return;
  state.pending.delete(requestId);
  clearTimeout(pending.timeout);
  if (parsed.ok && parsed.result) { pending.resolve(parsed.result); return; }
  pending.reject(new Error(parsed.error || 'Persistent Python OCR worker failed.'));
}

async function getPersistentWorker(pythonBin: string, scriptPath: string): Promise<PersistentWorkerState> {
  if (persistentWorker) return persistentWorker;
  if (persistentWorkerStartup) return persistentWorkerStartup;

  persistentWorkerStartup = new Promise<PersistentWorkerState>((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, '--server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const stdout = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const state: PersistentWorkerState = { process: child, stdout, pending: new Map() };
    let settled = false;
    const settleSuccess = () => { if (settled) return; settled = true; persistentWorker = state; resolve(state); };
    const settleFailure = (err: Error) => { if (settled) return; settled = true; teardownPersistentWorker(state, err); reject(err); };
    child.once('spawn', settleSuccess);
    child.once('error', (err) => settleFailure(err instanceof Error ? err : new Error('Spawn error.')));
    child.once('exit', (code, signal) => {
      const err = new Error(`Worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
      if (!settled) { settleFailure(err); return; }
      teardownPersistentWorker(state, err);
    });
    stdout.on('line', (line) => handlePersistentWorkerLine(state, line));
  }).finally(() => { persistentWorkerStartup = null; });

  return persistentWorkerStartup;
}

function extractPythonExecErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Python OCR worker execution failed.';
  const execError = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
  const stdout = String(execError.stdout || '').trim();
  const stderr = String(execError.stderr || '').trim();
  if (stdout) {
    try {
      const parsed = JSON.parse(stdout) as { error?: string };
      if (parsed.error?.trim()) return `${error.message} (${parsed.error.trim()})`;
    } catch {
      if (stdout.length <= 220) return `${error.message} (${stdout})`;
    }
  }
  if (stderr) {
    const tail = stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] || stderr;
    return `${error.message} (${tail})`;
  }
  return error.message;
}

async function runPythonWorkerOneShot(pythonBin: string, scriptPath: string, tmpFilePath: string, documentTypeHint: string, mode: string, timeoutMs: number): Promise<PythonOcrResponse> {
  const { stdout } = await execFileAsync(pythonBin, [scriptPath, tmpFilePath, documentTypeHint, mode], {
    timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024, windowsHide: true,
  });
  return JSON.parse(String(stdout || '{}')) as PythonOcrResponse;
}

async function runPythonWorkerPersistent(pythonBin: string, scriptPath: string, tmpFilePath: string, documentTypeHint: string, mode: string, timeoutMs: number): Promise<PythonOcrResponse> {
  const worker = await getPersistentWorker(pythonBin, scriptPath);
  return new Promise<PythonOcrResponse>((resolve, reject) => {
    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      worker.pending.delete(requestId);
      reject(new Error(`Request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    worker.pending.set(requestId, { resolve, reject, timeout });
    const payload = JSON.stringify({ id: requestId, image_path: tmpFilePath, document_type_hint: documentTypeHint, requested_mode: mode });
    worker.process.stdin.write(`${payload}\n`, (err) => {
      if (!err) return;
      const pending = worker.pending.get(requestId);
      if (!pending) return;
      worker.pending.delete(requestId);
      clearTimeout(pending.timeout);
      pending.reject(err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function extractWithPythonOcr(candidate: IngestionCandidate): Promise<ExtractionResult> {
  if (!isImageMimeType(candidate.mimeType)) {
    throw new Error(`EasyOCR supports image files only. Received ${candidate.mimeType}.`);
  }

  const pythonBin = (process.env.OCR_PYTHON_BIN || 'python').trim();
  const scriptPath = scriptPathFromEnv();
  const scanMode = (process.env.OCR_PYTHON_SCAN_MODE || 'auto').trim();
  const configuredTimeout = Number(process.env.OCR_PYTHON_TIMEOUT_MS || 120000);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 120000;
  const tmpFilePath = path.join(os.tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${extensionFromMimeType(candidate.mimeType)}`);

  await fs.writeFile(tmpFilePath, candidate.bytes);

  try {
    const workerWarnings: string[] = [];
    let notedFallback = false;

    async function runPythonWorker(mode: string): Promise<PythonOcrResponse> {
      const hint = candidate.documentTypeHint || '';
      if (isPersistentWorkerEnabled()) {
        try {
          return await runPythonWorkerPersistent(pythonBin, scriptPath, tmpFilePath, hint, mode, timeoutMs);
        } catch (err) {
          if (!notedFallback) {
            workerWarnings.push(`Persistent worker unavailable (${extractPythonExecErrorMessage(err)}). Falling back to one-shot.`);
            notedFallback = true;
          }
        }
      }
      return runPythonWorkerOneShot(pythonBin, scriptPath, tmpFilePath, hint, mode, timeoutMs);
    }

    let parsed: PythonOcrResponse;
    try {
      parsed = await runPythonWorker(scanMode);
    } catch (primaryErr) {
      if (scanMode.toLowerCase() === 'fast') throw primaryErr;
      const primaryMsg = extractPythonExecErrorMessage(primaryErr);
      try {
        parsed = await runPythonWorker('fast');
        workerWarnings.push(`Primary OCR pass failed in mode "${scanMode}" (${primaryMsg}). Retried in fast mode.`);
      } catch (retryErr) {
        throw new Error(`${primaryMsg}; fast-mode retry: ${extractPythonExecErrorMessage(retryErr)}`);
      }
    }

    if (!parsed.ok) throw new Error(parsed.error || 'Python OCR worker failed.');

    const extracted = extractFromRawText(parsed.text || '', { documentTypeHint: candidate.documentTypeHint });
    const mappedTokens = normalizePythonTokens(parsed.tokens);
    const tokenCount = mappedTokens.length;

    // Apply the most targeted enrichment for the document type
    const enriched = isLikelyBillDocument(candidate.documentTypeHint)
      ? enrichBillDatesFromTokens(extracted, mappedTokens, parsed.text || '')
      : isLikelyVoucherDocument(candidate.documentTypeHint)
        ? enrichVoucherFieldsFromTokens(extracted, mappedTokens, parsed.text || '')
        : isLikelyInvoiceOrReceiptDocument(candidate.documentTypeHint)
          ? enrichInvoiceOrReceiptDateFromTokens(extracted, mappedTokens)
          : extracted;

    // Suppress now-resolved warnings
    const mergedWarnings = enriched.warnings.filter((w) => {
      if (w === 'Local OCR could not confidently find invoice date.' && enriched.data.invoice_date) return false;
      if (w === 'Local OCR could not confidently find total amount.' && enriched.data.total_amount !== null) return false;
      if (w === 'Local OCR could not confidently find invoice/reference number.' && enriched.data.invoice_number) return false;
      return true;
    });

    return {
      ...enriched,
      ocr_tokens: mappedTokens,
      warnings: [
        ...workerWarnings,
        ...(parsed.warnings || []),
        `Extracted using EasyOCR (${tokenCount} token${tokenCount === 1 ? '' : 's'}).`,
        ...mergedWarnings,
      ],
    };
  } catch (error) {
    throw new Error(`EasyOCR worker failed: ${extractPythonExecErrorMessage(error)}`);
  } finally {
    await fs.unlink(tmpFilePath).catch(() => undefined);
  }
}