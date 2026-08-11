import { cache } from "react";
import { erc20Abi } from "viem";

import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";
import { fetchAuthQuery, isAuthenticated } from "~~/lib/auth-server";
import { createEventPassPublicClient } from "~~/lib/event-pass-public-client";
import { getEventPassResalePurchaseAccess } from "~~/lib/event-pass-resale-api";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";
import { EventPassResalePurchaseReview } from "./event-pass-resale-purchase-review";
import { MarketplaceResalePurchaseGate } from "./marketplace-resale-purchase-gate";
import { MarketplaceResalePurchaseStatus } from "./marketplace-resale-purchase-status";

const getMarketplaceBuyerAccess = cache(async (passId: string) => {
  let authenticated: boolean;
  try {
    authenticated = await isAuthenticated();
  } catch {
    return { error: true as const };
  }
  let account = null;
  let purchaseAccess = null;
  if (authenticated) {
    try {
      [account, purchaseAccess] = await Promise.all([
        fetchAuthQuery(getWalletPasskeyAccount, {}),
        fetchAuthQuery(getEventPassResalePurchaseAccess, { passId }),
      ]);
    } catch {
      return { error: true as const };
    }
  }
  const balance =
    account && purchaseAccess?.status === "eligible"
      ? await createEventPassPublicClient(eventPassEnvironment.chainId)
          .readContract({
            address: eventPassEnvironment.usdcAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account.address],
          })
          .then(value => value.toString())
          .catch(() => null)
      : null;

  return {
    error: false as const,
    authenticated,
    account,
    balance,
    purchaseAccess,
  };
});

export async function MarketplaceResalePurchaseAccess({
  passId,
  eventName,
  priceAmountSubunits,
  originalProtectedAmountSubunits,
  selected,
}: {
  passId: string;
  eventName: string;
  priceAmountSubunits: string;
  originalProtectedAmountSubunits: string;
  selected: boolean;
}) {
  const access = await getMarketplaceBuyerAccess(passId);

  if (access.error) {
    return (
      <div className="mt-5 space-y-2 text-sm">
        <p role="alert" className="font-semibold text-muted-foreground">
          We couldn&apos;t load your purchase options.
        </p>
        <a
          href={`/marketplace?buy=${encodeURIComponent(passId)}`}
          className="inline-flex rounded-full border px-4 py-2 font-bold"
        >
          Retry
        </a>
      </div>
    );
  }

  const { authenticated, account, balance, purchaseAccess } = access;
  if (purchaseAccess?.status === "own_listing") {
    return (
      <div className="mt-5">
        <MarketplaceResalePurchaseStatus status="own_listing" />
      </div>
    );
  }
  const blockedStatus =
    purchaseAccess &&
    purchaseAccess.status !== "eligible" &&
    purchaseAccess.status !== "account_unprotected"
      ? purchaseAccess.status
      : null;

  return (
    <MarketplaceResalePurchaseGate
      passId={passId}
      eventName={eventName}
      priceAmountSubunits={priceAmountSubunits}
      authenticated={authenticated}
      account={account}
      initialUsdcBalance={balance}
      selected={selected}
      blocker={
        blockedStatus ? (
          <MarketplaceResalePurchaseStatus status={blockedStatus} />
        ) : null
      }
      review={
        <EventPassResalePurchaseReview
          eventName={eventName}
          priceAmountSubunits={priceAmountSubunits}
          originalProtectedAmountSubunits={originalProtectedAmountSubunits}
          balanceAmountSubunits={balance ?? "0"}
        />
      }
    />
  );
}

export function MarketplaceResalePurchaseAccessFallback() {
  return (
    <button
      type="button"
      disabled
      className="mt-5 w-full rounded-full border px-4 py-2.5 text-sm font-bold text-muted-foreground"
    >
      Loading purchase options...
    </button>
  );
}
