import type { ExtractionResult, IngestionCandidate } from '../../types/shared.js';
import { extractWithLocalOcr } from './localOcr.service.js';
import { extractWithPythonOcr } from './pythonOcr.service.js';
import { extractWithQwenOcr } from './qwenOcr.service.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

type OcrProvider = 'auto' | 'qwen' | 'python' | 'local';

function getImageOcrProviderOrder(): OcrProvider[] {
  const requested = (process.env.OCR_PROVIDER || 'auto').trim().toLowerCase();

  switch (requested) {
    case 'qwen':
      return ['qwen', 'python', 'local'];
    case 'python':
      return ['python', 'local'];
    case 'local':
      return ['local'];
    case 'auto':
    default:
      return ['qwen', 'python', 'local'];
  }
}

export async function extractDocumentWithOcr(candidate: IngestionCandidate): Promise<ExtractionResult> {
  const isImage = IMAGE_MIME_TYPES.has(candidate.mimeType);

  // Non-image files (PDF, XLSX, DOCX …) go straight to local OCR
  if (!isImage) {
    return extractWithLocalOcr(candidate);
  }

  // ── Image pipeline (configurable via OCR_PROVIDER) ───────────────────────
  const warnings: string[] = [];
  const providers = getImageOcrProviderOrder();

  for (const provider of providers) {
    if (provider === 'qwen') {
      try {
        const result = await extractWithQwenOcr(candidate);
        result.warnings = [...warnings, ...result.warnings];
        return result;
      } catch (qwenErr) {
        warnings.push(`Qwen OCR skipped: ${qwenErr instanceof Error ? qwenErr.message : String(qwenErr)}`);
      }
      continue;
    }

    if (provider === 'python') {
      try {
        const easyResult = await extractWithPythonOcr(candidate);
        easyResult.warnings = [...warnings, ...easyResult.warnings];
        return easyResult;
      } catch (easyErr) {
        warnings.push(`EasyOCR skipped: ${easyErr instanceof Error ? easyErr.message : String(easyErr)}`);
      }
      continue;
    }

    // Tesseract.js local fallback
    const localResult = await extractWithLocalOcr(candidate);
    localResult.warnings = [...warnings, ...localResult.warnings];
    return localResult;
  }

  // Defensive fallback in case provider order is empty due to bad config.
  const localResult = await extractWithLocalOcr(candidate);
  localResult.warnings = [...warnings, ...localResult.warnings];
  return localResult;
}
