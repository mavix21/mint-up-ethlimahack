"use client";

import { useEffect } from "react";

import { RetryWalletButton } from "~~/components/wallet/retry-wallet-button";

export default function WalletError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Wallet route failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-5xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-4xl border border-destructive/20 bg-card p-7 shadow-lg sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-destructive">
          Secure account unavailable
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
          We could not load your Event Pass account
        </h1>
        <p className="mb-7 mt-3 max-w-2xl text-base-content/70">
          Your wallet is safe. Check your connection and try loading it again.
        </p>
        <RetryWalletButton retry={retry} />
      </section>
    </main>
  );
}
