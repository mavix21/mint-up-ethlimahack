import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

import { shouldOptimizeImage } from "~~/lib/image-optimization";

import { Badge } from "~~/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~~/components/ui/empty";
import { CopyPassIdButton } from "~~/components/passes/copy-pass-id-button";
import {
  fetchMyPasses,
  groupPassesByEvent,
  type PassGroup,
} from "~~/lib/event-pass-ownerships";

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

function PassCard({ pass }: { pass: PassGroup["passes"][number] }) {
  const isValid = pass.validity.status === "valid";
  const isCancelled = pass.cancellation.status === "cancelled";
  const isTransferred = pass.transfer.status === "transferred";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pass #{pass.passId}
          </p>
          <p className="mt-1 break-all font-mono text-sm font-medium">
            {pass.owner.address}
          </p>
        </div>
        <CopyPassIdButton passId={pass.passId} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={isValid ? "default" : "destructive"}>
          {isValid ? "Valid" : "Invalid"}
        </Badge>
        <Badge variant={isCancelled ? "destructive" : "secondary"}>
          {isCancelled ? "Cancelled" : "Active"}
        </Badge>
        <Badge variant={isTransferred ? "outline" : "secondary"}>
          {isTransferred ? "Transferred" : "Transferable"}
        </Badge>
        {/* hashes hidden per spec: no transaction/UserOperation hash or explorer link in My Passes */}
      </div>
    </div>
  );
}

function PassGroupSection({ group }: { group: PassGroup }) {
  const dateLabel = formatEventDate(group.startTime, group.timezone);

  return (
    <section
      aria-labelledby={`event-${group.key}`}
      className="overflow-hidden rounded-3xl border bg-card"
    >
      {group.imageUrl ? (
        <div className="relative h-40 w-full overflow-hidden bg-neutral-900">
          <Image
            src={group.imageUrl}
            alt=""
            fill
            unoptimized={!shouldOptimizeImage(group.imageUrl)}
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
          <h2
            id={`event-${group.key}`}
            className="absolute bottom-4 left-5 right-5 font-heading text-xl font-black leading-tight text-white drop-shadow sm:text-2xl"
          >
            {group.name}
          </h2>
        </div>
      ) : null}
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {!group.imageUrl ? (
              <h2
                id={`event-${group.key}`}
                className="font-heading text-xl font-bold leading-tight sm:text-2xl"
              >
                {group.name}
              </h2>
            ) : (
              <p className="font-heading text-lg font-bold leading-tight">
                {group.name}
              </p>
            )}
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
            {group.eventId ? (
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {group.eventId}
              </p>
            ) : null}
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

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.passes.map(pass => (
            <PassCard key={pass.passId} pass={pass} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function MyPassesContent() {
  const passes = await fetchMyPasses();
  const groups = groupPassesByEvent(passes);

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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {passes.length} pass{passes.length === 1 ? "" : "es"} across{" "}
          {groups.length} event{groups.length === 1 ? "" : "s"}
        </p>
      </div>
      {groups.map(group => (
        <PassGroupSection key={group.key} group={group} />
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
