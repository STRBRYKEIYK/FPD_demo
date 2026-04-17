import express from 'express';
import multer from 'multer';
import { financialDocSchema } from '../schemas/financialDoc.schema.js';
import { extractDocumentWithOcr } from '../services/ocr/ocrOrchestrator.service.js';
import { computeImmutableHash } from '../services/storage/originalArchive.service.js';
const upload = multer({ storage: multer.memoryStorage() });
const acceptedMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
export const ingestRouter = express.Router();
ingestRouter.post('/upload', upload.single('document'), async (req, res) => {
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
    const extraction = await extractDocumentWithOcr({
        source: 'manual_upload',
        filename: file.originalname,
        mimeType: file.mimetype,
        bytes: file.buffer,
        documentTypeHint: documentTypeHint || undefined,
        sourceSectionHint: sourceSectionHint || undefined,
    });
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
});
ingestRouter.post('/confirm-save', async (req, res) => {
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
