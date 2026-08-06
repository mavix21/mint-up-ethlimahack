import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleDollarSign, Fuel, WalletCards } from "lucide-react";

import { CopyAddressButton } from "~~/components/wallet/copy-address-button";
import { RetryWalletButton } from "~~/components/wallet/retry-wallet-button";
import { WalletIdentitySelector } from "~~/components/wallet/wallet-identity-selector";
import { OpenfortWallet } from "~~/components/wallet/openfort-wallet";
import {
  eventPassChainName,
  eventPassEnvironment,
} from "~~/contracts/eventPassEnvironment";
import { getMintUpWalletPageData } from "~~/lib/mint-up-wallet-server";
import { getMintUpSiweOrigin } from "~~/lib/siwe-server";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";

export const metadata: Metadata = { title: "Wallet" };

function WalletUnavailable({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-5xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-4xl border border-destructive/20 bg-card p-7 shadow-lg sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-destructive">
          Wallet needs attention
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
          Your wallet is not ready yet
        </h1>
        <p className="mb-7 mt-3 max-w-2xl text-base-content/70">{message}</p>
        <RetryWalletButton />
      </section>
    </main>
  );
}

async function WalletContent() {
  const pageData = await getMintUpWalletPageData();
  const { wallet, walletOptions } = pageData;
  const publishableKey = process.env.NEXT_PUBLIC_OPENFORT_PUBLISHABLE_KEY;
  const shieldPublishableKey =
    process.env.NEXT_PUBLIC_OPENFORT_SHIELD_PUBLISHABLE_KEY;
  if (!publishableKey || !shieldPublishableKey) {
    return (
      <WalletUnavailable message="Openfort wallet setup is not configured." />
    );
  }
  const chain =
    eventPassEnvironment.chainId === arbitrumNitro.id
      ? arbitrumNitro
      : arbitrumSepolia;
  const rpcUrl = chain.rpcUrls.default.http[0];

  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Verified wallets
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          Your Mint Up wallets
        </h1>
        <p className="mt-4 text-base text-base-content/70 sm:text-lg">
          Your embedded wallet and verified external wallets stay distinct. Pick
          the address you want to use, or prove control of another wallet.
        </p>
      </div>

      <OpenfortWallet
        publishableKey={publishableKey}
        shieldPublishableKey={shieldPublishableKey}
        targetChainId={eventPassEnvironment.chainId}
        rpcUrl={rpcUrl}
        origin={getMintUpSiweOrigin()}
        registeredAddress={wallet?.address}
      >
        {wallet ? (
          <>
            <WalletIdentitySelector
              wallets={walletOptions}
              origin={getMintUpSiweOrigin()}
              targetChainId={eventPassEnvironment.chainId}
              targetChainName={eventPassChainName}
            />

            <section className="overflow-hidden rounded-4xl bg-neutral text-neutral-content shadow-xl">
              <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <WalletCards className="size-6" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-content/60">
                    Embedded wallet address
                  </p>
                  <p className="mt-2 break-all font-mono text-lg font-semibold sm:text-2xl">
                    {wallet.address}
                  </p>
                </div>
                <CopyAddressButton address={wallet.address} />
              </div>

              <div className="grid border-t border-neutral-content/10 sm:grid-cols-2">
                {"error" in wallet.balances ? (
                  <div className="p-6 sm:col-span-2 sm:p-9">
                    <p className="font-semibold">Balance check unavailable</p>
                    <p className="mt-1 text-sm text-neutral-content/65">
                      {wallet.balances.error}
                    </p>
                    <div className="mt-5">
                      <RetryWalletButton />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-neutral-content/10 p-6 sm:border-b-0 sm:border-r sm:p-9">
                      <CircleDollarSign className="mb-5 size-5 text-primary" />
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-content/55">
                        Available USDC
                      </p>
                      <p className="mt-2 font-heading text-3xl font-bold">
                        {wallet.balances.usdc.amount}{" "}
                        <span className="text-base text-neutral-content/55">
                          USDC
                        </span>
                      </p>
                    </div>
                    <div className="p-6 sm:p-9">
                      <Fuel className="mb-5 size-5 text-primary" />
                      <p className="text-xs uppercase tracking-[0.18em] text-neutral-content/55">
                        Network gas
                      </p>
                      <p className="mt-2 font-heading text-3xl font-bold">
                        {wallet.balances.native.amount}{" "}
                        <span className="text-base text-neutral-content/55">
                          {wallet.balances.native.symbol}
                        </span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        ) : null}
      </OpenfortWallet>
    </main>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-[70svh] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <div className="h-64 animate-pulse rounded-4xl bg-base-200" />
        </main>
      }
    >
      <WalletContent />
    </Suspense>
  );
}
