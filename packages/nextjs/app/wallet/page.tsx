import type { Metadata } from "next";

import { WalletCard } from "~~/components/wallet/wallet-card";
import { WalletEmptyState } from "~~/components/wallet/wallet-empty-state";
import { fetchAuthQuery } from "~~/lib/auth-server";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Your secure pass wallet.",
};

export default async function WalletPage() {
  const account = await fetchAuthQuery(getWalletPasskeyAccount, {});

  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {account ? (
        <WalletCard address={account.address as `0x${string}`} />
      ) : (
        <WalletEmptyState />
      )}
    </main>
  );
}
