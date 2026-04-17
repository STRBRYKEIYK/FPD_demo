import { useEffect, useMemo, useRef, useState } from 'react';
import { createActor } from 'xstate';
import { DocumentUploader } from '../components/DocumentUploader';
import { SplitScreenViewer } from '../components/SplitScreenViewer';
import { uploadFinanceDocument, confirmAndSaveFinanceDocument } from '../api/financeDocs.api';
import { documentIngestionMachine } from '../state/documentIngestion.machine';
import { mapOcrToFinanceDraft } from '../utils/ocrDraftBridge';

const EMPTY_EXTRACTION = {
  total_amount: null,
  invoice_date: null,
  vendor_name: null,
  invoice_number: null,
};

const EMPTY_CONFIDENCE = {
  total_amount: 0,
  invoice_date: 0,
  vendor_name: 0,
  invoice_number: 0,
};

const WORKFLOW_STEPS = ['awaitingScan', 'extractingData', 'pendingUserValidation', 'savedSuccessfully'];
const STEP_LABELS = {
  awaitingScan: 'Upload',
  extractingData: 'Extracting',
  pendingUserValidation: 'Review',
  savedSuccessfully: 'Done',
};

export default function FinanceDocumentIngestionPage({
  embedded = false,
  contextTitle = 'Finance Document OCR Validation',
  documentTypeHint = null,
  sourceSectionHint = null,
  onDraftPrepared,
}) {
  const actor = useMemo(() => createActor(documentIngestionMachine), []);
  const [workflowState, setWorkflowState] = useState('awaitingScan');
  const [queueItems, setQueueItems] = useState([]);
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingFileName, setProcessingFileName] = useState('');
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [scanStartedAt, setScanStartedAt] = useState(0);
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const [status, setStatus] = useState(null);
  const queueItemsRef = useRef([]);

  const activeItem = queueItems[activeQueueIndex] || null;
  const reviewedCount = queueItems.filter((item) => item.reviewed).length;
  const allReviewed = queueItems.length > 0 && reviewedCount === queueItems.length;

  useEffect(() => {
    actor.start();
    const subscription = actor.subscribe((snapshot) => {
      setWorkflowState(snapshot.value);
    });
    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, [actor]);

  useEffect(() => {
    queueItemsRef.current = queueItems;
  }, [queueItems]);

  useEffect(() => {
    return () => {
      queueItemsRef.current.forEach((item) => {
        if (item?.fileUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.fileUrl);
        }
      });
    };
  }, []);

  const isExtracting = workflowState === 'extractingData';
  const isScanning = isExtracting || isUploading;
  const canValidate = !!activeItem;
  const displayState = isScanning
    ? 'extractingData'
    : activeItem && workflowState === 'awaitingScan'
      ? 'pendingUserValidation'
      : workflowState;

  const stateLabelMap = {
    awaitingScan: 'Awaiting Scan',
    extractingData: 'Extracting Data',
    pendingUserValidation: 'Pending User Validation',
    saving: 'Saving',
    savedSuccessfully: 'Saved Successfully',
  };

  useEffect(() => {
    if (!isScanning || !scanStartedAt) {
      setScanElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => {
      setScanElapsedSeconds(Math.max(0, Math.floor((Date.now() - scanStartedAt) / 1000)));
    };
    updateElapsed();
    const timerId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timerId);
  }, [isScanning, scanStartedAt]);

  async function handleFileSelected(files) {
    if (!files?.length) return;

    const hadExistingQueue = queueItemsRef.current.length > 0;
    if (!hadExistingQueue) actor.send({ type: 'FILE_SELECTED' });

    const scanningStart = Date.now();
    const minScanningVisibilityMs = 900;
    setIsUploading(true);
    setScanStartedAt(scanningStart);
    setScanElapsedSeconds(0);

    const nextQueue = [];
    setProcessingProgress({ current: 0, total: files.length });

    try {
      for (const [index, file] of files.entries()) {
        const fileUrl = URL.createObjectURL(file);
        setProcessingFileName(file.name);
        setProcessingProgress({ current: index, total: files.length });
        try {
          const result = await uploadFinanceDocument(
            file,
            { document_type: documentTypeHint, source_section: sourceSectionHint },
            setStatus,
          );
          const bridge = mapOcrToFinanceDraft({
            documentTypeHint,
            sourceSectionHint,
            extractedData: result.data,
          });
          nextQueue.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            fileUrl,
            extractedData: result.data || EMPTY_EXTRACTION,
            confidence: result.confidence || EMPTY_CONFIDENCE,
            warnings: result.warnings || [],
            ocrTokens: result.ocr_tokens || [],
            draftTarget: bridge?.target || null,
            draftData: bridge?.draft || null,
            reviewed: false,
          });
        } catch (error) {
          const bridge = mapOcrToFinanceDraft({
            documentTypeHint,
            sourceSectionHint,
            extractedData: EMPTY_EXTRACTION,
          });
          const errorMessage =
            error instanceof Error && error.message
              ? error.message
              : 'Extraction failed for this file. Please validate fields manually.';
          nextQueue.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            fileUrl,
            extractedData: EMPTY_EXTRACTION,
            confidence: EMPTY_CONFIDENCE,
            warnings: [errorMessage],
            ocrTokens: [],
            draftTarget: bridge?.target || null,
            draftData: bridge?.draft || null,
            reviewed: false,
          });
        }
        setProcessingProgress({ current: index + 1, total: files.length });
      }

      const elapsed = Date.now() - scanningStart;
      if (elapsed < minScanningVisibilityMs) {
        await new Promise((resolve) => setTimeout(resolve, minScanningVisibilityMs - elapsed));
      }

      setQueueItems((previous) => [...previous, ...nextQueue]);

      if (!hadExistingQueue) {
        setActiveQueueIndex(0);
        actor.send({ type: 'EXTRACTION_READY' });
      }
    } finally {
      setIsUploading(false);
      setProcessingFileName('');
      setProcessingProgress({ current: 0, total: 0 });
      setScanStartedAt(0);
    }
  }

  function handleRemoveFromQueue(indexToRemove, event) {
    event.stopPropagation();

    const item = queueItemsRef.current[indexToRemove];
    if (item?.fileUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.fileUrl);
    }

    const nextQueue = queueItemsRef.current.filter((_, i) => i !== indexToRemove);
    setQueueItems(nextQueue);

    if (nextQueue.length === 0) {
      actor.send({ type: 'RESET' });
      setActiveQueueIndex(0);
      return;
    }

    setActiveQueueIndex((prev) => {
      if (indexToRemove < prev) return prev - 1;
      if (indexToRemove === prev) return Math.min(prev, nextQueue.length - 1);
      return prev;
    });
  }

  async function handleConfirmSave(formData) {
    const { __target, __draft, ...confirmPayload } = formData;
    const bridgePayload =
      __target && __draft
        ? { target: __target, draft: __draft }
        : mapOcrToFinanceDraft({
            documentTypeHint,
            sourceSectionHint,
            extractedData: confirmPayload,
          });

    const previousQueueSnapshot = queueItemsRef.current;
    const wasAlreadyReviewed = Boolean(previousQueueSnapshot[activeQueueIndex]?.reviewed);

    const updatedQueue = previousQueueSnapshot.map((item, index) => {
      if (index !== activeQueueIndex) return item;
      return { ...item, reviewed: true };
    });

    setQueueItems(updatedQueue);

    if (!wasAlreadyReviewed) {
      let nextUnreviewedIndex = updatedQueue.findIndex(
        (item, index) => index > activeQueueIndex && !item.reviewed,
      );
      if (nextUnreviewedIndex === -1) {
        nextUnreviewedIndex = updatedQueue.findIndex(
          (item, index) => index < activeQueueIndex && !item.reviewed,
        );
      }
      if (nextUnreviewedIndex !== -1) {
        setActiveQueueIndex(nextUnreviewedIndex);
      }
    }

    if (queueItemsRef.current.length === 1) {
      actor.send({ type: 'CONFIRM_SAVE' });
      setIsSaving(true);
      try {
        await confirmAndSaveFinanceDocument(confirmPayload);

        if (bridgePayload?.target && bridgePayload?.draft) {
          const singlePayload = {
            target: bridgePayload.target,
            draft: bridgePayload.draft,
            drafts: [bridgePayload.draft],
          };
          if (typeof onDraftPrepared === 'function') {
            onDraftPrepared(singlePayload);
          } else {
            window.dispatchEvent(
              new CustomEvent('finance:ocr-draft-ready', { detail: singlePayload }),
            );
          }
        }
        actor.send({ type: 'SAVE_SUCCESS' });
      } catch (_error) {
        actor.send({ type: 'SAVE_FAILED' });
        setQueueItems((previous) =>
          previous.map((item, index) => {
            if (index !== activeQueueIndex) return item;
            return {
              ...item,
              warnings: [...item.warnings, 'Save request failed. Please review and retry.'],
            };
          }),
        );
      } finally {
        setIsSaving(false);
      }
    }
  }

  async function handleContinueToBulkEditor() {
    if (!queueItems.length) return;

    actor.send({ type: 'CONFIRM_SAVE' });
    setIsSaving(true);

    try {
      const confirmedItems = queueItems.filter((item) => item.draftData);
      for (const item of confirmedItems) {
        await confirmAndSaveFinanceDocument(item.extractedData);
      }

      const target = confirmedItems[0]?.draftTarget || null;
      const drafts = confirmedItems.map((item) => item.draftData).filter(Boolean);

      if (target && drafts.length > 0) {
        const bridgePayload = { target, draft: drafts[0], drafts };
        if (typeof onDraftPrepared === 'function') {
          onDraftPrepared(bridgePayload);
        } else {
          window.dispatchEvent(
            new CustomEvent('finance:ocr-draft-ready', { detail: bridgePayload }),
          );
        }
      }

      actor.send({ type: 'SAVE_SUCCESS' });
    } catch (_error) {
      actor.send({ type: 'SAVE_FAILED' });
      setQueueItems((previous) =>
        previous.map((item, index) => {
          if (index !== activeQueueIndex) return item;
          return {
            ...item,
            warnings: [...item.warnings, 'Save request failed. Please review and retry.'],
          };
        }),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    queueItems.forEach((item) => {
      if (item?.fileUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.fileUrl);
      }
    });
    setQueueItems([]);
    setActiveQueueIndex(0);
    actor.send({ type: 'RESET' });
  }

  const currentStepIndex = WORKFLOW_STEPS.indexOf(displayState);

  return (
    <div
      className={`${embedded ? 'space-y-4' : 'mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6'}`}
    >
      {/* ── Header ── */}
      <header className="rounded-2xl border border-stone-200/80 bg-[#FCFBFA] px-5 py-4 shadow-sm transition-all dark:border-stone-700/60 dark:bg-black">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100">
              {contextTitle}
            </h1>
            {documentTypeHint && (
              <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                Context:{' '}
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  {documentTypeHint.replace('_', ' ')}
                </span>
              </p>
            )}
          </div>

          {/* Stepper */}
          <nav className="flex items-center gap-2" aria-label="Workflow steps">
            {WORKFLOW_STEPS.map((step, i) => {
              const isComplete = i < currentStepIndex;
              const isActive = i === currentStepIndex;
              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-300 ease-in-out ${
                      isActive
                        ? 'bg-[#8A9A5B] text-white shadow-md shadow-[#8A9A5B]/20 scale-105'
                        : isComplete
                          ? 'bg-[#F2F4ED] text-[#5A6638] dark:bg-[#8A9A5B]/10 dark:text-[#AAB685]'
                          : 'bg-stone-100 text-stone-400 dark:bg-black dark:text-stone-500'
                    }`}
                  >
                    {isComplete ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    )}
                    {STEP_LABELS[step]}
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <span className="h-px w-4 rounded-full bg-stone-200 dark:bg-black" />
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Status banner */}
        {status && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-800 transition-all dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zM8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
            </svg>
            {status}
          </div>
        )}
      </header>

      {/* ── Uploader ── */}
      <DocumentUploader
        onFileSelected={handleFileSelected}
        disabled={isScanning || isSaving}
        isScanning={isScanning}
        hasQueue={queueItems.length > 0}
        processingFileName={processingFileName}
        processingProgress={processingProgress}
        elapsedSeconds={scanElapsedSeconds}
      />

      {/* ── Queue panel ── */}
      {queueItems.length > 0 && (
        <section className="rounded-2xl border border-stone-200/80 bg-[#FCFBFA] shadow-sm transition-all dark:border-stone-700/60 dark:bg-black">
          {/* Queue header */}
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                Document Queue
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-black dark:text-stone-400">
                {queueItems.length} file{queueItems.length !== 1 ? 's' : ''}
              </span>
              {/* Progress pills */}
              <span className="rounded-full bg-[#F2F4ED] px-2 py-0.5 text-[11px] font-medium text-[#5A6638] dark:bg-[#8A9A5B]/10 dark:text-[#AAB685]">
                {reviewedCount} reviewed
              </span>
              {queueItems.length - reviewedCount > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  {queueItems.length - reviewedCount} pending
                </span>
              )}
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeQueueIndex <= 0}
                onClick={() => setActiveQueueIndex((c) => Math.max(0, c - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:text-stone-800 hover:shadow disabled:pointer-events-none disabled:opacity-40 dark:border-stone-700 dark:bg-black dark:text-stone-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8l4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="min-w-[3.5rem] text-center text-xs font-medium text-stone-400">
                {activeQueueIndex + 1} / {queueItems.length}
              </span>
              <button
                type="button"
                disabled={activeQueueIndex >= queueItems.length - 1}
                onClick={() => setActiveQueueIndex((c) => Math.min(queueItems.length - 1, c + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:text-stone-800 hover:shadow disabled:pointer-events-none disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Queue items */}
          <div className="flex flex-wrap gap-2.5 p-4">
            {queueItems.map((item, index) => {
              const isActive = index === activeQueueIndex;
              const ext = item.file?.name?.split('.').pop()?.toUpperCase() || 'FILE';
              return (
                <div
                  key={item.id}
                  className={`group relative flex max-w-[220px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 ease-in-out hover:-translate-y-0.5 ${
                    isActive
                      ? 'border-[#8A9A5B]/40 bg-[#F2F4ED] shadow-sm ring-1 ring-[#8A9A5B]/30 dark:border-[#8A9A5B]/40 dark:bg-[#8A9A5B]/10'
                      : item.reviewed
                        ? 'border-teal-200/60 bg-teal-50/40 hover:border-teal-300 dark:border-teal-500/20 dark:bg-teal-500/5'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm dark:border-stone-700 dark:bg-black dark:hover:border-stone-600'
                  }`}
                  onClick={() => setActiveQueueIndex(index)}
                >
                  {/* File type badge */}
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                      isActive
                        ? 'bg-[#E1E6D5] text-[#4A5320] dark:bg-[#8A9A5B]/20 dark:text-[#B5C583]'
                        : 'bg-stone-100 text-stone-500 dark:bg-black dark:text-stone-400'
                    }`}
                  >
                    {ext}
                  </span>

                  {/* File name */}
                  <span
                    className={`truncate text-xs font-medium transition-colors ${
                      isActive
                        ? 'text-[#4A5320] dark:text-[#D4DFB1]'
                        : 'text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {item.file?.name}
                  </span>

                  {/* Reviewed checkmark */}
                  {item.reviewed && (
                    <svg
                      className="h-4 w-4 shrink-0 text-teal-500"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    aria-label={`Remove ${item.file?.name}`}
                    onClick={(e) => handleRemoveFromQueue(index, e)}
                    className={`-mr-1 ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-stone-300 transition-all hover:bg-red-50 hover:text-red-500 dark:text-stone-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2l6 6M8 2L2 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Warnings ── */}
      {activeItem?.warnings?.length > 0 && (
        <section className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/8">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {activeItem.warnings.length} warning{activeItem.warnings.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-amber-700/90 dark:text-amber-200/90">
              {activeItem.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Split screen viewer ── */}
      {canValidate && (
        <SplitScreenViewer
          fileUrl={activeItem?.fileUrl || ''}
          fileObject={activeItem?.file || null}
          fileMimeType={activeItem?.file?.type}
          fileName={activeItem?.file?.name}
          fileSize={activeItem?.file?.size}
          extractedData={activeItem?.extractedData || EMPTY_EXTRACTION}
          confidence={activeItem?.confidence || EMPTY_CONFIDENCE}
          ocrTokens={activeItem?.ocrTokens || []}
          draftTarget={activeItem?.draftTarget || null}
          draftData={activeItem?.draftData || null}
          onConfirm={handleConfirmSave}
          isSaving={isSaving}
        />
      )}

      {/* ── Action bar ── */}
      {queueItems.length > 0 && workflowState !== 'savedSuccessfully' && (
        <section className="flex items-center justify-between rounded-2xl border border-stone-200/80 bg-[#FCFBFA] px-5 py-3.5 shadow-sm dark:border-stone-700/60 dark:bg-black">
          <button
            type="button"
            onClick={handleReset}
            className="group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-stone-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <svg className="h-4 w-4 transition-transform group-hover:rotate-90" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8a5 5 0 1 1 1.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M3 5v3h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Clear all
          </button>

          <div className="flex items-center gap-4">
            {!allReviewed && (
              <p className="text-[11px] font-medium text-stone-400">
                Review <span className="text-stone-600">{queueItems.length - reviewedCount}</span> remaining to continue
              </p>
            )}
            <button
              type="button"
              onClick={handleContinueToBulkEditor}
              disabled={!allReviewed || isSaving}
              className="flex items-center gap-2 rounded-xl bg-[#8A9A5B] px-5 py-2.5 text-xs font-semibold tracking-wide text-white shadow-md shadow-[#8A9A5B]/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#78874D] hover:shadow-lg disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Continue to Bulk Editor
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ── Success state ── */}
      {workflowState === 'savedSuccessfully' && (
        <section className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 shadow-sm dark:border-teal-400/30 dark:bg-teal-500/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20">
              <svg className="h-5 w-5 text-teal-600 dark:text-teal-400" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8l3.5 3.5L13 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
               <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">
                 Success!
               </p>
               <p className="text-xs font-medium text-teal-700/80 dark:text-teal-400/80">
                 Documents reviewed and sent to bulk editor successfully.
               </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow"
          >
            Process another
          </button>
        </section>
      )}
    </div>
  );
}