import { extractDocumentWithOcr } from './ocrOrchestrator.service.js';
export async function extractWithOpenAIVision(candidate) {
    return extractDocumentWithOcr(candidate);
}
export { extractDocumentWithOcr };
