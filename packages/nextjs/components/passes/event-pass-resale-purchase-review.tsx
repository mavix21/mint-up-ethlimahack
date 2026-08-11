import { ShieldCheck } from "lucide-react";

import { formatUsdc } from "../../lib/event-pass-offers";

export function EventPassResalePurchaseReview({
  eventName,
  priceAmountSubunits,
  originalProtectedAmountSubunits,
  balanceAmountSubunits,
}: {
  eventName: string;
  priceAmountSubunits: string;
  originalProtectedAmountSubunits: string;
  balanceAmountSubunits: string;
}) {
  const price = formatUsdc(priceAmountSubunits);
  const protectedPrice = formatUsdc(originalProtectedAmountSubunits);
  const balance = formatUsdc(balanceAmountSubunits);
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Pass resale
        </p>
        <h3 className="mt-2 font-heading text-xl font-black">{eventName}</h3>
      </div>
      <p className="text-2xl font-black">Total: {price}</p>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm">
        <div>
          <dt className="sr-only">Balance</dt>
          <dd className="font-bold">Available balance: {balance}</dd>
        </div>
        <div>
          <dt className="sr-only">Fee</dt>
          <dd className="font-bold">Mint Up fee: 9% included</dd>
        </div>
      </dl>
      <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm leading-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          Protected payment: {protectedPrice}. If the Event is cancelled, the
          current holder can receive this original amount, not the resale price.
        </p>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        This purchase is final. One Face ID or fingerprint confirmation
        authorizes this Event Pass and the exact total. Success appears only
        after it is verified in My passes.
      </p>
    </>
  );
}

export function EventPassResalePurchaseLoadError() {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p role="alert" className="text-sm font-semibold">
        We couldn&apos;t load this Pass resale. Try again.
      </p>
      <a
        href="/marketplace"
        className="inline-flex rounded-xl border px-4 py-2 text-sm font-bold"
      >
        Retry
      </a>
    </div>
  );
}
