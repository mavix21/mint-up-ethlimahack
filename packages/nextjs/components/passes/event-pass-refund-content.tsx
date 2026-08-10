import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { formatUsdc } from "../../lib/event-pass-offers";

export type EventPassRefundContentState =
  "available" | "pending" | "received" | "failure";

export function EventPassRefundContent({
  state,
  eventName,
  originalAmountSubunits,
  onConfirm,
  onRetry,
}: {
  state: EventPassRefundContentState;
  eventName: string;
  originalAmountSubunits: string | null;
  onConfirm?: () => void;
  onRetry?: () => void;
}) {
  if (state === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" /> Confirming your
        refund...
      </div>
    );
  }

  if (state === "received") {
    return (
      <div
        role="status"
        className="flex gap-3 rounded-xl bg-primary/10 p-4 text-sm font-semibold"
      >
        <CheckCircle2 className="size-5 shrink-0" />
        <span>Refund received for {eventName}.</span>
      </div>
    );
  }

  if (state === "failure") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> We couldn&apos;t finish
          your refund. Try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl border bg-background px-5 py-3 font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (originalAmountSubunits === null) return null;
  return (
    <div className="space-y-3 rounded-xl bg-primary/10 p-4">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold">Refund available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Receive {formatUsdc(originalAmountSubunits)}, the original protected
            payment, with Face ID or fingerprint.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90"
      >
        Receive refund
      </button>
    </div>
  );
}
