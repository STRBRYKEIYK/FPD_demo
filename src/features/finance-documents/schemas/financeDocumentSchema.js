import { z } from 'zod';

export const financeDocumentSchema = z.object({
  total_amount: z.number().nullable(),
  invoice_date: z.string().nullable(),
  vendor_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  account_number: z.string().nullable().optional(),
  billing_period_start: z.string().nullable().optional(),
  billing_period_end: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  service_address: z.string().nullable().optional(),
});

export const confidenceSchema = z.object({
  total_amount: z.number().min(0).max(1),
  invoice_date: z.number().min(0).max(1),
  vendor_name: z.number().min(0).max(1),
  invoice_number: z.number().min(0).max(1),
});

export const ocrTokenSchema = z.object({
  word: z.string(),
  confidence: z.number().min(0).max(1),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  polygon: z.array(z.tuple([z.number(), z.number()])).length(4),
});

export const financeExtractionResponseSchema = z.object({
  data: financeDocumentSchema,
  confidence: confidenceSchema,
  warnings: z.array(z.string()).default([]),
  ocr_tokens: z.array(ocrTokenSchema).optional().default([]),
  source_file_url: z.string().url().or(z.string().min(1)),
});
