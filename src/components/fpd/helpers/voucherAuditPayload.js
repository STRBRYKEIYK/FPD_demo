export const resolveActorId = (user) => user?.id || user?.uid || null;

export const buildVoucherStatusUpdatePayload = ({
  user,
  status,
  cancelReason = null,
}) => {
  const actorId = resolveActorId(user);
  const payload = {
    status,
    actor_id: actorId,
  };

  if (status === "cancelled") {
    payload.cancel_reason = cancelReason || "Cancelled by user";
  }

  return payload;
};

export const buildVoucherApprovePayload = ({ user }) => {
  const actorId = resolveActorId(user);
  return {
    approved_by: actorId,
    actor_id: actorId,
  };
};

export const buildVoucherCancelPayload = ({
  user,
  reason = "Cancelled by user",
}) => {
  const actorId = resolveActorId(user);
  return {
    reason,
    cancelled_by: actorId,
    actor_id: actorId,
  };
};
