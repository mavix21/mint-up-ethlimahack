import Link from "next/link";
import { CircleAlert } from "lucide-react";

import type { ResalePurchaseAccessStatus } from "~~/lib/event-pass-resale-api";

type BlockedStatus = Exclude<
  ResalePurchaseAccessStatus,
  "eligible" | "account_unprotected"
>;

export function MarketplaceResalePurchaseStatus({
  status,
}: {
  status: BlockedStatus;
}) {
  const content = {
    email_unverified: {
      title: "Verify your email to continue",
      detail:
        "Open your Mint Up verification message, verify your email, then return to this page.",
      action: null,
    },
    blocked: {
      title: "Your Mint Up account cannot make purchases",
      detail: "Contact Mint Up support if you think this is a mistake.",
      action: null,
    },
    own_listing: {
      title: "You listed this Event Pass",
      detail: "You cannot buy your own resale listing.",
      action: { href: "/my-passes", label: "Manage My passes" },
    },
    already_has_event_pass: {
      title: "You already have an active Event Pass for this Event",
      detail:
        "Only one active Event Pass is available per person for an Event.",
      action: { href: "/my-passes", label: "View My passes" },
    },
    unavailable: {
      title: "This Pass resale is no longer available",
      detail: "You will not be charged. Choose another available option.",
      action: { href: "/marketplace", label: "Back to Marketplace" },
    },
  }[status];

  return (
    <div className="space-y-4" role="alert">
      <div className="rounded-2xl bg-amber-500/10 p-4">
        <div className="flex gap-3">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">{content.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {content.detail}
            </p>
          </div>
        </div>
      </div>
      {content.action ? (
        <Link
          href={content.action.href}
          className="block w-full rounded-xl border bg-background px-5 py-3 text-center font-semibold"
        >
          {content.action.label}
        </Link>
      ) : null}
    </div>
  );
}
