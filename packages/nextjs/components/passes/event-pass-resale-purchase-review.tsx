import { ShieldCheck } from "lucide-react";

import { formatUsdc } from "../../lib/event-pass-offers";

export function EventPassResalePurchaseReview({
  eventName,
  sellerName,
  priceAmountSubunits,
  originalProtectedAmountSubunits,
}: {
  eventName: string;
  sellerName: string;
  priceAmountSubunits: string;
  originalProtectedAmountSubunits: string;
}) {
  const price = formatUsdc(priceAmountSubunits);
  const protectedPrice = formatUsdc(originalProtectedAmountSubunits);
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Private offer for you
        </p>
        <h3 className="mt-2 font-heading text-xl font-black">{eventName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sold by {sellerName}. Identity confirmed by Mint Up
        </p>
      </div>
      <p className="text-2xl font-black">Total: {price}</p>
      <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm leading-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          If the Event is cancelled, you receive the original protected amount
          of {protectedPrice}, not the {price} resale price.
        </p>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        One Face ID or fingerprint confirmation completes your payment and adds
        the Event Pass to My passes.
      </p>
    </>
  );
}

export function EventPassResalePurchaseLoadError() {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p role="alert" className="text-sm font-semibold">
        We couldn&apos;t load your private offers. Try again.
      </p>
      <a
        href="/my-passes"
        className="inline-flex rounded-xl border px-4 py-2 text-sm font-bold"
      >
        Retry
      </a>
    </div>
  );
}
