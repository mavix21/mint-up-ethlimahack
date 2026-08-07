import { Suspense } from "react";
import { CalendarXIcon } from "lucide-react";

import { OfferCard } from "~~/components/passes/offer-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~~/components/ui/empty";
import { listEventPassOffers } from "~~/lib/event-pass-offer-data";
import { resolveMintUpReturnDestination } from "~~/lib/siwe-server";

async function Offers({ returnTo }: { returnTo: string | null }) {
  const offers = await listEventPassOffers();

  return offers.length > 0 ? (
    <section aria-labelledby="available-passes">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 id="available-passes" className="font-heading text-2xl font-bold">
          Available passes
        </h2>
        <p className="text-sm text-muted-foreground">
          {offers.length} live offer{offers.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map(offer => (
          <OfferCard key={offer.eventId} offer={offer} returnTo={returnTo} />
        ))}
      </div>
    </section>
  ) : (
    <Empty className="min-h-72 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarXIcon />
        </EmptyMedia>
        <EmptyTitle>No Event Passes available</EmptyTitle>
        <EmptyDescription>
          There are no eligible offers on sale right now. Check back soon.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function OffersFallback() {
  return (
    <section aria-label="Loading available passes">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div
            key={item}
            className="aspect-[4/3] animate-pulse rounded-3xl bg-muted"
          />
        ))}
      </div>
    </section>
  );
}

type HomePageProps = { searchParams: Promise<{ returnTo?: string }> };

async function HomeOffers({ searchParams }: HomePageProps) {
  const { returnTo } = await searchParams;
  const validatedReturnTo = resolveMintUpReturnDestination(returnTo);
  return <Offers returnTo={validatedReturnTo} />;
}

export default function Home({ searchParams }: HomePageProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-10 grid gap-6 border-b pb-10 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-primary-foreground">
            Mint Up Passes
          </p>
          <h1 className="font-heading text-4xl font-black tracking-tight sm:text-6xl">
            Your way into what&apos;s next.
          </h1>
        </div>
        <p className="text-base leading-7 text-muted-foreground">
          Browse eligible Mint Up events and secure one onchain Event Pass, paid
          directly to the organizer in USDC.
        </p>
      </header>

      <Suspense fallback={<OffersFallback />}>
        <HomeOffers searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
