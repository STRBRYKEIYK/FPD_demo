import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveActorId,
  buildVoucherStatusUpdatePayload,
  buildVoucherApprovePayload,
  buildVoucherCancelPayload,
} from "./voucherAuditPayload.js";

test("resolveActorId prefers id then uid then null", () => {
  assert.equal(resolveActorId({ id: 101, uid: 202 }), 101);
  assert.equal(resolveActorId({ uid: "u-55" }), "u-55");
  assert.equal(resolveActorId({}), null);
  assert.equal(resolveActorId(null), null);
});

test("buildVoucherStatusUpdatePayload includes actor and status", () => {
  const payload = buildVoucherStatusUpdatePayload({
    user: { id: 77 },
    status: "approved",
  });

  assert.deepEqual(payload, {
    status: "approved",
    actor_id: 77,
  });
});

test("buildVoucherStatusUpdatePayload adds cancel_reason for cancelled status", () => {
  const withDefaultReason = buildVoucherStatusUpdatePayload({
    user: { uid: "emp-11" },
    status: "cancelled",
  });

  const withCustomReason = buildVoucherStatusUpdatePayload({
    user: { id: 33 },
    status: "cancelled",
    cancelReason: "Duplicate entry",
  });

  assert.deepEqual(withDefaultReason, {
    status: "cancelled",
    actor_id: "emp-11",
    cancel_reason: "Cancelled by user",
  });

  assert.deepEqual(withCustomReason, {
    status: "cancelled",
    actor_id: 33,
    cancel_reason: "Duplicate entry",
  });
});

test("buildVoucherApprovePayload returns actor in both fields", () => {
  const payload = buildVoucherApprovePayload({ user: { id: 9 } });

  assert.deepEqual(payload, {
    approved_by: 9,
    actor_id: 9,
  });
});

test("buildVoucherCancelPayload returns reason, cancelled_by and actor_id", () => {
  const withDefaultReason = buildVoucherCancelPayload({ user: { uid: "x-4" } });
  const withCustomReason = buildVoucherCancelPayload({
    user: { id: 48 },
    reason: "Insufficient documentation",
  });

  assert.deepEqual(withDefaultReason, {
    reason: "Cancelled by user",
    cancelled_by: "x-4",
    actor_id: "x-4",
  });

  assert.deepEqual(withCustomReason, {
    reason: "Insufficient documentation",
    cancelled_by: 48,
    actor_id: 48,
  });
});
