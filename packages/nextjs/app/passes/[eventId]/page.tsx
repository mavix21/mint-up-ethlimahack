import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  MapPin,
  ShieldAlert,
  Ticket,
} from "lucide-react";

import { getEventPassOffer } from "~~/lib/event-pass-offer-data";
import { formatUsdc } from "~~/lib/event-pass-offers";
import { shouldOptimizeImage } from "~~/lib/image-optimization";

type EventPassPageProps = { params: Promise<{ eventId: string }> };

export const instant = false;

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
  await connection();
  const offer = await getEventPassOffer(eventId);
  return offer
    ? { title: `${offer.name} Event Pass`, description: offer.description }
    : { title: "Event Pass unavailable" };
}

export default async function EventPassPage({ params }: EventPassPageProps) {
  const { eventId } = await params;
  await connection();
  const offer = await getEventPassOffer(eventId);
  if (!offer) notFound();
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
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground opacity-70"
            >
              Purchase coming next
            </button>
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
