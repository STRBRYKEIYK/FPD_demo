import { extractWithLocalOcr } from './localOcr.service.js';
import { extractWithPythonOcr } from './pythonOcr.service.js';
function normalizeProvider(rawProvider) {
    const normalized = (rawProvider || '').trim().toLowerCase();
    return normalized || 'local';
}
export async function extractDocumentWithOcr(candidate) {
    const provider = normalizeProvider(process.env.OCR_PROVIDER);
    if (provider === 'python') {
        try {
            return await extractWithPythonOcr(candidate);
        }
        catch (error) {
            const localResult = await extractWithLocalOcr(candidate);
            const message = error instanceof Error ? error.message : 'Python OCR provider failed.';
            return {
                ...localResult,
                warnings: [`${message} Falling back to local OCR.`, ...localResult.warnings],
            };
        }
    }
    const localResult = await extractWithLocalOcr(candidate);
    if (provider !== 'local') {
        return {
            ...localResult,
            warnings: [
                `OCR_PROVIDER="${provider}" is not available in local-only mode. Falling back to local OCR.`,
                ...localResult.warnings,
            ],
        };
    }
    return localResult;
}
