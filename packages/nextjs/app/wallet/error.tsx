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
    <main className="mx-auto flex min-h-[70svh] w-full max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
      <div className="w-full max-w-105 rounded-[2rem] border bg-card p-7 text-center shadow-lg sm:p-8">
        <p className="text-sm font-bold">Algo salió mal</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No pudimos cargar tu billetera. Inténtalo de nuevo.
        </p>
        <div className="mt-6 flex justify-center">
          <RetryWalletButton retry={retry} />
        </div>
      </div>
    </main>
  );
}
