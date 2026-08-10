import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import type { PrivateResalePurchaseOffer } from "../../lib/event-pass-resale-schema";
import { Card, CardContent } from "../ui/card";
import { EventPassResalePurchase } from "./event-pass-resale-purchase";
import { EventPassResalePurchaseContent } from "./event-pass-resale-purchase-content";
import {
  EventPassResalePurchaseLoadError,
  EventPassResalePurchaseReview,
} from "./event-pass-resale-purchase-review";

export function PrivateResalePurchases({
  offers,
  account,
  initialUsdcBalance,
  unavailable,
}: {
  offers: PrivateResalePurchaseOffer[];
  account: WalletPasskeyAccount | null;
  initialUsdcBalance: string | null;
  unavailable: boolean;
}) {
  if (unavailable) return <EventPassResalePurchaseLoadError />;
  if (offers.length === 0) return null;
  return (
    <section aria-labelledby="private-offers-title" className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Sent directly to you
        </p>
        <h2
          id="private-offers-title"
          className="mt-2 font-heading text-2xl font-black"
        >
          Private offers
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map(offer => (
          <Card key={offer.passId} className="rounded-3xl">
            <CardContent>
              {account ? (
                <EventPassResalePurchase
                  key={`${offer.status}-${offer.price.amountSubunits}-${initialUsdcBalance}`}
                  passId={offer.passId}
                  status={offer.status}
                  eventName={offer.event.name}
                  priceAmountSubunits={offer.price.amountSubunits}
                  account={account}
                  initialUsdcBalance={initialUsdcBalance}
                  review={
                    <EventPassResalePurchaseReview
                      eventName={offer.event.name}
                      sellerName={offer.seller.name}
                      priceAmountSubunits={offer.price.amountSubunits}
                      originalProtectedAmountSubunits={
                        offer.originalProtectedPrice.amountSubunits
                      }
                    />
                  }
                />
              ) : (
                <EventPassResalePurchaseContent
                  state="stale"
                  eventName={offer.event.name}
                  priceAmountSubunits={offer.price.amountSubunits}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
