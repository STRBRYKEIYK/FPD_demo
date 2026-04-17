import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInvoiceImportResponse,
  normalizeVoucherImportResponse,
  normalizePettyCashImportResponse,
} from "./importResponseUtils.js";

test("normalizeInvoiceImportResponse supports nested response.data shape", () => {
  const response = {
    data: {
      created_invoices: [{ id: 1 }],
      updated_invoices: [{ id: 2 }, { id: 3 }],
      errors: [{ row: 4, message: "Duplicate invoice" }],
    },
  };

  const result = normalizeInvoiceImportResponse(response);

  assert.equal(result.createdInvoices.length, 1);
  assert.equal(result.updatedInvoices.length, 2);
  assert.equal(result.errors.length, 1);
});

test("normalizeInvoiceImportResponse supports flat response shape", () => {
  const response = {
    created_invoices: [{ id: 10 }],
    updated_invoices: [],
    errors: [],
  };

  const result = normalizeInvoiceImportResponse(response);

  assert.equal(result.createdInvoices.length, 1);
  assert.equal(result.updatedInvoices.length, 0);
  assert.equal(result.errors.length, 0);
});

test("normalizeInvoiceImportResponse defaults to empty arrays for invalid fields", () => {
  const response = {
    data: {
      created_invoices: null,
      updated_invoices: "invalid",
      errors: undefined,
    },
  };

  const result = normalizeInvoiceImportResponse(response);

  assert.deepEqual(result, {
    createdInvoices: [],
    updatedInvoices: [],
    errors: [],
  });
});

test("normalizeVoucherImportResponse supports nested stats and skipped details", () => {
  const response = {
    data: {
      stats: {
        imported: 9,
        updated: 4,
        skipped: 2,
      },
      skipped_details: [{ row: 11, reason: "Invalid amount" }],
    },
  };

  const result = normalizeVoucherImportResponse(response);

  assert.deepEqual(result, {
    importedCount: 9,
    updatedCount: 4,
    skippedCount: 2,
    skippedDetails: [{ row: 11, reason: "Invalid amount" }],
  });
});

test("normalizeVoucherImportResponse supports flat stats fallback", () => {
  const response = {
    stats: {
      imported: "6",
      updated: 1,
      skipped: "3",
    },
    skipped_details: [{ row: 1, reason: "Missing payee" }],
  };

  const result = normalizeVoucherImportResponse(response);

  assert.deepEqual(result, {
    importedCount: 6,
    updatedCount: 1,
    skippedCount: 3,
    skippedDetails: [{ row: 1, reason: "Missing payee" }],
  });
});

test("normalizeVoucherImportResponse prefers top-level stats/details when both shapes exist", () => {
  const response = {
    stats: {
      imported: 8,
      updated: 3,
      skipped: 1,
    },
    skipped_details: [{ row: 99, reason: "Top-level detail" }],
    data: {
      stats: {
        imported: 1,
        updated: 1,
        skipped: 5,
      },
      skipped_details: [{ row: 1, reason: "Nested detail" }],
    },
  };

  const result = normalizeVoucherImportResponse(response);

  assert.deepEqual(result, {
    importedCount: 8,
    updatedCount: 3,
    skippedCount: 1,
    skippedDetails: [{ row: 99, reason: "Top-level detail" }],
  });
});

test("normalizeVoucherImportResponse defaults to zeroed stats and empty details", () => {
  const result = normalizeVoucherImportResponse({ data: { stats: null } });

  assert.deepEqual(result, {
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    skippedDetails: [],
  });
});

test("normalizePettyCashImportResponse supports nested stats and skipped details", () => {
  const response = {
    data: {
      stats: {
        imported: 5,
        updated: 2,
        skipped: 1,
      },
      skipped_details: [{ row: 8, reason: "Missing voucher date" }],
    },
  };

  const result = normalizePettyCashImportResponse(response);

  assert.deepEqual(result, {
    importedCount: 5,
    updatedCount: 2,
    skippedCount: 1,
    skippedDetails: [{ row: 8, reason: "Missing voucher date" }],
  });
});

test("normalizePettyCashImportResponse supports flat stats fallback", () => {
  const response = {
    stats: {
      imported: "3",
      updated: 0,
      skipped: "2",
    },
    skipped_details: [{ row: 2, reason: "No amount" }],
  };

  const result = normalizePettyCashImportResponse(response);

  assert.deepEqual(result, {
    importedCount: 3,
    updatedCount: 0,
    skippedCount: 2,
    skippedDetails: [{ row: 2, reason: "No amount" }],
  });
});

test("normalizePettyCashImportResponse defaults to zeroed stats and empty details", () => {
  const result = normalizePettyCashImportResponse({ data: { stats: null } });

  assert.deepEqual(result, {
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    skippedDetails: [],
  });
});

test("normalizePettyCashImportResponse matches generic voucher import normalization", () => {
  const response = {
    stats: {
      imported: 2,
      updated: 5,
      skipped: 1,
    },
    skipped_details: [{ row: 7, reason: "Missing OR/CI/SI" }],
  };

  assert.deepEqual(
    normalizePettyCashImportResponse(response),
    normalizeVoucherImportResponse(response),
  );
});
