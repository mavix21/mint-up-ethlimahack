import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, Ticket } from "lucide-react";
import { Suspense } from "react";

import {
  MarketplaceResalePurchaseAccess,
  MarketplaceResalePurchaseAccessFallback,
} from "~~/components/passes/marketplace-resale-purchase-access";
import { Badge } from "~~/components/ui/badge";
import { formatUsdc } from "~~/lib/event-pass-offers";
import { composeMarketplace } from "~~/lib/marketplace";
import { listPassResales } from "~~/lib/marketplace-data";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse available Event Pass resale listings.",
};
export const instant = false;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ buy?: string }>;
}) {
  await connection();
  const [{ buy }, resales] = await Promise.all([
    searchParams,
    listPassResales(),
  ]);
  const groups = composeMarketplace(resales);
  const selectedListingAvailable = groups.some(group =>
    group.offers.some(offer => offer.passId === buy),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-10 border-b pb-10">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary-foreground">
          Marketplace
        </p>
        <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-6xl">
          Find your next Event Pass.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Browse verified Event Pass resales available to buy. No sign-in
          required to browse.
        </p>
      </header>
      {buy && !selectedListingAvailable ? (
        <div role="alert" className="mb-8 rounded-3xl border bg-card p-6">
          <p className="font-bold">This Pass resale is no longer available.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            You were not charged. Choose another available option below.
          </p>
          <Link
            href="/marketplace"
            className="mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-bold"
          >
            Back to Marketplace
          </Link>
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-3xl border bg-card p-8 text-muted-foreground">
          No passes are available right now.
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map(group => (
            <section
              key={group.event.id}
              aria-labelledby={`event-${group.event.id}`}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id={`event-${group.event.id}`}
                    className="font-heading text-2xl font-bold"
                  >
                    {group.event.name}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" />
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "long",
                    }).format(group.event.startTime)}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {group.offers.length} option
                  {group.offers.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.offers.map(offer => (
                  <article
                    key={offer.passId}
                    className="rounded-3xl border bg-card p-5 shadow-sm"
                  >
                    <Badge variant="secondary">Pass resale</Badge>
                    <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                      <Ticket className="size-4" />
                      {offer.ticketTypeName}
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {formatUsdc(offer.priceAmountSubunits)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Protected payment:{" "}
                      {formatUsdc(offer.originalProtectedPriceAmountSubunits)}
                    </p>
                    <Suspense
                      fallback={<MarketplaceResalePurchaseAccessFallback />}
                    >
                      <MarketplaceResalePurchaseAccess
                        passId={offer.passId}
                        eventName={group.event.name}
                        priceAmountSubunits={offer.priceAmountSubunits}
                        originalProtectedAmountSubunits={
                          offer.originalProtectedPriceAmountSubunits
                        }
                        selected={buy === offer.passId}
                      />
                    </Suspense>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
