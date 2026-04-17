import pdfParse from 'pdf-parse';
import { createWorker, PSM } from 'tesseract.js';
import mammoth from 'mammoth';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
const BILL_PROVIDERS = [
    {
        canonicalName: 'Meralco',
        utilityType: 'electricity',
        aliases: [/\bmeralco\b/i, /manila\s*electric\s*company/i],
        invoiceNumberPatterns: [
            /(?:service\s*id(?:\s*no\.?)?|account\s*(?:no\.?|number)|customer\s*account\s*(?:no\.?|number)|can)\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
        ],
        datePatterns: [
            /(?:due\s*date|bill(?:ing)?\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ],
        amountPatterns: [
            /(?:amount\s*due|total\s*current\s*amount|total\s*amount\s*due|total\s*due)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        ],
    },
    {
        canonicalName: 'PLDT',
        utilityType: 'internet',
        aliases: [/\bpldt\b/i, /philippine\s*long\s*distance/i],
        invoiceNumberPatterns: [
            /(?:account\s*(?:no\.?|number)|soa\s*(?:no\.?|number)|reference\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
        ],
        datePatterns: [
            /(?:due\s*date|bill\s*date|statement\s*date|billing\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ],
        amountPatterns: [
            /(?:amount\s*due|total\s*amount\s*due|total\s*current\s*charges|current\s*charges)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        ],
    },
    {
        canonicalName: 'Converge ICT',
        utilityType: 'internet',
        aliases: [/converge\s*ict/i, /\bconverge\b/i],
        invoiceNumberPatterns: [
            /(?:account\s*(?:no\.?|number)|a(?:cc|co)ount\s*(?:no\.?|number)|acct\s*(?:no\.?|number)|reference\s*(?:no\.?|number|#)|ref\s*(?:no\.?|number|#)?|soa\s*(?:no\.?|number|#)|statement\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
        ],
        datePatterns: [
            /(?:due\s*date|billing\s*date|bill\s*date|statement\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ],
        amountPatterns: [
            /(?:amount\s*due|total\s*amount\s*due|outstanding\s*balance|balance\s*due)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        ],
    },
    {
        canonicalName: 'Globe',
        utilityType: 'internet',
        aliases: [/\bglobe\b/i, /globe\s*telecom/i],
        invoiceNumberPatterns: [
            /(?:account\s*(?:no\.?|number)|billing\s*account\s*(?:no\.?|number)|reference\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
        ],
        datePatterns: [
            /(?:due\s*date|bill\s*date|billing\s*date|statement\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ],
        amountPatterns: [
            /(?:amount\s*due|total\s*amount\s*due|outstanding\s*balance|balance\s*due)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        ],
    },
    {
        canonicalName: 'Manila Water',
        utilityType: 'water',
        aliases: [/manila\s*water/i],
        invoiceNumberPatterns: [
            /(?:contract\s*account\s*(?:no\.?|number)|account\s*(?:no\.?|number)|statement\s*(?:no\.?|number)|reference\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
        ],
        datePatterns: [
            /(?:due\s*date|bill\s*date|billing\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ],
        amountPatterns: [
            /(?:amount\s*due|total\s*amount\s*due|total\s*due|balance\s*due)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        ],
    },
];
const UTILITY_TYPE_PATTERNS = {
    electricity: [
        /\bkwh\b/i,
        /kilowatt\s*hour/i,
        /generation\s*charge/i,
        /distribution\s*charge/i,
        /electric(?:ity)?\s*bill/i,
        /manila\s*electric/i,
    ],
    water: [
        /\bwater\b/i,
        /\bm3\b/i,
        /cubic\s*meter/i,
        /sewer(?:age)?/i,
        /water\s*consumption/i,
        /manila\s*water/i,
    ],
    internet: [
        /\binternet\b/i,
        /broadband/i,
        /fiber/i,
        /dsl/i,
        /monthly\s*service\s*fee/i,
        /plan\s*\d+/i,
    ],
    unknown: [],
};
function isLikelyBillDocument(documentTypeHint) {
    const normalized = (documentTypeHint || '').trim().toLowerCase();
    return normalized === 'bill' || normalized === 'monthly_bill' || normalized.includes('utility');
}
function detectBillProvider(text) {
    for (const provider of BILL_PROVIDERS) {
        if (provider.aliases.some((alias) => alias.test(text))) {
            return provider;
        }
    }
    return null;
}
function detectUtilityTypeBySignals(text) {
    const scoredTypes = ['electricity', 'water', 'internet']
        .map((type) => {
        const score = UTILITY_TYPE_PATTERNS[type].reduce((current, pattern) => current + (pattern.test(text) ? 1 : 0), 0);
        return { type, score };
    })
        .sort((a, b) => b.score - a.score);
    const best = scoredTypes[0];
    if (!best || best.score <= 0) {
        return 'unknown';
    }
    return best.type;
}
function detectUtilityClassification(text, provider) {
    const providerName = provider?.canonicalName ?? null;
    const utilityType = provider?.utilityType ?? detectUtilityTypeBySignals(text);
    return {
        utility_type: utilityType === 'unknown' ? null : utilityType,
        utility_provider: providerName,
    };
}
function findFirstCaptured(text, patterns) {
    for (const pattern of patterns) {
        const matched = text.match(pattern);
        if (matched?.[1]) {
            return matched[1].trim();
        }
    }
    return null;
}
const DATE_CAPTURE_PATTERN = '([A-Za-z]{3,9}\\s*\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{4}[\\/-]\\d{1,2}[\\/-]\\d{1,2})';
function findCapturedNearLabels(text, labels, capturePattern, maxDistance = 120) {
    for (const label of labels) {
        const expression = new RegExp(`${label}[\\s\\S]{0,${maxDistance}}?${capturePattern}`, 'i');
        const matched = text.match(expression);
        if (matched?.[1]) {
            return matched[1].trim();
        }
    }
    return null;
}
function findLikelyBillAmount(text, provider) {
    const providerMatch = provider ? findFirstCaptured(text, provider.amountPatterns) : null;
    const genericMatch = findFirstCaptured(text, [
        /(?:amount\s*due|total\s*amount\s*due|total\s*due|balance\s*due|current\s*charges|outstanding\s*balance)\s*[:#-]?\s*(?:php|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    ]);
    return parseAmountToken(providerMatch || genericMatch || '') ?? null;
}
function findLikelyBillDate(text, provider) {
    const billDateNearLabel = findCapturedNearLabels(text, ['bill(?:ing)?\\s*dat(?:e)?', 'bill\\s*dat', 'statement\\s*date', 'reading\\s*date'], DATE_CAPTURE_PATTERN, 400);
    if (billDateNearLabel) {
        const normalizedBillDate = normalizeBillDate(billDateNearLabel);
        if (normalizedBillDate) {
            return normalizedBillDate;
        }
    }
    const providerDate = provider ? findFirstCaptured(text, provider.datePatterns) : null;
    if (providerDate) {
        const normalizedProviderDate = normalizeBillDate(providerDate);
        if (normalizedProviderDate) {
            return normalizedProviderDate;
        }
    }
    const dueDate = findCapturedNearLabels(text, ['due\\s*date', 'payment\\s*due'], DATE_CAPTURE_PATTERN, 400)
        || findFirstCaptured(text, [
            /(?:due\s*date|payment\s*due)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
        ]);
    const statementDate = findFirstCaptured(text, [
        /(?:bill(?:ing)?\s*date|statement\s*date|reading\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    ]);
    return normalizeBillDate(dueDate || statementDate || '');
}
function findLikelyBillReferenceNumber(text, provider) {
    const invoiceNumberByLabel = findCapturedNearLabels(text, ['invoice\\s*(?:no\\.?|number|#)', 'bill\\s*(?:no\\.?|number|#)', 'soa\\s*(?:no\\.?|number|#)', 'ref(?:erence)?\\s*(?:no\\.?|number|#)?'], '([A-Z0-9-]{4,})');
    const normalizedInvoiceNumberByLabel = sanitizeBillIdentifier(invoiceNumberByLabel, 4);
    if (normalizedInvoiceNumberByLabel) {
        return normalizedInvoiceNumberByLabel;
    }
    const providerValue = provider ? findFirstCaptured(text, provider.invoiceNumberPatterns) : null;
    const genericValue = findFirstCaptured(text, [
        /(?:invoice\s*(?:no\.?|number|#)|account\s*(?:no\.?|number)|service\s*id(?:\s*no\.?)?|soa\s*(?:no\.?|number|#)|statement\s*(?:no\.?|number)|contract\s*account\s*(?:no\.?|number)|billing\s*account\s*(?:no\.?|number)|reference\s*(?:no\.?|number|#)|ref\s*(?:no\.?|number|#)?|subscriber\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
    ]);
    return sanitizeBillIdentifier(providerValue || genericValue, 4);
}
function findLikelyBillAccountNumber(text, provider) {
    const providerSpecific = provider?.canonicalName === 'Meralco'
        ? findCapturedNearLabels(text, ['customer\\s*account\\s*number\\s*\\(\\s*can\\s*\\)', '\\bcan\\b'], '([A-Z0-9-]{6,})') || findFirstCaptured(text, [
            /customer\s*account\s*number\s*\(\s*can\s*\)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
            /\bcan\b\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
        ])
        : provider?.canonicalName === 'Converge ICT'
            ? findCapturedNearLabels(text, ['a(?:cc|co)ount\\s*(?:no\\.?|number)', 'acct\\s*(?:no\\.?|number)', 'subscriber\\s*(?:no\\.?|number)'], '([A-Z0-9-]{6,})') || findFirstCaptured(text, [
                /(?:a(?:cc|co)ount\s*(?:no\.?|number)|acct\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number)|client\s*id|account\s*id)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
            ])
            : null;
    const generic = findFirstCaptured(text, [
        /(?:customer\s*account\s*number\s*\(\s*can\s*\)|a(?:cc|co)ount\s*(?:no\.?|number)|acct\s*(?:no\.?|number)|service\s*id(?:\s*no\.?)?|contract\s*account\s*(?:no\.?|number)|subscriber\s*(?:no\.?|number)|client\s*id|account\s*id)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    ]);
    return sanitizeBillIdentifier(providerSpecific || generic);
}
function findLikelyBillingPeriod(text) {
    const nearbyMatch = text.match(new RegExp(`billing\\s*period[\\s\\S]{0,400}?${DATE_CAPTURE_PATTERN}[\\s\\S]{0,80}?(?:to|\\-|–|—)[\\s\\S]{0,80}?${DATE_CAPTURE_PATTERN}`, 'i'));
    if (nearbyMatch) {
        return {
            start: normalizeBillDate(nearbyMatch[1]),
            end: normalizeBillDate(nearbyMatch[2]),
        };
    }
    const match = text.match(/billing\s*period\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*(?:to|\-|–|—)\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
    if (!match) {
        return { start: null, end: null };
    }
    return {
        start: normalizeBillDate(match[1]),
        end: normalizeBillDate(match[2]),
    };
}
function findLikelyServiceAddress(lines) {
    const headerLines = lines.slice(0, 25);
    const skipPattern = /invoice|bill|date|route|meter|reading|number|customer\s*account|can|tin|print\s*seq|page\s*\d+/i;
    const addressPattern = /street|st\.?\b|barangay|brgy|city|manila|ave\b|avenue|road|rd\b|subd|subdivision|luzon|metro/i;
    const candidates = headerLines
        .map((line) => line.trim())
        .filter((line) => line.length >= 8)
        .filter((line) => !skipPattern.test(line));
    const strong = candidates.find((line) => addressPattern.test(line));
    return strong || null;
}
function normalizeAmount(raw) {
    const cleaned = raw.replace(/[Oo](?=\d|\.|,|$)/g, '0').replace(/[^0-9.-]/g, '');
    if (!cleaned)
        return null;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : null;
}
function normalizeDate(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const year = Number(trimmed.slice(0, 4));
        if (year < 1900 || year > 2100)
            return null;
        return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return null;
    const year = parsed.getFullYear();
    if (year < 1900 || year > 2100)
        return null;
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function normalizeBillDate(raw) {
    const normalized = normalizeDate(raw);
    if (!normalized)
        return null;
    const year = Number(normalized.slice(0, 4));
    const maxYear = new Date().getFullYear() + 1;
    if (year < 2015 || year > maxYear)
        return null;
    return normalized;
}
function findFirstMatch(text, patterns) {
    for (const pattern of patterns) {
        const matched = text.match(pattern);
        if (matched?.[1])
            return matched[1].trim();
    }
    return null;
}
function normalizeOcrText(text) {
    return text
        .replace(/№|Nº|N°/g, ' No ')
        .replace(/[“”]/g, '"')
        .replace(/[’]/g, "'")
        .replace(/\u00A0/g, ' ')
        .replace(/[|]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\r/g, '\n');
}
function parseAmountToken(token) {
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
function collectAmounts(line) {
    return [...line.matchAll(/([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})?|[\d]+(?:\.\d{1,2})?)/g)]
        .map((match) => parseAmountToken(match[1]))
        .filter((value) => value !== null);
}
function sanitizeExtractedToken(raw) {
    if (!raw)
        return null;
    const cleaned = raw
        .replace(/^[:#\-\s]+/g, '')
        .replace(/^(?:No\.?\s*)+/i, '')
        .replace(/^#+/g, '')
        .trim();
    return cleaned || null;
}
function sanitizeBillIdentifier(raw, minLength = 5) {
    const cleaned = sanitizeExtractedToken(raw);
    if (!cleaned)
        return null;
    const compact = cleaned.replace(/\s+/g, '');
    if (compact.length < minLength)
        return null;
    if (!/\d/.test(compact))
        return null;
    return compact;
}
function findLikelyTotalAmount(text, lines) {
    const weightedCandidates = [];
    const bottomLines = lines.slice(Math.max(0, Math.floor(lines.length * 0.65)));
    const bottomLabeledLines = bottomLines.filter((line) => /total|amount\s*due|balance\s*due|net\s*payable|total\s*usd|usd|php|₱|\$/i.test(line));
    for (const line of bottomLabeledLines) {
        for (const amount of collectAmounts(line)) {
            weightedCandidates.push({ value: amount, weight: 1.15 });
        }
    }
    for (const line of bottomLines) {
        for (const amount of collectAmounts(line)) {
            if (amount >= 10) {
                weightedCandidates.push({ value: amount, weight: 0.95 });
            }
        }
    }
    const labeledAnywhere = lines.filter((line) => /total|amount\s*due|balance\s*due|net\s*payable|total\s*usd/i.test(line));
    for (const line of labeledAnywhere) {
        for (const amount of collectAmounts(line)) {
            weightedCandidates.push({ value: amount, weight: 0.9 });
        }
    }
    const allAmountCandidates = [...text.matchAll(/([\d]{1,3}(?:,[\d]{3})*(?:\.\d{1,2})|[\d]+(?:\.\d{1,2}))/g)]
        .map((m) => parseAmountToken(m[1]))
        .filter((value) => value !== null && value >= 10);
    if (allAmountCandidates.length > 0) {
        weightedCandidates.push({ value: Math.max(...allAmountCandidates), weight: 0.55 });
    }
    if (!weightedCandidates.length) {
        return null;
    }
    weightedCandidates.sort((a, b) => {
        if (b.weight !== a.weight)
            return b.weight - a.weight;
        return b.value - a.value;
    });
    return weightedCandidates[0].value;
}
function findLikelyInvoiceDate(text, lines) {
    const datePattern = /([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i;
    const skipContext = /b\.?i\.?r|permit|tin|valid|issued|received|delivered|signature|printed\s*name/i;
    const headerLines = lines.slice(0, 40);
    for (const line of headerLines) {
        if (!/(?:invoice\s*date|\bdate\b|dated)/i.test(line) || skipContext.test(line)) {
            continue;
        }
        const match = line.match(datePattern);
        if (!match)
            continue;
        const normalized = normalizeDate(match[1]);
        if (normalized)
            return normalized;
    }
    for (const line of headerLines) {
        if (skipContext.test(line))
            continue;
        const match = line.match(datePattern);
        if (!match)
            continue;
        const normalized = normalizeDate(match[1]);
        if (normalized)
            return normalized;
    }
    const fallbackMatches = [...text.matchAll(/\b([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g)];
    for (const match of fallbackMatches) {
        const surroundingText = text.slice(Math.max(0, match.index - 30), (match.index || 0) + match[0].length + 30);
        if (skipContext.test(surroundingText))
            continue;
        const normalized = normalizeDate(match[1]);
        if (normalized)
            return normalized;
    }
    return null;
}
function findLikelyVendorName(text, lines) {
    const labeledPatterns = [
        /(?:sold\s*to|payee|payor|company|customer|billed\s*to|bill\s*to|vendor|supplier|from)\s*[:#-]?\s*([^\n\r]+)/i,
    ];
    const headerText = lines.slice(0, 45).join('\n');
    const labeled = findFirstMatch(headerText, labeledPatterns);
    if (labeled) {
        const cleaned = labeled
            .replace(/\s{2,}.*/g, '')
            .replace(/[|]+/g, ' ')
            .trim();
        if (cleaned && cleaned.length >= 4) {
            return cleaned;
        }
    }
    const fallback = lines
        .slice(0, 35)
        .find((line) => /^[A-Za-z][A-Za-z0-9 .,&'()-]{4,}$/.test(line) && !/invoice|amount|date|bill|voucher|stock code|description|address|terms|salesman/i.test(line));
    return fallback || null;
}
function findLikelyInvoiceNumber(text, lines) {
    const headerText = lines.slice(0, 45).join('\n');
    const strong = findFirstMatch(headerText, [
        /(?:sales\s*invoice|\binvoice\b|\bsi\b)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(?:No\s*)?([A-Z0-9\/-]{2,})/i,
        /(?:\binvoice\b\s*(?:no\.?|number|#)|\bsi\b\s*no\.?|ref(?:erence)?\s*(?:no\.?|#)?|voucher\s*no\.?|bill\s*no\.?|p\.?\s*o\.?\s*no\.?)\s*[:#-]?\s*(?:No\s*)?([A-Z0-9\/-]{2,})/i,
        /(?:\bno\.?|#)\s*[:#-]?\s*(\d{3,10})\b/i,
    ]);
    const normalizedStrong = sanitizeExtractedToken(strong);
    if (normalizedStrong)
        return normalizedStrong;
    const anywhere = findFirstMatch(text, [
        /(?:\binvoice\b\s*(?:no\.?|number|#)|\bsi\b\s*no\.?|reference\s*(?:no\.?|#)?|ref\s*(?:no\.?|#)?|voucher\s*no\.?|bill\s*no\.?)\s*[:#-]?\s*(?:No\s*)?([A-Z0-9\/-]{2,})/i,
    ]);
    return sanitizeExtractedToken(anywhere);
}
function clamp01(value) {
    if (value < 0)
        return 0;
    if (value > 1)
        return 1;
    return Number(value.toFixed(2));
}
function estimateDocumentQuality(text, lines) {
    const compact = text.replace(/\s+/g, '');
    const totalChars = compact.length;
    if (!totalChars)
        return 0;
    const alnumChars = (compact.match(/[A-Za-z0-9]/g) || []).length;
    const lineCount = lines.length;
    const lengthScore = Math.min(totalChars / 900, 1);
    const lineScore = Math.min(lineCount / 45, 1);
    const clarityScore = alnumChars / totalChars;
    return clamp01(lengthScore * 0.5 + lineScore * 0.2 + clarityScore * 0.3);
}
function hasStrongLabel(text, pattern) {
    return pattern.test(text);
}
function buildConfidenceScores(fields, context) {
    const docQuality = estimateDocumentQuality(context.normalizedText, context.lines);
    const strongTotal = hasStrongLabel(context.normalizedText, /(?:grand\s*total|total\s*amount\s*due|total\s*amount|amount\s*due|balance\s*due|net\s*payable|\btotal\b)\s*[:#-]?/i);
    const strongDate = hasStrongLabel(context.normalizedText, /(?:invoice\s*date|dated|\bdate\b)\s*[:#-]?/i);
    const strongVendor = hasStrongLabel(context.normalizedText, /(?:vendor|supplier|payee|billed\s*by|from)\s*[:#-]?/i);
    const strongInvoiceNo = hasStrongLabel(context.normalizedText, /(?:invoice\s*(?:no\.?|number|#)|reference\s*(?:no\.?|#)?|ref\s*(?:no\.?|#)?|voucher\s*no\.?|bill\s*no\.?|p\.?\s*o\.?\s*no\.?)\s*[:#-]?/i);
    const confidence = {
        total_amount: fields.total_amount !== null ? clamp01(0.58 + docQuality * 0.24 + (strongTotal ? 0.14 : 0.04)) : clamp01(0.06 + docQuality * 0.12),
        invoice_date: fields.invoice_date !== null ? clamp01(0.56 + docQuality * 0.22 + (strongDate ? 0.16 : 0.05)) : clamp01(0.05 + docQuality * 0.11),
        vendor_name: fields.vendor_name !== null ? clamp01(0.52 + docQuality * 0.24 + (strongVendor ? 0.14 : 0.06)) : clamp01(0.05 + docQuality * 0.11),
        invoice_number: fields.invoice_number !== null ? clamp01(0.55 + docQuality * 0.23 + (strongInvoiceNo ? 0.15 : 0.05)) : clamp01(0.05 + docQuality * 0.11),
    };
    return { confidence, docQuality };
}
function extractTextFromSpreadsheet(bytes) {
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    const chunks = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet)
            continue;
        chunks.push(`Sheet: ${sheetName}`);
        chunks.push(XLSX.utils.sheet_to_csv(sheet, { blankrows: false }));
    }
    return chunks.join('\n').trim();
}
async function extractTextFromWord(bytes, mimeType) {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: bytes });
        return (result.value || '').trim();
    }
    const utf8Fallback = bytes.toString('utf8').replace(/\u0000/g, ' ').trim();
    return utf8Fallback;
}
async function extractTextWithTesseract(bytes) {
    const worker = await createWorker('eng');
    try {
        const variants = [{ label: 'original', buffer: bytes }];
        try {
            const normalized = await sharp(bytes)
                .rotate()
                .grayscale()
                .normalize()
                .sharpen()
                .resize({ width: 2200, withoutEnlargement: true })
                .toBuffer();
            variants.push({ label: 'normalized', buffer: normalized });
        }
        catch {
        }
        try {
            const thresholded = await sharp(bytes)
                .rotate()
                .grayscale()
                .median(1)
                .normalize()
                .threshold(170)
                .resize({ width: 2200, withoutEnlargement: true })
                .toBuffer();
            variants.push({ label: 'thresholded', buffer: thresholded });
        }
        catch {
        }
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
                }
                catch {
                }
            }
        }
        return bestText;
    }
    finally {
        await worker.terminate();
    }
}
function scoreRecognizedText(text) {
    if (!text)
        return 0;
    const trimmed = text.trim();
    const compact = trimmed.replace(/\s+/g, '');
    if (!compact)
        return 0;
    const lengthScore = Math.min(compact.length / 1200, 1);
    const lineScore = Math.min(trimmed.split(/\r?\n/).filter(Boolean).length / 40, 1);
    const alphaNumCount = (compact.match(/[A-Za-z0-9]/g) || []).length;
    const alphaNumRatio = alphaNumCount / compact.length;
    return lengthScore * 0.5 + lineScore * 0.2 + alphaNumRatio * 0.3;
}
function extractFromText(text, context = {}) {
    const normalizedText = normalizeOcrText(text);
    const normalizedLines = normalizedText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const billHint = isLikelyBillDocument(context.documentTypeHint);
    const detectedProvider = detectBillProvider(normalizedText);
    const billTotalAmount = billHint || detectedProvider ? findLikelyBillAmount(normalizedText, detectedProvider) : null;
    const billDate = billHint || detectedProvider ? findLikelyBillDate(normalizedText, detectedProvider) : null;
    const billReferenceNumber = billHint || detectedProvider ? findLikelyBillReferenceNumber(normalizedText, detectedProvider) : null;
    const billAccountNumber = billHint || detectedProvider ? findLikelyBillAccountNumber(normalizedText, detectedProvider) : null;
    const billPeriod = billHint || detectedProvider ? findLikelyBillingPeriod(normalizedText) : { start: null, end: null };
    const billDueDate = billHint || detectedProvider
        ? normalizeBillDate(findCapturedNearLabels(normalizedText, ['due\\s*date', 'payment\\s*due'], DATE_CAPTURE_PATTERN, 400)
            || findFirstCaptured(normalizedText, [
                /(?:due\s*date|payment\s*due)\s*[:#-]?\s*([A-Za-z]{3,9}\s*\d{1,2}\s*,?\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i,
            ])
            || '')
        : null;
    const billServiceAddress = billHint || detectedProvider ? findLikelyServiceAddress(normalizedLines) : null;
    const utilityClassification = billHint || detectedProvider
        ? detectUtilityClassification(normalizedText, detectedProvider)
        : { utility_type: null, utility_provider: null };
    const total_amount = billTotalAmount ?? findLikelyTotalAmount(normalizedText, normalizedLines);
    const invoice_date = billHint || detectedProvider
        ? (billDate ?? billPeriod.end ?? billPeriod.start ?? null)
        : (findLikelyInvoiceDate(normalizedText, normalizedLines));
    const vendor_name = detectedProvider?.canonicalName ?? findLikelyVendorName(normalizedText, normalizedLines);
    const invoice_number = billReferenceNumber ?? billAccountNumber ?? findLikelyInvoiceNumber(normalizedText, normalizedLines);
    const { confidence, docQuality } = buildConfidenceScores({
        total_amount,
        invoice_date,
        vendor_name,
        invoice_number,
    }, {
        normalizedText,
        lines: normalizedLines,
    });
    const warnings = [];
    if (total_amount === null)
        warnings.push('Local OCR could not confidently find total amount.');
    if (invoice_date === null)
        warnings.push('Local OCR could not confidently find invoice date.');
    if (vendor_name === null)
        warnings.push('Local OCR could not confidently find vendor/supplier name.');
    if (invoice_number === null)
        warnings.push('Local OCR could not confidently find invoice/reference number.');
    if (docQuality < 0.35)
        warnings.push('Document readability is low. Use a clearer scan or higher-resolution file for better OCR quality.');
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
export function extractFromRawText(text, context = {}) {
    return extractFromText(text, context);
}
export async function extractWithLocalOcr(candidate) {
    let rawText = '';
    const extractionWarnings = [];
    if (candidate.mimeType === 'application/pdf') {
        const parsed = await pdfParse(candidate.bytes);
        rawText = parsed.text || '';
        const compactPdfText = rawText.replace(/\s+/g, '');
        if (compactPdfText.length < 40) {
            try {
                const rasterizedPage = await sharp(candidate.bytes, { density: 220 })
                    .png({ quality: 100 })
                    .toBuffer();
                const tesseractText = await extractTextWithTesseract(rasterizedPage);
                if (tesseractText.trim()) {
                    rawText = tesseractText;
                    extractionWarnings.push('PDF text layer is weak. Applied local OCR fallback on rasterized document image.');
                }
            }
            catch {
                extractionWarnings.push('PDF appears image-based and OCR fallback rasterization is unavailable in this runtime.');
            }
        }
    }
    else if (candidate.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        candidate.mimeType === 'application/vnd.ms-excel') {
        rawText = extractTextFromSpreadsheet(candidate.bytes);
    }
    else if (candidate.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        candidate.mimeType === 'application/msword') {
        rawText = await extractTextFromWord(candidate.bytes, candidate.mimeType);
    }
    else {
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
