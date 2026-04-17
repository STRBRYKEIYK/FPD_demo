import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ScanningDocumentAnimation } from './ScanningDocumentAnimation';

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const FORMAT_TAGS = ['XLSX', 'PDF', 'DOCX', 'JPEG', 'PNG'];

export function DocumentUploader({
  onFileSelected,
  disabled = false,
  isScanning = false,
  hasQueue = false,
  processingFileName = '',
  processingProgress = { current: 0, total: 0 },
  elapsedSeconds = 0,
}) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles?.length && onFileSelected) {
        onFileSelected(acceptedFiles);
      }
    },
    [onFileSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled,
    accept: ACCEPTED_TYPES,
  });

  const totalFiles = Number(processingProgress?.total || 0);
  const currentFile = Number(processingProgress?.current || 0);
  const completedPercent = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 100) : 0;
  const timeBasedPercent = Math.min(95, Math.round((Math.max(0, elapsedSeconds) / 30) * 95));
  const progressPercent = isScanning
    ? Math.max(3, Math.min(Math.max(completedPercent, timeBasedPercent), 95))
    : Math.max(0, Math.min(completedPercent, 100));

  const minutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
  const seconds = Math.max(0, elapsedSeconds) % 60;
  const elapsedLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      {...getRootProps()}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ease-in-out ${
        isDragActive
          ? 'border-[#8A9A5B] bg-[#F2F4ED] shadow-[0_0_0_4px_rgba(138,154,91,0.15)] dark:border-[#8A9A5B]/60 dark:bg-[#8A9A5B]/10'
          : isScanning
            ? 'border-stone-200/80 bg-[#FCFBFA] dark:border-stone-700/60 dark:bg-stone-900'
            : 'border-stone-200/80 bg-[#FCFBFA] hover:border-[#8A9A5B]/50 hover:shadow-sm dark:border-stone-700/60 dark:bg-stone-900 dark:hover:border-[#8A9A5B]/40'
      } ${disabled && !isScanning ? 'cursor-not-allowed opacity-60' : isScanning ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <input {...getInputProps()} />

      {/* Scanning shimmer strip */}
      {isScanning && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#8A9A5B] to-transparent" />
        </div>
      )}

      <div className="px-6 py-8">
        {isScanning ? (
          /* ── Scanning state ── */
          <div className="flex flex-col items-center gap-5">
            <ScanningDocumentAnimation />

            <div className="w-full max-w-sm space-y-3.5 text-center">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                Scanning document…
              </p>

              {/* File name + counters */}
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="max-w-[160px] truncate text-stone-500 dark:text-stone-400">
                  {processingFileName || 'Preparing scanner…'}
                </span>
                <div className="flex items-center gap-2 text-[#5A6638] dark:text-[#AAB685]">
                  <span>{progressPercent}%</span>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span>
                    {currentFile}/{totalFiles || 0}
                  </span>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span className="font-mono tracking-tight">{elapsedLabel}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 overflow-hidden rounded-full bg-stone-200/80 dark:bg-stone-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#8A9A5B] to-[#AAB685] transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[10px] leading-relaxed text-stone-400 dark:text-stone-500">
                Upload finished — OCR extraction is still processing on server.
              </p>
            </div>
          </div>
        ) : (
          /* ── Idle / drop state ── */
          <div className="flex flex-col items-center gap-4">
            {/* Icon */}
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 ${
                isDragActive
                  ? 'scale-110 border-[#8A9A5B]/40 bg-[#E1E6D5]/50 text-[#4A5320] shadow-sm dark:border-[#8A9A5B]/50 dark:bg-[#8A9A5B]/20 dark:text-[#D4DFB1]'
                  : 'border-stone-200 bg-white text-stone-400 group-hover:-translate-y-0.5 group-hover:shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500'
              }`}
            >
              {isDragActive ? (
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4v12M7 9l5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 20h14"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 2v6h6M12 12v6M9 15l3-3 3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Copy */}
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                {isDragActive
                  ? 'Drop files here'
                  : hasQueue
                    ? 'Add more files to queue'
                    : 'Drop SI, bill, or voucher here'}
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                or{' '}
                <span className="font-medium text-[#78874D] underline-offset-2 transition-colors hover:text-[#5A6638] hover:underline dark:text-[#AAB685] dark:hover:text-[#D4DFB1]">
                  click to browse
                </span>
              </p>
            </div>

            {/* Format badges */}
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {FORMAT_TAGS.map((fmt) => (
                <span
                  key={fmt}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400 shadow-sm transition-colors group-hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500"
                >
                  {fmt}
                </span>
              ))}
              <span className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-400 shadow-sm transition-colors group-hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500">
                Multiple files
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}