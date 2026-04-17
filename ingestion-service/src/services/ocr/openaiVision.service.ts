import type { ExtractionResult, IngestionCandidate } from '../../types/shared.js';
import { extractDocumentWithOcr } from './ocrOrchestrator.service.js';

export async function extractWithOpenAIVision(candidate: IngestionCandidate): Promise<ExtractionResult> {
  return extractDocumentWithOcr(candidate);
}

export { extractDocumentWithOcr };
