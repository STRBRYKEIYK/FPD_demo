import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { financialDocSchema } from '../schemas/financialDoc.schema.js';
import { extractDocumentWithOcr } from '../services/ocr/ocrOrchestrator.service.js';
import { computeImmutableHash } from '../services/storage/originalArchive.service.js';

const configuredUploadLimitMb = Number(process.env.INGEST_MAX_UPLOAD_MB || 12);
const maxUploadLimitMb = Number.isFinite(configuredUploadLimitMb) && configuredUploadLimitMb > 0
  ? configuredUploadLimitMb
  : 12;
const maxUploadBytes = Math.round(maxUploadLimitMb * 1024 * 1024);
const configuredMaxConcurrentJobs = Number(process.env.OCR_MAX_CONCURRENT_JOBS || 1);
const maxConcurrentOcrJobs = Number.isFinite(configuredMaxConcurrentJobs) && configuredMaxConcurrentJobs > 0
  ? Math.max(1, Math.floor(configuredMaxConcurrentJobs))
  : 1;
const configuredMaxQueuedJobs = Number(process.env.OCR_MAX_QUEUE_LENGTH || 2);
const maxQueuedOcrJobs = Number.isFinite(configuredMaxQueuedJobs) && configuredMaxQueuedJobs >= 0
  ? Math.max(0, Math.floor(configuredMaxQueuedJobs))
  : 2;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
  },
});
const acceptedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

class OcrBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrBusyError';
  }
}

const queuedOcrJobs: Array<() => void> = [];
let activeOcrJobs = 0;

function getOcrLoadSnapshot() {
  return {
    active_jobs: activeOcrJobs,
    queued_jobs: queuedOcrJobs.length,
    max_concurrent_jobs: maxConcurrentOcrJobs,
    max_queued_jobs: maxQueuedOcrJobs,
  };
}

async function executeOcrJob<T>(job: () => Promise<T>): Promise<T> {
  activeOcrJobs += 1;
  try {
    return await job();
  } finally {
    activeOcrJobs = Math.max(0, activeOcrJobs - 1);
    const nextJob = queuedOcrJobs.shift();
    if (nextJob) {
      nextJob();
    }
  }
}

function runOcrJob<T>(job: () => Promise<T>): Promise<T> {
  if (activeOcrJobs < maxConcurrentOcrJobs) {
    return executeOcrJob(job);
  }

  if (queuedOcrJobs.length >= maxQueuedOcrJobs) {
    throw new OcrBusyError('OCR service is busy. Please retry in a few seconds.');
  }

  return new Promise<T>((resolve, reject) => {
    queuedOcrJobs.push(() => {
      void executeOcrJob(job).then(resolve, reject);
    });
  });
}

function handleDocumentUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('document')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        message: `Uploaded document exceeds the ${maxUploadLimitMb} MB limit.`,
      });
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
}

export const ingestRouter = express.Router();

ingestRouter.post('/upload', handleDocumentUpload, async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No document file was uploaded.' });
    }

    if (!acceptedMimeTypes.has(file.mimetype)) {
      return res.status(400).json({
        message: 'Unsupported file type. Allowed types are XLSX, PDF, DOCS, JPEG, PNG, and JPG.',
      });
    }

    const immutableHash = computeImmutableHash(file.buffer);
    const documentTypeHint = typeof req.body?.document_type === 'string' ? req.body.document_type.trim() : '';
    const sourceSectionHint = typeof req.body?.source_section === 'string' ? req.body.source_section.trim() : '';
    const extraction = await runOcrJob(() => extractDocumentWithOcr({
      source: 'manual_upload',
      filename: file.originalname,
      mimeType: file.mimetype,
      bytes: file.buffer,
      documentTypeHint: documentTypeHint || undefined,
      sourceSectionHint: sourceSectionHint || undefined,
    }));

    res.setHeader('X-OCR-Active-Jobs', String(activeOcrJobs));
    res.setHeader('X-OCR-Queued-Jobs', String(queuedOcrJobs.length));

    return res.status(200).json({
      data: extraction.data,
      confidence: extraction.confidence,
      warnings: extraction.warnings,
      ocr_tokens: extraction.ocr_tokens || [],
      source_file_url: `uploaded://${encodeURIComponent(file.originalname)}`,
      source_file_hash: immutableHash,
      source_file_name: file.originalname,
      source_mime_type: file.mimetype,
      source_size_bytes: file.size,
    });
  } catch (error) {
    if (error instanceof OcrBusyError) {
      res.setHeader('Retry-After', '8');
      return res.status(503).json({
        message: error.message,
        load: getOcrLoadSnapshot(),
      });
    }

    const message = error instanceof Error && error.message.trim()
      ? error.message
      : 'Document extraction failed.';
    return res.status(500).json({ message });
  }
});

ingestRouter.post('/confirm-save', async (req: Request, res: Response) => {
  const parseResult = financialDocSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      message: 'Invalid financial document payload.',
      issues: parseResult.error.flatten(),
    });
  }

  return res.status(202).json({
    message: 'Validation accepted. Persistence is intentionally not executed in this stage.',
    confirmed_data: parseResult.data,
    auto_saved: false,
  });
});
