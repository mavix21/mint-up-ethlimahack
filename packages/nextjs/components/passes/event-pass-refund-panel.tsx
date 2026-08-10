import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import { EventPassRefund } from "./event-pass-refund";
import { EventPassRefundContent } from "./event-pass-refund-content";

type RefundablePassSnapshot = {
  passId: string;
  owner: { address: string };
  refund: { status: "unavailable" | "available" | "received" };
  checkIn: { status: "notRecorded" | "recorded" };
};

export function EventPassRefundPanel({
  pass,
  eventName,
  originalAmountSubunits,
  account,
}: {
  pass: RefundablePassSnapshot;
  eventName: string;
  originalAmountSubunits: string | null;
  account: WalletPasskeyAccount | null;
}) {
  if (pass.refund.status === "received") {
    return (
      <EventPassRefundContent
        state="received"
        eventName={eventName}
        originalAmountSubunits={originalAmountSubunits}
      />
    );
  }

  const currentAccountHoldsPass =
    account?.address.toLowerCase() === pass.owner.address.toLowerCase();
  if (
    pass.refund.status !== "available" ||
    originalAmountSubunits === null ||
    !account ||
    !currentAccountHoldsPass
  ) {
    return null;
  }

  return (
    <EventPassRefund
      passId={pass.passId}
      eventName={eventName}
      originalAmountSubunits={originalAmountSubunits}
      account={account}
    />
  );
}
