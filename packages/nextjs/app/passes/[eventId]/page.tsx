import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  MapPin,
  ShieldAlert,
  Ticket,
} from "lucide-react";

import { EventPassPurchase } from "~~/components/passes/event-pass-purchase";
import {
  eventPassChainName,
  eventPassEnvironment,
} from "~~/contracts/eventPassEnvironment";
import { isAuthenticated } from "~~/lib/auth-server";
import { getEventPassOffer } from "~~/lib/event-pass-offer-data";
import { formatUsdc } from "~~/lib/event-pass-offers";
import { shouldOptimizeImage } from "~~/lib/image-optimization";
import { getMintUpWalletPageData } from "~~/lib/mint-up-wallet-server";

type EventPassPageProps = { params: Promise<{ eventId: string }> };

function dateTime(value: number, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(value);
}

export async function generateMetadata({
  params,
}: EventPassPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const offer = await getEventPassOffer(eventId);
  return offer
    ? { title: `${offer.name} Event Pass`, description: offer.description }
    : { title: "Event Pass unavailable" };
}

async function EventPassDetails({ params }: EventPassPageProps) {
  const { eventId } = await params;
  const purchaseFixture =
    process.env.NODE_ENV !== "production" &&
    process.env.PASSES_E2E_PURCHASE_FIXTURE === "1";
  const [offer, authenticated] = await Promise.all([
    getEventPassOffer(eventId),
    purchaseFixture ? Promise.resolve(true) : isAuthenticated(),
  ]);
  if (!offer) notFound();
  const wallet =
    authenticated && offer.availability.kind === "available"
      ? purchaseFixture
        ? {
            address:
              "0xDD09b55496EaA3cFAe23137ABDeA52a9a979B70e" as `0x${string}`,
          }
        : await getMintUpWalletPageData()
            .then(({ wallet: registeredWallet }) => registeredWallet)
            .catch(() => null)
      : null;
  const publishableKey = process.env.NEXT_PUBLIC_OPENFORT_PUBLISHABLE_KEY;
  const shieldPublishableKey =
    process.env.NEXT_PUBLIC_OPENFORT_SHIELD_PUBLISHABLE_KEY;
  const recoveryEndpoint = process.env.NEXT_PUBLIC_OPENFORT_RECOVERY_ENDPOINT;
  const openfort = purchaseFixture
    ? {
        publishableKey: "pk_test_fixture",
        shieldPublishableKey: "shield_fixture",
        recoveryEndpoint: "/api/test/openfort-recovery",
      }
    : publishableKey && shieldPublishableKey && recoveryEndpoint
      ? {
          publishableKey,
          shieldPublishableKey,
          recoveryEndpoint,
          feeSponsorshipId: process.env.NEXT_PUBLIC_OPENFORT_FEE_SPONSORSHIP_ID,
        }
      : null;
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All passes
      </Link>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <article>
          {offer.imageUrl ? (
            <div className="relative mb-8 aspect-[16/8] overflow-hidden rounded-3xl bg-neutral-900">
              <Image
                src={offer.imageUrl}
                alt=""
                fill
                priority
                unoptimized={!shouldOptimizeImage(offer.imageUrl)}
                className="object-cover"
              />
            </div>
          ) : null}
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground">
            Mint Up Event Pass
          </p>
          <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-6xl">
            {offer.name}
          </h1>
          {offer.description ? (
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              {offer.description}
            </p>
          ) : null}
          <dl className="mt-8 grid gap-5 rounded-3xl border bg-card p-6 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4" /> Event
              </dt>
              <dd className="mt-2 font-semibold">
                {dateTime(offer.startTime, offer.timezone)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" /> Location
              </dt>
              <dd className="mt-2 font-semibold">{offer.location}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ticket className="size-4" /> Availability
              </dt>
              <dd className="mt-2 font-semibold">
                {offer.remaining} of {offer.capacity} remaining
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleDollarSign className="size-4" /> Exact price
              </dt>
              <dd className="mt-2 font-semibold">
                {formatUsdc(offer.price.amountSubunits)}
              </dd>
            </div>
          </dl>
        </article>
        <aside className="h-fit rounded-3xl border bg-card p-6 shadow-xl lg:sticky lg:top-6">
          <p className="text-sm text-muted-foreground">One Event Pass</p>
          <p className="mt-2 font-heading text-4xl font-black">
            {formatUsdc(offer.price.amountSubunits)}
          </p>
          <div className="my-6 border-t" />
          <p className="text-sm leading-6">
            <strong>Sales window:</strong>
            <br />
            Starts {dateTime(offer.saleStartsAt, offer.timezone)} (inclusive)
            <br />
            Ends {dateTime(offer.saleEndsAt, offer.timezone)} (exclusive)
          </p>
          <p className="mt-4 text-sm font-semibold">
            Event status:{" "}
            {offer.lifecycle === "cancelled"
              ? "Cancelled"
              : "Scheduled, not cancelled"}
          </p>
          {offer.availability.kind === "available" ? (
            wallet ? (
              <EventPassPurchase
                eventId={offer.eventId}
                walletAddress={wallet.address}
                chainId={eventPassEnvironment.chainId}
                chainName={eventPassChainName}
                contractAddress={eventPassEnvironment.eventPassAddress}
                usdcAddress={eventPassEnvironment.usdcAddress}
                priceAmountSubunits={offer.price.amountSubunits}
                remaining={offer.remaining}
                revenueRecipient={offer.revenueRecipient as `0x${string}`}
                openfort={openfort}
                fixtureMode={purchaseFixture}
              />
            ) : (
              <Link
                href={authenticated ? "/wallet" : "/login"}
                className="mt-6 block w-full rounded-xl bg-primary px-5 py-3 text-center font-bold text-primary-foreground"
              >
                {authenticated
                  ? "Prepare your embedded wallet"
                  : "Sign in to purchase"}
              </Link>
            )
          ) : (
            <div className="mt-6 rounded-xl bg-destructive/10 p-4 font-semibold text-destructive">
              {offer.availability.reason}
            </div>
          )}
          <div className="mt-6 rounded-2xl bg-muted p-4 text-sm leading-6">
            <p className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-4" /> Before you continue
            </p>
            <p className="mt-2">
              USDC is paid directly to the Event revenue recipient at{" "}
              <span className="break-all font-mono text-xs">
                {offer.revenueRecipient}
              </span>
              . Mint Up Passes does not escrow funds or provide a guaranteed
              refund. Cancellation does not automatically return USDC.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventPassFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-5 py-8 sm:px-8 sm:py-12">
      <div className="mb-8 h-5 w-24 rounded bg-muted" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="aspect-[16/10] rounded-3xl bg-muted" />
        <div className="h-96 rounded-3xl bg-muted" />
      </div>
    </div>
  );
}

export default function EventPassPage(props: EventPassPageProps) {
  return (
    <Suspense fallback={<EventPassFallback />}>
      <EventPassDetails {...props} />
    </Suspense>
  );
}
import { Suspense } from "react";
