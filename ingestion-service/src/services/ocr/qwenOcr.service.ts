/**
 * Qwen-VL OCR provider via OpenRouter (https://openrouter.ai).
 * Globally accessible — no Chinese phone number required.
 * Set OCR_PROVIDER=qwen in your .env and provide OPENROUTER_API_KEY.
 *
 * Env vars:
 *   OPENROUTER_API_KEY       - required, get from https://openrouter.ai/keys
 *   QWEN_MODEL               - optional, defaults to "qwen/qwen2.5-vl-72b-instruct"
 *   QWEN_MAX_TOKENS          - optional, defaults to 4096
 *   QWEN_OCR_TIMEOUT_MS      - optional, defaults to 30000 (30 s)
 *   QWEN_OCR_PROMPT          - optional, override the extraction prompt
 */

import sharp from 'sharp';
import type { ExtractionResult, IngestionCandidate, OcrToken } from '../../types/shared.js';
import { extractFromRawText } from './localOcr.service.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenRouterRequest {
  model: string;
  max_tokens?: number;
  messages: Array<{
    role: string;
    content: OpenRouterContentPart[];
  }>;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is not set. Add it to your .env file. Get a key at https://openrouter.ai/keys');
  }
  return key;
}

function getModel(): string {
  return process.env.QWEN_MODEL?.trim() || 'qwen/qwen2.5-vl-72b-instruct';
}

function getTimeoutMs(): number {
  const t = Number(process.env.QWEN_OCR_TIMEOUT_MS);
  return Number.isFinite(t) && t > 0 ? t : 30_000;
}

function getMaxTokens(): number {
  const configured = Number(process.env.QWEN_MAX_TOKENS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(256, Math.min(8192, Math.floor(configured)));
  }
  return 4096;
}

function getPrompt(documentTypeHint?: string): string {
  const override = process.env.QWEN_OCR_PROMPT?.trim();
  if (override) return override;
  const docType = documentTypeHint ? ` This document is a ${documentTypeHint}.` : '';
  return (
    `Extract ALL visible text from this image exactly as it appears.${docType} ` +
    'Include every number, date, label, amount, name, and identifier you can see. ' +
    'Preserve the original layout line by line.'
  );
}

/** Convert a Buffer to a base64 data-URI accepted by OpenRouter. */
function bufferToDataUri(bytes: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

/**
 * Build synthetic OcrToken[] from plain text by estimating word positions
 * proportionally against the actual image dimensions (obtained via sharp).
 * Positions won't be pixel-perfect but are good enough for the OCR overlay.
 */
async function synthesizeOcrTokens(rawText: string, imageBytes: Buffer): Promise<OcrToken[]> {
  let imgWidth = 800;
  let imgHeight = 1100;
  try {
    const meta = await sharp(imageBytes).metadata();
    imgWidth = meta.width ?? imgWidth;
    imgHeight = meta.height ?? imgHeight;
  } catch { /* use defaults if sharp fails */ }

  const lines = rawText.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim()).length || 1;
  const lineHeight = Math.max(16, Math.floor(imgHeight / (nonEmptyLines + 2)));

  const tokens: OcrToken[] = [];
  let lineY = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) { lineY += Math.floor(lineHeight * 0.5); continue; }

    const words = trimmedLine.split(/\s+/).filter(Boolean);
    const totalChars = Math.max(trimmedLine.length, 1);
    let charOffset = 0;

    for (const word of words) {
      const wordStart = trimmedLine.indexOf(word, charOffset);
      const x = Math.round((wordStart / totalChars) * imgWidth * 0.9 + imgWidth * 0.02);
      const width = Math.max(20, Math.round((word.length / totalChars) * imgWidth * 0.88));
      const height = Math.round(lineHeight * 0.85);
      tokens.push({
        word,
        confidence: 0.85,
        x,
        y: lineY,
        width,
        height,
        polygon: [[x, lineY], [x + width, lineY], [x + width, lineY + height], [x, lineY + height]],
      });
      charOffset = wordStart + word.length;
    }
    lineY += lineHeight;
  }

  return tokens;
}

export async function extractWithQwenOcr(candidate: IngestionCandidate): Promise<ExtractionResult> {
  const warnings: string[] = [];

  const apiKey = getApiKey();
  const model = getModel();
  const maxTokens = getMaxTokens();
  const timeoutMs = getTimeoutMs();
  const prompt = getPrompt(candidate.documentTypeHint);

  const dataUri = bufferToDataUri(candidate.bytes, candidate.mimeType);

  const body: OpenRouterRequest = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUri } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };

  let rawText = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jjc.local',
        'X-Title': 'JJC Finance Ingestion',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const json = (await response.json()) as OpenRouterResponse;

    if (json.error?.message) {
      throw new Error(`OpenRouter error: ${json.error.message}`);
    }

    rawText = json.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Qwen OCR (OpenRouter) failed: ${msg}`);
  }

  if (!rawText) {
    warnings.push('Qwen-VL returned empty text.');
  }

  const result = extractFromRawText(rawText, { documentTypeHint: candidate.documentTypeHint });
  result.warnings.push(...warnings);

  // Synthesize OCR token overlay from the raw text + image dimensions
  if (rawText) {
    result.ocr_tokens = await synthesizeOcrTokens(rawText, candidate.bytes);
  }

  return result;
}

