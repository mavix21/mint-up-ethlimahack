import { cache } from "react";
import { erc20Abi } from "viem";

import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";
import { fetchAuthQuery, isAuthenticated } from "~~/lib/auth-server";
import { createEventPassPublicClient } from "~~/lib/event-pass-public-client";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";
import { EventPassResalePurchaseReview } from "./event-pass-resale-purchase-review";
import { MarketplaceResalePurchaseGate } from "./marketplace-resale-purchase-gate";

const getMarketplaceBuyerAccess = cache(async () => {
  let authenticated: boolean;
  try {
    authenticated = await isAuthenticated();
  } catch {
    return { error: true as const };
  }
  let account = null;
  if (authenticated) {
    try {
      account = await fetchAuthQuery(getWalletPasskeyAccount, {});
    } catch {
      return { error: true as const };
    }
  }
  const balance = account
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

  return { error: false as const, authenticated, account, balance };
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
  const access = await getMarketplaceBuyerAccess();

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

  const { authenticated, account, balance } = access;

  return (
    <MarketplaceResalePurchaseGate
      passId={passId}
      eventName={eventName}
      priceAmountSubunits={priceAmountSubunits}
      authenticated={authenticated}
      account={account}
      initialUsdcBalance={balance}
      selected={selected}
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
