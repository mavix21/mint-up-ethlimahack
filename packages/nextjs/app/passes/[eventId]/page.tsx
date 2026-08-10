import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { Suspense } from "react";

import { EventPassDetailsDisclosure } from "~~/components/passes/event-pass-details-disclosure";
import { InlinePurchaseGate } from "~~/components/passes/inline-purchase-gate";
import {
  eventPassChainName,
  eventPassEnvironment,
} from "~~/contracts/eventPassEnvironment";
import { fetchAuthQuery, isAuthenticated } from "~~/lib/auth-server";
import { getEventPassOffer } from "~~/lib/event-pass-offer-data";
import { formatUsdc } from "~~/lib/event-pass-offers";
import { shouldOptimizeImage } from "~~/lib/image-optimization";
import { createEventPassPublicClient } from "~~/lib/event-pass-public-client";
import { resolveMintUpReturnDestination } from "~~/lib/siwe-server";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { erc20Abi } from "viem";

type EventPassPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

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

async function EventPassDetails({ params, searchParams }: EventPassPageProps) {
  const { eventId } = await params;
  const { returnTo } = await searchParams;
  const mintUpReturnTo = resolveMintUpReturnDestination(returnTo);
  const purchaseFixture =
    process.env.NODE_ENV !== "production" &&
    process.env.PASSES_E2E_PURCHASE_FIXTURE === "1";
  const [offer, authenticated] = await Promise.all([
    getEventPassOffer(eventId),
    purchaseFixture ? Promise.resolve(true) : isAuthenticated(),
  ]);
  if (!offer) notFound();
  const passkeyAccount = await (async () => {
    if (!authenticated || offer.availability.kind !== "available") return null;
    if (purchaseFixture) {
      return {
        address: "0xDD09b55496EaA3cFAe23137ABDeA52a9a979B70e" as `0x${string}`,
        credentialId: "fixture-credential",
        publicKey: `0x${"0".repeat(130)}` as `0x${string}`,
        algorithm: -7 as const,
        rpId: "localhost",
        chainId: eventPassEnvironment.chainId,
        entryPointAddress:
          "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`,
        deploymentState: "counterfactual" as const,
      } as unknown as WalletPasskeyAccount;
    }
    return fetchAuthQuery(getWalletPasskeyAccount, {})
      .then(a => a)
      .catch(() => null);
  })();
  const initialUsdcBalance = passkeyAccount
    ? await createEventPassPublicClient(eventPassEnvironment.chainId)
        .readContract({
          address: eventPassEnvironment.usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [passkeyAccount.address as `0x${string}`],
        })
        .then(value => (value as bigint).toString())
        .catch(() => null)
    : null;
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      {mintUpReturnTo ? (
        <a
          href={mintUpReturnTo}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          data-testid="return-to-event"
        >
          <ArrowLeft className="size-4" /> Return to event
        </a>
      ) : (
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All passes
        </Link>
      )}
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
          </dl>
        </article>
        <aside className="h-fit rounded-3xl border bg-card p-6 shadow-xl lg:sticky lg:top-6">
          <p className="text-sm text-muted-foreground">One Event Pass</p>
          <p className="mt-2 font-heading text-4xl font-black">
            {formatUsdc(offer.price.amountSubunits)}
          </p>
          <InlinePurchaseGate
            eventId={offer.eventId}
            eventName={offer.name}
            eventIdentifier={offer.eventIdentifier as `0x${string}`}
            passkeyAccount={passkeyAccount}
            authenticated={authenticated}
            chainId={eventPassEnvironment.chainId}
            chainName={eventPassChainName}
            contractAddress={eventPassEnvironment.eventPassAddress}
            usdcAddress={eventPassEnvironment.usdcAddress}
            priceAmountSubunits={offer.price.amountSubunits}
            remaining={offer.remaining}
            revenueRecipient={offer.revenueRecipient as `0x${string}`}
            initialUsdcBalance={initialUsdcBalance}
            fixtureMode={purchaseFixture}
            availabilityKind={offer.availability.kind}
            mintUpReturnTo={mintUpReturnTo}
          />
          <EventPassDetailsDisclosure
            saleStartsAt={offer.saleStartsAt}
            saleEndsAt={offer.saleEndsAt}
            timezone={offer.timezone}
            remaining={offer.remaining}
            capacity={offer.capacity}
            lifecycle={offer.lifecycle}
            availabilityReason={
              offer.availability.kind === "unavailable"
                ? offer.availability.reason
                : null
            }
          />
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
