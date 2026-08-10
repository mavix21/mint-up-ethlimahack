type ResalePass = {
  validity: { status: "valid" | "invalid" };
  cancellation: { status: "active" | "cancelled" };
  transfer: { status: "transferable" | "transferred" };
  checkIn: { status: string };
  event?: { startTime?: number };
};

export function isEventPassResaleEligible(
  pass: ResalePass,
  hasProtectedAccount: boolean,
  now = Date.now(),
  contractActive = true,
) {
  return (
    hasProtectedAccount &&
    contractActive &&
    pass.validity.status === "valid" &&
    pass.cancellation.status === "active" &&
    pass.transfer.status === "transferable" &&
    pass.checkIn.status === "notRecorded" &&
    pass.event?.startTime !== undefined &&
    now < pass.event.startTime
  );
}
