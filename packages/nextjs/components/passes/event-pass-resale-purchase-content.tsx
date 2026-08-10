import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { formatUsdc } from "../../lib/event-pass-offers";

export type ResalePurchaseContentState =
  "insufficient" | "stale" | "pending" | "success" | "failure";

function RetryButton({ onRetry }: { onRetry?: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="w-full rounded-xl border bg-background px-5 py-3 font-semibold"
    >
      Retry
    </button>
  );
}

export function EventPassResalePurchaseButton({
  priceAmountSubunits,
  onConfirm,
}: {
  priceAmountSubunits: string;
  onConfirm?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onConfirm}
      className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90"
    >
      Buy for {formatUsdc(priceAmountSubunits)}
    </button>
  );
}

export function EventPassResalePurchaseContent({
  state,
  eventName,
  priceAmountSubunits,
  balanceAmountSubunits,
  onRetry,
}: {
  state: ResalePurchaseContentState;
  eventName: string;
  priceAmountSubunits: string;
  balanceAmountSubunits?: string | null;
  onRetry?: () => void;
}) {
  const price = BigInt(priceAmountSubunits);

  if (state === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" /> Confirming your
        purchase...
      </div>
    );
  }
  if (state === "success") {
    return (
      <div
        role="status"
        className="flex gap-3 rounded-xl bg-primary/10 p-4 text-sm font-semibold"
      >
        <CheckCircle2 className="size-5 shrink-0" />
        <span>{eventName} is now in My passes.</span>
      </div>
    );
  }
  if (state === "stale") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> This private offer is no
          longer available.
        </p>
        <RetryButton onRetry={onRetry} />
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
          this purchase. Try again.
        </p>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  if (state === "insufficient") {
    const balance = BigInt(balanceAmountSubunits ?? "0");
    const missing = price > balance ? price - balance : 0n;
    const amount = `${missing / 1_000_000n}${
      missing % 1_000_000n === 0n
        ? ""
        : `.${(missing % 1_000_000n)
            .toString()
            .padStart(6, "0")
            .replace(/0+$/, "")}`
    }`;
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold"
        >
          You need {amount} more USDC to buy this Event Pass.
        </p>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  return null;
}
