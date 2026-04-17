import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ValidationForm } from './ValidationForm';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function SplitScreenViewer({
  fileUrl,
  fileObject,
  fileMimeType,
  fileName,
  fileSize,
  extractedData,
  confidence,
  ocrTokens = [],
  draftTarget,
  draftData,
  onConfirm,
  isSaving = false,
}) {
  const [showOcrOverlay, setShowOcrOverlay] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  const isPdf = fileMimeType === 'application/pdf' || fileUrl?.toLowerCase().endsWith('.pdf');
  const isImage =
    fileMimeType === 'image/jpeg' ||
    fileMimeType === 'image/png' ||
    fileUrl?.toLowerCase().endsWith('.jpg') ||
    fileUrl?.toLowerCase().endsWith('.jpeg') ||
    fileUrl?.toLowerCase().endsWith('.png');

  const readableFileSize = Number.isFinite(fileSize)
    ? `${(fileSize / 1024 / 1024).toFixed(fileSize >= 1024 * 1024 ? 2 : 3)} MB`
    : null;
  const hasOcrTokens = Array.isArray(ocrTokens) && ocrTokens.length > 0;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  useEffect(() => {
    setZoomLevel(1);
    setShowOcrOverlay(false);
  }, [fileUrl]);

  function handleImageLoaded(event) {
    const image = event.currentTarget;
    setImageNaturalSize({
      width: image.naturalWidth || 0,
      height: image.naturalHeight || 0,
    });
  }

  function applyZoom(delta) {
    setZoomLevel((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((current + delta).toFixed(2)))));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-black">
        {isImage && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Zoom: {Math.round(zoomLevel * 100)}%
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyZoom(-ZOOM_STEP)}
                disabled={zoomLevel <= MIN_ZOOM}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => applyZoom(ZOOM_STEP)}
                disabled={zoomLevel >= MAX_ZOOM}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
              >
                +
              </button>

              {hasOcrTokens && (
                <button
                  type="button"
                  onClick={() => setShowOcrOverlay((current) => !current)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                    showOcrOverlay
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-200'
                      : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
                  }`}
                >
                  {showOcrOverlay ? 'Hide OCR Highlights' : 'Show OCR Highlights'} ({ocrTokens.length})
                </button>
              )}
            </div>
          </div>
        )}

        {fileUrl ? (
          isPdf ? (
            <Document
              file={fileObject || fileUrl}
              loading={<div className="flex h-[480px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading PDF preview...</div>}
              error={<div className="flex h-[480px] items-center justify-center text-sm text-rose-500">Unable to preview PDF.</div>}
            >
              <Page pageNumber={1} width={560} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          ) : isImage ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto">
              <div
                className="relative inline-block"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                }}
              >
                <img
                  src={fileUrl}
                  alt="Scanned document preview"
                  onLoad={handleImageLoaded}
                  className="max-h-[480px] w-auto rounded-lg object-contain"
                />

                {showOcrOverlay && hasOcrTokens && imageNaturalSize.width > 0 && imageNaturalSize.height > 0 && (
                  <div className="absolute inset-0 overflow-hidden rounded-lg">
                    {ocrTokens.map((token, index) => {
                      const left = (token.x / imageNaturalSize.width) * 100;
                      const top = (token.y / imageNaturalSize.height) * 100;
                      const width = (token.width / imageNaturalSize.width) * 100;
                      const height = (token.height / imageNaturalSize.height) * 100;
                      const tokenText = String(token.word || '').trim();

                      if (!tokenText) {
                        return null;
                      }

                      return (
                        <span
                          key={`${token.word}-${index}`}
                          className="absolute overflow-hidden rounded-[2px] border border-yellow-400/80 bg-yellow-200/35 px-[1px] text-[10px] leading-tight text-slate-900 select-text"
                          title={tokenText}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${Math.max(width, 0.6)}%`,
                            height: `${Math.max(height, 0.6)}%`,
                          }}
                        >
                          {tokenText}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-[480px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-black">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Document selected</p>
              <p className="mt-1 max-w-md truncate text-xs text-slate-500 dark:text-slate-400">{fileName || 'Unnamed file'}</p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Type: {fileMimeType || 'Unknown'}</p>
              {readableFileSize && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Size: {readableFileSize}</p>}
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Preview rendering is limited for this format, but OCR extraction is available.</p>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No document selected</div>
        )}
      </section>

      <section>
        <ValidationForm
          extractedData={extractedData}
          confidence={confidence}
          draftTarget={draftTarget}
          draftData={draftData}
          onConfirm={onConfirm}
          isSaving={isSaving}
        />
      </section>
    </div>
  );
}
