export type TransferEligibilitySnapshot = {
  validity: { status: "valid" | "invalid" };
  cancellation: { status: "active" | "cancelled" };
  transfer: { status: "transferable" | "transferred" };
  checkIn: { status: string };
};

export function isEventPassTransferEligible(
  pass: TransferEligibilitySnapshot,
  accountAvailable: boolean,
) {
  return (
    pass.validity.status === "valid" &&
    pass.cancellation.status === "active" &&
    pass.transfer.status === "transferable" &&
    pass.checkIn.status === "notRecorded" &&
    accountAvailable
  );
}
