"use client";

import { useEffect, useEffectEvent, useState } from "react";
import dynamic from "next/dynamic";
import { LoaderCircleIcon, TicketIcon } from "lucide-react";

import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";
import { Button } from "~~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~~/components/ui/sheet";
import { authClient } from "~~/lib/auth-client";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";

function PurchaseModuleLoading() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircleIcon className="size-4 animate-spin" /> Preparing secure
      checkout...
    </p>
  );
}

const GaslessEventPassPurchase = dynamic(
  () =>
    import("~~/components/passes/gasless-event-pass-purchase").then(
      module => module.GaslessEventPassPurchase,
    ),
  { loading: PurchaseModuleLoading },
);

const InlineSecureStep = dynamic(
  () =>
    import("~~/components/passes/inline-secure-step").then(
      module => module.InlineSecureStep,
    ),
  { loading: PurchaseModuleLoading },
);

type PurchaseData = {
  offer: {
    eventId: string;
    eventName: string;
    eventIdentifier: `0x${string}`;
    priceAmountSubunits: string;
    remaining: number;
    revenueRecipient: `0x${string}`;
    availability:
      { kind: "available" } | { kind: "unavailable"; reason: string };
  };
  environment: {
    chainId: 412346 | 421614;
    chainName: string;
    contractAddress: `0x${string}`;
    usdcAddress: `0x${string}`;
  };
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? "The Event Pass could not be loaded.");
  }
  return body;
}

export function ChatEventPassPurchase({ eventId }: { eventId: string }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const [open, setOpen] = useState(false);
  const [purchaseData, setPurchaseData] = useState<PurchaseData | null>(null);
  const [passkeyAccount, setPasskeyAccount] =
    useState<WalletPasskeyAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPurchase() {
    if (!session?.user) return;

    setLoading(true);
    setError(null);
    try {
      const [offerResponse, accountResponse] = await Promise.all([
        fetch(`/api/event-pass-offers/${encodeURIComponent(eventId)}`),
        fetch("/api/wallet/passkey"),
      ]);
      const [nextPurchaseData, accountData] = await Promise.all([
        responseJson<PurchaseData>(offerResponse),
        responseJson<{ account: WalletPasskeyAccount | null }>(accountResponse),
      ]);
      setPurchaseData(nextPurchaseData);
      setPasskeyAccount(accountData.account);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The Event Pass could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  const loadPurchaseFromEffect = useEffectEvent(() => {
    void loadPurchase();
  });

  useEffect(() => {
    if (open && userId) {
      loadPurchaseFromEffect();
    }
  }, [open, userId]);

  const availability = purchaseData?.offer.availability;

  return (
    <>
      <Button
        type="button"
        className="w-full justify-between"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Get pass
        <TicketIcon data-icon="inline-end" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle>Get your Event Pass</SheetTitle>
            <SheetDescription>
              Complete your purchase without leaving the conversation.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 pt-2">
            {sessionPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" /> Checking
                your account...
              </p>
            ) : !session?.user ? (
              <GoogleSignInButton callbackUrl="/chat" />
            ) : loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" /> Preparing
                your purchase...
              </p>
            ) : error ? (
              <div role="alert" className="space-y-3 text-sm">
                <p className="text-destructive">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadPurchase()}
                >
                  Try again
                </Button>
              </div>
            ) : availability?.kind === "unavailable" ? (
              <p role="status" className="text-sm text-muted-foreground">
                {availability.reason}
              </p>
            ) : purchaseData && passkeyAccount ? (
              <GaslessEventPassPurchase
                eventId={purchaseData.offer.eventId}
                eventName={purchaseData.offer.eventName}
                eventIdentifier={purchaseData.offer.eventIdentifier}
                passkeyAccount={passkeyAccount}
                chainId={purchaseData.environment.chainId}
                chainName={purchaseData.environment.chainName}
                contractAddress={purchaseData.environment.contractAddress}
                usdcAddress={purchaseData.environment.usdcAddress}
                priceAmountSubunits={purchaseData.offer.priceAmountSubunits}
                remaining={purchaseData.offer.remaining}
                revenueRecipient={purchaseData.offer.revenueRecipient}
              />
            ) : purchaseData ? (
              <InlineSecureStep onSuccess={() => void loadPurchase()} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
