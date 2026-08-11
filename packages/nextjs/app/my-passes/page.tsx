import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

import { shouldOptimizeImage } from "~~/lib/image-optimization";

import { Badge } from "~~/components/ui/badge";
import { Card, CardContent } from "~~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~~/components/ui/empty";
import { EventPassRefundPanel } from "~~/components/passes/event-pass-refund-panel";
import { EventPassTransfer } from "~~/components/passes/event-pass-transfer";
import { EventPassResale } from "~~/components/passes/event-pass-resale";
import { EventPassResaleContent } from "~~/components/passes/event-pass-resale-content";
import { fetchAuthQuery } from "~~/lib/auth-server";
import {
  fetchCurrentResaleListing,
  getEventPassResaleNow,
  isEventPassResaleContractActive,
} from "~~/lib/event-pass-resale-data";
import { isEventPassResaleEligible } from "~~/lib/event-pass-resale-eligibility";
import type { ResaleListing } from "~~/lib/event-pass-resale-schema";
import { fetchEventPassRefundAmount } from "~~/lib/event-pass-refund-data";
import { isEventPassTransferEligible } from "~~/lib/event-pass-transfer-eligibility";
import {
  fetchMyPasses,
  groupPassesByEvent,
  type PassGroup,
} from "~~/lib/event-pass-ownerships";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";

export const metadata: Metadata = {
  title: "My Passes",
  description: "Your purchased Mint Up Event Passes, grouped by event.",
};

function formatEventDate(value?: number, timezone?: string) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone ?? "UTC",
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
}

function PassCard({
  pass,
  eventName,
  account,
  resale,
  refundAmountSubunits,
  resaleContractActive,
  now,
}: {
  pass: PassGroup["passes"][number];
  eventName: string;
  account: WalletPasskeyAccount | null;
  resale: ResaleListing | null;
  refundAmountSubunits: string | null;
  resaleContractActive: boolean;
  now: number;
}) {
  const isValid = pass.validity.status === "valid";
  const isCancelled = pass.cancellation.status === "cancelled";
  const transferEligible = isEventPassTransferEligible(pass, account !== null);
  const resaleEligible = isEventPassResaleEligible(
    pass,
    account !== null,
    now,
    resaleContractActive,
  );
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-sm font-bold">Event Pass</p>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={isValid ? "default" : "destructive"}>
          {isValid ? "Valid" : "Invalid"}
        </Badge>
        <Badge variant={isCancelled ? "destructive" : "secondary"}>
          {isCancelled ? "Cancelled" : "Active"}
        </Badge>
        <Badge variant="outline">
          {pass.transfer.status === "transferable"
            ? "Transferable"
            : "Transferred"}
        </Badge>
      </div>
      <EventPassRefundPanel
        pass={pass}
        eventName={eventName}
        originalAmountSubunits={refundAmountSubunits}
        account={account}
      />
      {transferEligible && account ? (
        <EventPassTransfer
          passId={pass.passId}
          eventName={eventName}
          account={account}
        />
      ) : null}
      {account && resaleEligible && resale?.status !== "unavailable" ? (
        <EventPassResale
          key={`resale-${pass.passId}-${now}`}
          passId={pass.passId}
          eventName={eventName}
          account={account}
          listing={resale}
          maximumPriceAmountSubunits={refundAmountSubunits ?? "0"}
        />
      ) : resale ? (
        <EventPassResaleContent
          state="unavailable"
          eventName={eventName}
          price={resale.price.amount}
        />
      ) : null}
    </div>
  );
}

function PassGroupSection({
  group,
  sectionId,
  account,
  resales,
  refundAmounts,
  resaleContractActive,
  now,
}: {
  group: PassGroup;
  sectionId: string;
  account: WalletPasskeyAccount | null;
  resales: Map<string, ResaleListing | null>;
  refundAmounts: Map<string, string | null>;
  resaleContractActive: boolean;
  now: number;
}) {
  const dateLabel = formatEventDate(group.startTime, group.timezone);

  return (
    <Card aria-labelledby={sectionId} className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col sm:flex-row">
        {group.imageUrl ? (
          <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted sm:w-52 md:w-64 lg:w-72">
            <Image
              src={group.imageUrl}
              alt={group.name}
              fill
              unoptimized={!shouldOptimizeImage(group.imageUrl)}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 288px"
            />
          </div>
        ) : null}
        <CardContent className="flex min-w-0 flex-1 flex-col p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={sectionId}
                className="font-heading text-xl font-bold leading-tight sm:text-2xl"
              >
                {group.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {group.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" />
                    {group.location}
                  </span>
                ) : null}
                {dateLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4 shrink-0" />
                    {dateLabel}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Ticket className="size-4 shrink-0" />
                  {group.passes.length} pass
                  {group.passes.length === 1 ? "" : "es"}
                </span>
              </div>
            </div>
            {group.eventId ? (
              <Link
                href={`/passes/${encodeURIComponent(group.eventId)}`}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                View event
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {group.passes.map(pass => (
              <PassCard
                key={pass.passId}
                pass={pass}
                eventName={group.name}
                account={account}
                resale={resales.get(pass.passId) ?? null}
                refundAmountSubunits={refundAmounts.get(pass.passId) ?? null}
                resaleContractActive={resaleContractActive}
                now={now}
              />
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

async function MyPassesContent() {
  await connection();
  const [passes, account, resaleContractActive, now] = await Promise.all([
    fetchMyPasses(),
    fetchAuthQuery(getWalletPasskeyAccount, {}).catch(() => null),
    isEventPassResaleContractActive(),
    getEventPassResaleNow(),
  ]);
  const groups = groupPassesByEvent(passes);
  const [resaleEntries, refundAmountEntries] = await Promise.all([
    Promise.all(
      passes.map(
        async pass =>
          [pass.passId, await fetchCurrentResaleListing(pass.passId)] as const,
      ),
    ),
    Promise.all(
      passes.map(
        async pass =>
          [
            pass.passId,
            pass.refund.status === "available"
              ? await fetchEventPassRefundAmount(pass.passId)
              : null,
          ] as const,
      ),
    ),
  ]);
  const resales = new Map(resaleEntries);
  const refundAmounts = new Map(refundAmountEntries);

  if (groups.length === 0) {
    return (
      <Empty className="min-h-72 border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Ticket />
          </EmptyMedia>
          <EmptyTitle>No passes yet</EmptyTitle>
          <EmptyDescription>
            You don&apos;t own any Event Passes yet. Browse available offers and
            secure your first pass.
          </EmptyDescription>
        </EmptyHeader>
        <Link
          href="/"
          className="mt-2 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          Browse passes
        </Link>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {groups.length > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {passes.length} pass{passes.length === 1 ? "" : "es"} across{" "}
            {groups.length} event{groups.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
      {groups.map((group, index) => (
        <PassGroupSection
          key={group.key}
          group={group}
          sectionId={`owned-event-${index + 1}`}
          account={account}
          resales={resales}
          refundAmounts={refundAmounts}
          resaleContractActive={resaleContractActive}
          now={now}
        />
      ))}
    </div>
  );
}

function MyPassesFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="rounded-3xl border bg-muted p-7">
        <div className="h-6 w-48 rounded bg-muted-foreground/10" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-muted-foreground/10" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MyPassesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-8 border-b pb-8">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary-foreground">
          Your collection
        </p>
        <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-5xl">
          My passes
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          All Event Passes you own, grouped by event. Valid passes are ready for
          check-in.
        </p>
      </header>

      <Suspense fallback={<MyPassesFallback />}>
        <MyPassesContent />
      </Suspense>
    </div>
  );
}
