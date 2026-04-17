import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { extractFromRawText } from './localOcr.service.js';
const execFileAsync = promisify(execFile);
function normalizePythonTokens(tokens) {
    if (!Array.isArray(tokens))
        return [];
    return tokens
        .map((token) => {
        const word = String(token.word || '').trim();
        if (!word)
            return null;
        const x = Number.isFinite(token.x) ? Number(token.x) : 0;
        const y = Number.isFinite(token.y) ? Number(token.y) : 0;
        const width = Number.isFinite(token.width) ? Number(token.width) : 0;
        const height = Number.isFinite(token.height) ? Number(token.height) : 0;
        const confidenceRaw = Number.isFinite(token.confidence) ? Number(token.confidence) : 0;
        const confidence = Math.max(0, Math.min(confidenceRaw, 1));
        const polygon = Array.isArray(token.polygon) && token.polygon.length === 4
            ? token.polygon.map((pair) => [Number(pair?.[0] || 0), Number(pair?.[1] || 0)])
            : [
                [x, y],
                [x + width, y],
                [x + width, y + height],
                [x, y + height],
            ];
        return {
            word,
            confidence: Number(confidence.toFixed(4)),
            x,
            y,
            width,
            height,
            polygon,
        };
    })
        .filter((token) => token !== null);
}
function isImageMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png';
}
function extensionFromMimeType(mimeType) {
    if (mimeType === 'image/png')
        return '.png';
    return '.jpg';
}
function scriptPathFromEnv() {
    if (process.env.OCR_PYTHON_SCRIPT && process.env.OCR_PYTHON_SCRIPT.trim()) {
        return process.env.OCR_PYTHON_SCRIPT.trim();
    }
    return path.resolve(process.cwd(), 'python', 'ocr_worker.py');
}
function isLikelyBillDocument(documentTypeHint) {
    const normalized = (documentTypeHint || '').trim().toLowerCase();
    return normalized === 'bill' || normalized === 'monthly_bill' || normalized.includes('utility');
}
function isLikelyInvoiceOrReceiptDocument(documentTypeHint) {
    const normalized = (documentTypeHint || '').trim().toLowerCase();
    if (!normalized)
        return true;
    return [
        'invoice',
        'receipt',
        'official_receipt',
        'official-receipt',
        'sales_invoice',
        'sales-invoice',
    ].some((hint) => normalized.includes(hint));
}
function isLikelyVoucherDocument(documentTypeHint) {
    const normalized = (documentTypeHint || '').trim().toLowerCase();
    if (!normalized)
        return false;
    return [
        'voucher',
        'cash_voucher',
        'cash-voucher',
        'check_voucher',
        'check-voucher',
        'payment_voucher',
        'payment-voucher',
    ].some((hint) => normalized.includes(hint));
}
function normalizeDateFromParts(dayToken, monthToken, yearToken, minYear = 2000) {
    const day = Number(dayToken.replace(/\D/g, ''));
    const year = Number(yearToken.replace(/\D/g, ''));
    const monthKey = monthToken.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 4);
    const monthMap = {
        jan: 1,
        feb: 2,
        mar: 3,
        mch: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        sept: 9,
        oct: 10,
        nov: 11,
        dec: 12,
    };
    const month = monthMap[monthKey];
    if (!month || !Number.isFinite(day) || !Number.isFinite(year))
        return null;
    if (day < 1 || day > 31)
        return null;
    if (year < minYear || year > new Date().getFullYear() + 1)
        return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function normalizeNumericDateToken(token, minYear = 2000) {
    const cleaned = token.replace(/[^\d/-]/g, '');
    const parts = cleaned.split(/[/-]/).filter(Boolean);
    if (parts.length !== 3)
        return null;
    let first = Number(parts[0]);
    let second = Number(parts[1]);
    let year = Number(parts[2]);
    if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year))
        return null;
    if (year < 100) {
        year += year >= 70 ? 1900 : 2000;
    }
    if (year < minYear || year > new Date().getFullYear() + 1)
        return null;
    let month = first;
    let day = second;
    if (first > 12 && second <= 12) {
        day = first;
        month = second;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function normalizeAmountToken(token) {
    const cleaned = token
        .replace(/[Oo](?=\d|\.|,|$)/g, '0')
        .replace(/[^0-9.,-]/g, '')
        .replace(/,(?=\d{3}(\D|$))/g, '');
    if (!cleaned)
        return null;
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return Number(parsed.toFixed(2));
}
function normalizeOrganizationToken(token) {
    return String(token || '')
        .replace(/[^A-Za-z0-9&.,'()\-/\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizeIdentifierToken(token, minLength = 4) {
    const raw = (token || '').trim();
    if (!raw)
        return null;
    const cleaned = raw
        .replace(/^[:#\-\s]+/g, '')
        .replace(/[:#\-\s]+$/g, '')
        .replace(/[^A-Za-z0-9\/-]/g, '');
    if (cleaned.length < minLength)
        return null;
    if (!/\d/.test(cleaned))
        return null;
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleaned))
        return null;
    return cleaned;
}
function detectUtilityProviderFromContext(tokens, existingVendorName, rawText) {
    const tokenBlob = tokens.map((token) => String(token.word || '').toLowerCase()).join(' ');
    const blob = `${tokenBlob} ${(existingVendorName || '').toLowerCase()} ${(rawText || '').toLowerCase()}`;
    if (/\bconverge\b|converge\s*ict/.test(blob)) {
        return { provider: 'Converge ICT', utilityType: 'internet' };
    }
    if (/\bpldt\b|philippine\s*long\s*distance/.test(blob)) {
        return { provider: 'PLDT', utilityType: 'internet' };
    }
    if (/\bglobe\b|globe\s*telecom/.test(blob)) {
        return { provider: 'Globe', utilityType: 'internet' };
    }
    if (/\bmeralco\b|manila\s*electric/.test(blob)) {
        return { provider: 'Meralco', utilityType: 'electricity' };
    }
    if (/manila\s*water/.test(blob)) {
        return { provider: 'Manila Water', utilityType: 'water' };
    }
    const pldtSignals = [
        /telephone\s*number/,
        /billing\s*invoice/,
        /my\s*home/,
        /pay\s*express/,
        /pld[ti1]/,
    ];
    const pldtScore = pldtSignals.reduce((score, pattern) => score + (pattern.test(blob) ? 1 : 0), 0);
    if (pldtScore >= 2) {
        return { provider: 'PLDT', utilityType: 'internet' };
    }
    return { provider: null, utilityType: null };
}
function isNoiseVendorName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized)
        return true;
    if (normalized.length <= 4)
        return true;
    if (/tin\s*no|no\s*tin\s*provided|tin\s*provided/.test(normalized))
        return true;
    if (/account\s*number|billing\s*information|invoice\s*no|due\s*date/.test(normalized))
        return true;
    return false;
}
function matchesLabel(word, pattern) {
    const cleaned = word.replace(/[^A-Za-z]/g, '');
    return pattern.test(cleaned);
}
function findAnchor(tokens, first, second) {
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!matchesLabel(token.word, first))
            continue;
        const nearby = tokens.find((candidate) => matchesLabel(candidate.word, second)
            && Math.abs(candidate.y - token.y) <= 35
            && candidate.x >= token.x
            && candidate.x - token.x <= 420);
        if (nearby) {
            return { x: token.x, y: Math.min(token.y, nearby.y) };
        }
    }
    return null;
}
function findSingleAnchor(tokens, pattern) {
    for (const token of tokens) {
        if (matchesLabel(token.word, pattern)) {
            return { x: token.x, y: token.y };
        }
    }
    return null;
}
function findDateNearAnchor(tokens, anchor, minYear = 2000) {
    const candidates = tokens
        .filter((token) => token.y >= anchor.y && token.y <= anchor.y + 220)
        .filter((token) => token.x >= anchor.x - 300 && token.x <= anchor.x + 900)
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    for (const candidate of candidates) {
        const numericDate = normalizeNumericDateToken(candidate.word, minYear);
        if (numericDate)
            return numericDate;
    }
    for (let index = 0; index < candidates.length - 2; index += 1) {
        const first = candidates[index]?.word || '';
        const second = candidates[index + 1]?.word || '';
        const third = candidates[index + 2]?.word || '';
        if (!/^\d{1,2}$/.test(first.replace(/\D/g, '')))
            continue;
        if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(second))
            continue;
        if (!/^\d{4}$/.test(third.replace(/\D/g, '')))
            continue;
        const normalized = normalizeDateFromParts(first, second, third, minYear);
        if (normalized)
            return normalized;
    }
    return null;
}
function findIdentifierNearAnchor(tokens, anchor, minLength = 4) {
    const candidates = tokens
        .filter((token) => token.y >= anchor.y - 25 && token.y <= anchor.y + 220)
        .filter((token) => token.x >= anchor.x - 30 && token.x <= anchor.x + 1000)
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    const ignoredLabel = /^(account|acoount|acct|number|no|ref|reference|soa|statement)$/i;
    const validCandidates = candidates
        .filter((candidate) => !ignoredLabel.test(candidate.word.replace(/[^A-Za-z]/g, '').toLowerCase()))
        .map((candidate) => ({
        value: normalizeIdentifierToken(candidate.word, minLength),
        confidence: candidate.confidence,
        length: candidate.word.length,
    }))
        .filter((item) => item.value !== null);
    if (!validCandidates.length)
        return null;
    validCandidates.sort((a, b) => {
        if (b.confidence !== a.confidence)
            return b.confidence - a.confidence;
        return b.length - a.length;
    });
    return validCandidates[0].value;
}
function findIdentifierSameLineAfterAnchor(tokens, anchor, minLength = 4) {
    const candidates = tokens
        .filter((token) => Math.abs(token.y - anchor.y) <= 28)
        .filter((token) => token.x >= anchor.x)
        .filter((token) => token.x <= anchor.x + 1200)
        .sort((a, b) => a.x - b.x)
        .map((token) => normalizeIdentifierToken(token.word, minLength))
        .filter((value) => value !== null);
    if (!candidates.length)
        return null;
    return candidates[0];
}
function findBillingPeriodNearAnchor(tokens, anchor) {
    const candidates = tokens
        .filter((token) => token.y >= anchor.y && token.y <= anchor.y + 260)
        .filter((token) => token.x >= anchor.x - 50 && token.x <= anchor.x + 1300)
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    const foundDates = [];
    for (let index = 0; index < candidates.length - 2; index += 1) {
        const first = candidates[index]?.word || '';
        const second = candidates[index + 1]?.word || '';
        const third = candidates[index + 2]?.word || '';
        if (!/^\d{1,2}$/.test(first.replace(/\D/g, '')))
            continue;
        if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(second))
            continue;
        if (!/^\d{4}$/.test(third.replace(/\D/g, '')))
            continue;
        const normalized = normalizeDateFromParts(first, second, third, 2015);
        if (!normalized)
            continue;
        if (!foundDates.includes(normalized)) {
            foundDates.push(normalized);
        }
        if (foundDates.length >= 2) {
            break;
        }
    }
    return {
        start: foundDates[0] || null,
        end: foundDates[1] || null,
    };
}
function enrichBillDatesFromTokens(extracted, tokens, rawText) {
    const nextData = { ...extracted.data };
    const inferredUtility = detectUtilityProviderFromContext(tokens, nextData.vendor_name, rawText);
    if (!nextData.utility_provider && inferredUtility.provider) {
        nextData.utility_provider = inferredUtility.provider;
    }
    if (!nextData.utility_type && inferredUtility.utilityType) {
        nextData.utility_type = inferredUtility.utilityType;
    }
    if (inferredUtility.provider && isNoiseVendorName(nextData.vendor_name)) {
        nextData.vendor_name = inferredUtility.provider;
    }
    const dueAnchor = findAnchor(tokens, /^due$/i, /^date$/i);
    if (!nextData.due_date && dueAnchor) {
        nextData.due_date = findDateNearAnchor(tokens, dueAnchor, 2015);
    }
    const billDateAnchor = findAnchor(tokens, /^bill$/i, /^(dat|date)$/i);
    if (!nextData.invoice_date && billDateAnchor) {
        nextData.invoice_date = findDateNearAnchor(tokens, billDateAnchor, 2015);
    }
    const billingPeriodAnchor = findAnchor(tokens, /^billing$/i, /^period$/i);
    if (billingPeriodAnchor) {
        const period = findBillingPeriodNearAnchor(tokens, billingPeriodAnchor);
        if (!nextData.billing_period_start) {
            nextData.billing_period_start = period.start;
        }
        if (!nextData.billing_period_end) {
            nextData.billing_period_end = period.end;
        }
        if (!nextData.invoice_date) {
            nextData.invoice_date = period.end || period.start;
        }
    }
    if (!nextData.account_number) {
        const accountAnchor = findAnchor(tokens, /^a(?:cc|co)ount$/i, /^(no|number)$/i)
            || findSingleAnchor(tokens, /^a(?:cc|co)ount$|^acct$/i)
            || findAnchor(tokens, /^telephone$/i, /^number$/i)
            || findSingleAnchor(tokens, /^subscriber$/i);
        if (accountAnchor) {
            nextData.account_number = findIdentifierNearAnchor(tokens, accountAnchor, 6);
        }
    }
    if (!nextData.invoice_number) {
        const referenceAnchor = findAnchor(tokens, /^ref(?:erence)?$/i, /^(no|number)$/i)
            || findSingleAnchor(tokens, /^ref(?:erence)?$/i)
            || findSingleAnchor(tokens, /^soa$/i)
            || findSingleAnchor(tokens, /^statement$/i);
        if (referenceAnchor) {
            nextData.invoice_number = findIdentifierNearAnchor(tokens, referenceAnchor, 4);
        }
    }
    if (!nextData.invoice_number && nextData.account_number) {
        nextData.invoice_number = nextData.account_number;
    }
    const looksLikeInternetBill = nextData.utility_type === 'internet'
        || /(?:pldt|converge|globe)/i.test(nextData.utility_provider || nextData.vendor_name || '');
    if (looksLikeInternetBill) {
        if (!nextData.invoice_number) {
            const invoiceAnchor = findAnchor(tokens, /^invoice$/i, /^(no|number)$/i)
                || findAnchor(tokens, /^billing$/i, /^invoice$/i)
                || findAnchor(tokens, /^ref(?:erence)?$/i, /^(no|number)$/i)
                || findSingleAnchor(tokens, /^ref(?:erence)?$/i);
            if (invoiceAnchor) {
                nextData.invoice_number = findIdentifierSameLineAfterAnchor(tokens, invoiceAnchor, 4)
                    || findIdentifierNearAnchor(tokens, invoiceAnchor, 4);
            }
        }
        if (!nextData.account_number) {
            const accountAnchor = findAnchor(tokens, /^account$/i, /^(no|number)$/i)
                || findAnchor(tokens, /^telephone$/i, /^number$/i)
                || findSingleAnchor(tokens, /^account$/i)
                || findSingleAnchor(tokens, /^subscriber$/i);
            if (accountAnchor) {
                nextData.account_number = findIdentifierSameLineAfterAnchor(tokens, accountAnchor, 6)
                    || findIdentifierNearAnchor(tokens, accountAnchor, 6);
            }
        }
    }
    return {
        ...extracted,
        data: nextData,
    };
}
function findTopAreaDate(tokens, minYear = 2000) {
    const topCandidates = tokens
        .filter((token) => token.y <= 520)
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    for (const candidate of topCandidates) {
        const numericDate = normalizeNumericDateToken(candidate.word, minYear);
        if (numericDate)
            return numericDate;
    }
    for (let index = 0; index < topCandidates.length - 2; index += 1) {
        const first = topCandidates[index]?.word || '';
        const second = topCandidates[index + 1]?.word || '';
        const third = topCandidates[index + 2]?.word || '';
        if (!/^[\d\W]{1,4}\d{1,2}$/.test(first.replace(/\s+/g, '')))
            continue;
        if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(second))
            continue;
        if (!/^[\d\W]*\d{4}$/.test(third))
            continue;
        const normalized = normalizeDateFromParts(first, second, third, minYear);
        if (normalized)
            return normalized;
    }
    const topText = topCandidates.map((token) => token.word).join(' ');
    const dayMonthYearPattern = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,./-]*\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,./-]*\s*(\d{2,4})\b/gi;
    const monthDayYearPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,./-]*\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,./-]*\s*(\d{2,4})\b/gi;
    let matched = dayMonthYearPattern.exec(topText);
    while (matched) {
        const normalized = normalizeDateFromParts(matched[1], matched[2], matched[3], minYear);
        if (normalized)
            return normalized;
        matched = dayMonthYearPattern.exec(topText);
    }
    matched = monthDayYearPattern.exec(topText);
    while (matched) {
        const normalized = normalizeDateFromParts(matched[2], matched[1], matched[3], minYear);
        if (normalized)
            return normalized;
        matched = monthDayYearPattern.exec(topText);
    }
    return null;
}
function findDateInRawText(rawText, minYear = 2000) {
    const text = String(rawText || '').trim();
    if (!text)
        return null;
    const numericMatches = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) || [];
    for (const match of numericMatches) {
        const normalized = normalizeNumericDateToken(match, minYear);
        if (normalized)
            return normalized;
    }
    const dayMonthYearPattern = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,./-]*\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,./-]*\s*(\d{2,4})\b/gi;
    const monthDayYearPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,./-]*\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,./-]*\s*(\d{2,4})\b/gi;
    let matched = dayMonthYearPattern.exec(text);
    while (matched) {
        const normalized = normalizeDateFromParts(matched[1], matched[2], matched[3], minYear);
        if (normalized)
            return normalized;
        matched = dayMonthYearPattern.exec(text);
    }
    matched = monthDayYearPattern.exec(text);
    while (matched) {
        const normalized = normalizeDateFromParts(matched[2], matched[1], matched[3], minYear);
        if (normalized)
            return normalized;
        matched = monthDayYearPattern.exec(text);
    }
    return null;
}
function findAmountNearAnchor(tokens, anchor) {
    const candidates = tokens
        .filter((token) => token.y >= anchor.y - 20 && token.y <= anchor.y + 280)
        .filter((token) => token.x >= anchor.x - 80)
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    const parsedAmounts = candidates
        .map((token) => normalizeAmountToken(token.word))
        .filter((value) => value !== null && value >= 10);
    if (!parsedAmounts.length)
        return null;
    return Math.max(...parsedAmounts);
}
function findLikelyVoucherTotalFromTokens(tokens) {
    const amountAnchor = findSingleAnchor(tokens, /^amount$/i);
    if (amountAnchor) {
        const nearAmount = findAmountNearAnchor(tokens, amountAnchor);
        if (nearAmount)
            return nearAmount;
    }
    const pageMaxX = tokens.reduce((max, token) => Math.max(max, token.x + token.width), 0);
    const rightColumnThreshold = pageMaxX > 0 ? pageMaxX * 0.55 : 0;
    const rightColumnCandidates = tokens
        .filter((token) => token.y >= 80)
        .filter((token) => token.x >= rightColumnThreshold)
        .map((token) => normalizeAmountToken(token.word))
        .filter((value) => value !== null && value >= 10);
    if (rightColumnCandidates.length) {
        return Math.max(...rightColumnCandidates);
    }
    const candidates = tokens
        .filter((token) => token.y >= 120)
        .map((token) => normalizeAmountToken(token.word))
        .filter((value) => value !== null && value >= 10);
    if (!candidates.length)
        return null;
    return Math.max(...candidates);
}
function findVoucherPayeeFromTokens(tokens) {
    const payeeAnchor = findSingleAnchor(tokens, /^payee$/i)
        || findAnchor(tokens, /^company$/i, /^payee$/i)
        || findAnchor(tokens, /^payor$/i, /^payee$/i);
    if (!payeeAnchor)
        return null;
    const stopLabels = /^(date|particulars|amount|check|voucher|no|number)$/i;
    const lineTokens = tokens
        .filter((token) => Math.abs(token.y - payeeAnchor.y) <= 42)
        .filter((token) => token.x > payeeAnchor.x + 40)
        .filter((token) => token.x <= payeeAnchor.x + 1700)
        .sort((a, b) => a.x - b.x);
    const words = [];
    for (const token of lineTokens) {
        const cleaned = normalizeOrganizationToken(token.word);
        if (!cleaned)
            continue;
        if (stopLabels.test(cleaned.replace(/[^A-Za-z]/g, '')))
            break;
        words.push(cleaned);
        if (words.length >= 14)
            break;
    }
    const candidate = words.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (candidate.length < 6)
        return null;
    return candidate;
}
function enrichVoucherFieldsFromTokens(extracted, tokens, rawText) {
    const nextData = { ...extracted.data };
    if (!nextData.invoice_date) {
        const voucherDateAnchor = findAnchor(tokens, /^voucher$/i, /^date$/i) || findSingleAnchor(tokens, /^date$/i);
        if (voucherDateAnchor) {
            nextData.invoice_date = findDateNearAnchor(tokens, voucherDateAnchor, 2000);
        }
        if (!nextData.invoice_date) {
            nextData.invoice_date = findTopAreaDate(tokens, 2000);
        }
        if (!nextData.invoice_date) {
            nextData.invoice_date = findDateInRawText(rawText, 2000);
        }
    }
    const tokenAmount = findLikelyVoucherTotalFromTokens(tokens);
    const hasTotalWarning = extracted.warnings.some((warning) => warning === 'Local OCR could not confidently find total amount.');
    if (tokenAmount !== null) {
        if (nextData.total_amount === null
            || nextData.total_amount === undefined
            || hasTotalWarning
            || tokenAmount > Number(nextData.total_amount || 0) * 1.3) {
            nextData.total_amount = tokenAmount;
        }
    }
    const tokenPayee = findVoucherPayeeFromTokens(tokens);
    if (tokenPayee) {
        nextData.vendor_name = tokenPayee;
    }
    return {
        ...extracted,
        data: nextData,
    };
}
function extractPythonExecErrorMessage(error) {
    if (!(error instanceof Error)) {
        return 'Python OCR worker execution failed.';
    }
    const execError = error;
    const stdout = String(execError.stdout || '').trim();
    const stderr = String(execError.stderr || '').trim();
    if (stdout) {
        try {
            const parsed = JSON.parse(stdout);
            if (parsed.error && parsed.error.trim()) {
                return `${error.message} (${parsed.error.trim()})`;
            }
        }
        catch {
            if (stdout.length <= 220) {
                return `${error.message} (${stdout})`;
            }
        }
    }
    if (stderr) {
        const tail = stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] || stderr;
        return `${error.message} (${tail})`;
    }
    return error.message;
}
function enrichInvoiceOrReceiptDateFromTokens(extracted, tokens) {
    if (extracted.data.invoice_date)
        return extracted;
    const nextData = { ...extracted.data };
    const anchors = [
        { first: /^invoice$/i, second: /^date$/i },
        { first: /^bill$/i, second: /^(date|dat)$/i },
        { first: /^receipt$/i, second: /^date$/i },
        { first: /^or$/i, second: /^date$/i },
        { first: /^dated$/i, second: /^on$/i },
    ];
    for (const anchorDef of anchors) {
        const anchor = findAnchor(tokens, anchorDef.first, anchorDef.second);
        if (!anchor)
            continue;
        const date = findDateNearAnchor(tokens, anchor, 2000);
        if (date) {
            nextData.invoice_date = date;
            break;
        }
    }
    if (!nextData.invoice_date) {
        nextData.invoice_date = findTopAreaDate(tokens, 2000);
    }
    return {
        ...extracted,
        data: nextData,
    };
}
export async function extractWithPythonOcr(candidate) {
    if (!isImageMimeType(candidate.mimeType)) {
        throw new Error(`Python OCR provider currently supports image files only. Received ${candidate.mimeType}.`);
    }
    const pythonBin = (process.env.OCR_PYTHON_BIN || 'python').trim();
    const scriptPath = scriptPathFromEnv();
    const scanMode = (process.env.OCR_PYTHON_SCAN_MODE || 'auto').trim();
    const tmpFilePath = path.join(os.tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${extensionFromMimeType(candidate.mimeType)}`);
    await fs.writeFile(tmpFilePath, candidate.bytes);
    try {
        const { stdout } = await execFileAsync(pythonBin, [scriptPath, tmpFilePath, candidate.documentTypeHint || '', scanMode], {
            timeout: Number(process.env.OCR_PYTHON_TIMEOUT_MS || 45000),
            maxBuffer: 5 * 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || '{}'));
        if (!parsed.ok) {
            throw new Error(parsed.error || 'Python OCR worker failed.');
        }
        const extracted = extractFromRawText(parsed.text || '', {
            documentTypeHint: candidate.documentTypeHint,
        });
        const mappedTokens = normalizePythonTokens(parsed.tokens);
        const tokenCount = mappedTokens.length;
        const withTokenDateHints = isLikelyBillDocument(candidate.documentTypeHint)
            ? enrichBillDatesFromTokens(extracted, mappedTokens, parsed.text || '')
            : (isLikelyVoucherDocument(candidate.documentTypeHint)
                ? enrichVoucherFieldsFromTokens(extracted, mappedTokens, parsed.text || '')
                : (isLikelyInvoiceOrReceiptDocument(candidate.documentTypeHint)
                    ? enrichInvoiceOrReceiptDateFromTokens(extracted, mappedTokens)
                    : extracted));
        const mergedWarnings = withTokenDateHints.warnings.filter((warning) => {
            if (warning === 'Local OCR could not confidently find invoice date.' && withTokenDateHints.data.invoice_date) {
                return false;
            }
            if (warning === 'Local OCR could not confidently find total amount.' && withTokenDateHints.data.total_amount !== null) {
                return false;
            }
            if (warning === 'Local OCR could not confidently find invoice/reference number.' && withTokenDateHints.data.invoice_number) {
                return false;
            }
            return true;
        });
        return {
            ...withTokenDateHints,
            ocr_tokens: mappedTokens,
            warnings: [
                ...(parsed.warnings || []),
                `Extracted using Python OCR provider (${tokenCount} mapped token${tokenCount === 1 ? '' : 's'}).`,
                ...mergedWarnings,
            ],
        };
    }
    catch (error) {
        const message = extractPythonExecErrorMessage(error);
        throw new Error(`Python OCR provider failed: ${message}`);
    }
    finally {
        await fs.unlink(tmpFilePath).catch(() => undefined);
    }
}
