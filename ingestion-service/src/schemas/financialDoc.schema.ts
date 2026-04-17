import { z } from 'zod';

export const financialDocSchema = z.object({
  total_amount: z.number().nullable(),
  invoice_date: z.string().nullable(),
  vendor_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  account_number: z.string().nullable().optional(),
  billing_period_start: z.string().nullable().optional(),
  billing_period_end: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  service_address: z.string().nullable().optional(),
  utility_type: z.enum(['electricity', 'water', 'internet']).nullable().optional(),
  utility_provider: z.string().nullable().optional(),
});

export const extractionConfidenceSchema = z.object({
  total_amount: z.number().min(0).max(1),
  invoice_date: z.number().min(0).max(1),
  vendor_name: z.number().min(0).max(1),
  invoice_number: z.number().min(0).max(1),
});

export type FinancialDoc = z.infer<typeof financialDocSchema>;
