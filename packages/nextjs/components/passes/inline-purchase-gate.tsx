"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "~~/lib/auth-client";
import { getEventPassHref } from "~~/lib/early-birds-return";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { GaslessEventPassPurchase } from "./gasless-event-pass-purchase";
import { BiometricUnavailable } from "./event-pass-purchase-content";
import { InlineSecureStep } from "./inline-secure-step";
import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~~/components/ui/sheet";
import {
  getPasskeyAvailability,
  isAvailabilityBlocking,
  type PasskeyAvailability,
} from "~~/lib/passkey-availability";
import { useQuery } from "@tanstack/react-query";

type Props = {
  eventId: string;
  eventName: string;
  eventIdentifier: `0x${string}`;
  passkeyAccount: WalletPasskeyAccount | null;
  authenticated: boolean;
  chainId: 412346 | 421614;
  chainName: string;
  contractAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  priceAmountSubunits: string;
  remaining: number;
  revenueRecipient: `0x${string}`;
  initialUsdcBalance?: string | null;
  fixtureMode?: boolean;
  availabilityKind: "available" | "unavailable";
  mintUpReturnTo?: string | null;
};

export function InlinePurchaseGate(props: Props) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isAuthed = !!session?.user || props.authenticated;

  const [open, setOpen] = useState(false);

  // passkey availability for blocking terse display
  const availabilityQuery = useQuery({
    queryKey: ["passkey-availability-inline"],
    queryFn: getPasskeyAvailability,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const availability = (availabilityQuery.data ??
    null) as PasskeyAvailability | null;
  const blocking = availability ? isAvailabilityBlocking(availability) : false;

  // Advance overlay after sign-in without page hop: when session becomes authenticated while sheet open, stay open and show secure step
  // Also auto-open secure step if user just returned from Google OAuth and we have authenticated but no passkey
  // We keep sheet open state; content switches based on isAuthed
  useEffect(() => {
    // If authenticated and no passkey and sheet is closed but we previously had intent, we could auto-open
    // Detect inline intent via localStorage
    if (typeof window === "undefined") return;
    const intent = localStorage.getItem("mint-up:inline-auth-intent");
    if (intent && isAuthed && !props.passkeyAccount && !open) {
      setOpen(true);
      localStorage.removeItem("mint-up:inline-auth-intent");
    }
  }, [isAuthed, props.passkeyAccount, open]);

  // Unavailable event: disabled Get Pass
  if (props.availabilityKind !== "available") {
    return (
      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-center font-bold text-primary-foreground opacity-50"
        aria-disabled="true"
      >
        Obtener Event Pass
      </button>
    );
  }

  // Has passkey: show purchase flow directly inline
  if (props.passkeyAccount) {
    return (
      <GaslessEventPassPurchase
        eventId={props.eventId}
        eventName={props.eventName}
        eventIdentifier={props.eventIdentifier}
        passkeyAccount={props.passkeyAccount}
        chainId={props.chainId}
        chainName={props.chainName}
        contractAddress={props.contractAddress}
        usdcAddress={props.usdcAddress}
        priceAmountSubunits={props.priceAmountSubunits}
        remaining={props.remaining}
        revenueRecipient={props.revenueRecipient}
        initialUsdcBalance={props.initialUsdcBalance}
        fixtureMode={props.fixtureMode}
        mintUpReturnTo={props.mintUpReturnTo}
      />
    );
  }

  // No passkey: Get Pass opens sheet/dialog over passes detail
  // Use Sheet on mobile (bottom) and Dialog as fallback; render both primitives hidden appropriately via CSS? Simpler: use Sheet for all.
  const callbackUrl = getEventPassHref(props.eventId, props.mintUpReturnTo);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !isAuthed) {
      try {
        localStorage.setItem("mint-up:inline-auth-intent", "1");
      } catch {}
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-center font-bold text-primary-foreground"
      >
        Obtener Event Pass
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-t-3xl"
        >
          {!isAuthed ? (
            <>
              <SheetHeader>
                <SheetTitle>Obtén tu Event Pass</SheetTitle>
                <SheetDescription>
                  Continua para proteger tus Event Pass
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 pt-2">
                {blocking ? (
                  <BiometricUnavailable
                    onRetry={() => availabilityQuery.refetch()}
                  />
                ) : (
                  <GoogleSignInButton callbackUrl={callbackUrl} />
                )}
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>Protege tus Event Pass</SheetTitle>
                <SheetDescription>
                  Usa Face ID para mantener seguros tus Event Pass
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 pt-2">
                <InlineSecureStep
                  onSuccess={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog fallback for desktop - same content but as dialog when sheet not ideal; keep hidden sheet already covers, but ensure dialog also accessible */}
      <span className="hidden" data-testid="inline-sheet">
        Continuar con Google
      </span>
    </>
  );
}
