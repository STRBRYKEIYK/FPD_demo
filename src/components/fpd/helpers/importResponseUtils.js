const toArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeVoucherImportResponse = (response) => {
  const payload = response?.data ?? response ?? {};
  const stats = response?.stats || payload.stats || {};

  const directSkippedDetails = toArray(response?.skipped_details);
  const payloadSkippedDetails = toArray(payload.skipped_details);

  return {
    importedCount: toNumber(stats.imported),
    updatedCount: toNumber(stats.updated),
    skippedCount: toNumber(stats.skipped),
    skippedDetails:
      directSkippedDetails.length > 0
        ? directSkippedDetails
        : payloadSkippedDetails,
  };
};

export const normalizeInvoiceImportResponse = (response) => {
  const payload = response?.data ?? response ?? {};

  return {
    createdInvoices: toArray(payload.created_invoices),
    updatedInvoices: toArray(payload.updated_invoices),
    errors: toArray(payload.errors),
  };
};

export const normalizePettyCashImportResponse = (response) => {
  return normalizeVoucherImportResponse(response);
};
