"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  saleStartsAt: number;
  saleEndsAt: number;
  timezone: string;
  remaining: number;
  capacity: number;
  lifecycle: "scheduled" | "cancelled";
  availabilityReason: string | null;
  revenueRecipient: string;
};

function dateTime(value: number, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(value);
}

export function EventPassDetailsDisclosure({
  saleStartsAt,
  saleEndsAt,
  timezone,
  remaining,
  capacity,
  lifecycle,
  availabilityReason,
  revenueRecipient,
}: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const contentId = `${detailsId}-content`;

  return (
    <div className="mt-6">
      <p className="text-sm leading-6">
        Paid directly to organizer{" "}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="font-semibold underline underline-offset-2 hover:text-foreground"
        >
          Details
        </button>
      </p>

      <div className="mt-3 rounded-2xl border">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
        >
          <span>Details</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div
          id={contentId}
          hidden={!open}
          className="border-t px-4 py-4 text-sm leading-6"
        >
          <p>
            <strong>Sales window:</strong>
            <br />
            Starts {dateTime(saleStartsAt, timezone)} (inclusive)
            <br />
            Ends {dateTime(saleEndsAt, timezone)} (exclusive)
          </p>
          <p className="mt-3">
            <strong>Remaining:</strong> {remaining} of {capacity} remaining
          </p>
          <p className="mt-3">
            <strong>Event status:</strong>{" "}
            {lifecycle === "cancelled"
              ? "Cancelled"
              : "Scheduled, not cancelled"}
          </p>
          {availabilityReason ? (
            <p className="mt-3">
              <strong>Availability:</strong> {availabilityReason}
            </p>
          ) : null}
          <div className="mt-4 rounded-xl bg-muted p-3 text-xs leading-5">
            <p>
              USDC is paid directly to the Event revenue recipient at{" "}
              <span className="break-all font-mono text-xs">
                {revenueRecipient}
              </span>
              . Mint Up Passes does not escrow funds or provide a guaranteed
              refund. Cancellation does not automatically return USDC.
            </p>
          </div>
        </div>
      </div>
      {/* anchor for Paid directly link */}
      <div id="event-pass-details" className="sr-only" aria-hidden="true" />
    </div>
  );
}
