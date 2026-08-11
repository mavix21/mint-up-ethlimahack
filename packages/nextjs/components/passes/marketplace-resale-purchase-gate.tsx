"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~~/components/ui/sheet";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { EventPassResalePurchase } from "./event-pass-resale-purchase";
import { InlineSecureStep } from "./inline-secure-step";

export function MarketplaceResalePurchaseGate({
  passId,
  eventName,
  priceAmountSubunits,
  authenticated,
  account,
  initialUsdcBalance,
  selected,
  review,
}: {
  passId: string;
  eventName: string;
  priceAmountSubunits: string;
  authenticated: boolean;
  account: WalletPasskeyAccount | null;
  initialUsdcBalance: string | null;
  selected: boolean;
  review: ReactNode;
}) {
  const [open, setOpen] = useState(selected);
  const router = useRouter();
  const callbackUrl = `/marketplace?buy=${encodeURIComponent(passId)}`;

  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        Review and buy
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle>Buy this Event Pass</SheetTitle>
            <SheetDescription>
              Review the exact total before confirming.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 pt-2">
            {!authenticated ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in to continue with this Pass resale.
                </p>
                <GoogleSignInButton callbackUrl={callbackUrl} />
              </div>
            ) : !account ? (
              <InlineSecureStep
                onSuccess={() => {
                  router.refresh();
                }}
              />
            ) : (
              <EventPassResalePurchase
                key={`${passId}-${priceAmountSubunits}-${initialUsdcBalance}`}
                passId={passId}
                status="actionable"
                eventName={eventName}
                priceAmountSubunits={priceAmountSubunits}
                account={account}
                initialUsdcBalance={initialUsdcBalance}
                review={review}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
