import type { FinancialDoc } from '../schemas/financialDoc.schema.js';

export type IngestionSource = 'manual_upload' | 'imap' | 's3';

export interface IngestionCandidate {
  source: IngestionSource;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  documentTypeHint?: string;
  sourceSectionHint?: string;
}

export interface OcrToken {
  word: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  polygon: [number, number][];
}

export interface ExtractionResult {
  data: FinancialDoc;
  confidence: {
    total_amount: number;
    invoice_date: number;
    vendor_name: number;
    invoice_number: number;
  };
  warnings: string[];
  ocr_tokens?: OcrToken[];
}
