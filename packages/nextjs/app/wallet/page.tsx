import type { Metadata } from "next";
import { Fingerprint, KeyRound, ShieldCheck, Smartphone } from "lucide-react";

import { CopyAddressButton } from "~~/components/wallet/copy-address-button";
import { SecureEventPasses } from "~~/components/wallet/secure-event-passes";
import { SponsoredAction } from "~~/components/wallet/sponsored-action";
import { fetchAuthQuery } from "~~/lib/auth-server";
import { reconstructKernelAccount } from "~~/lib/kernel-account";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";
import { getLatestSponsoredOperation } from "~~/lib/pimlico-user-operation-api";

export const metadata: Metadata = {
  title: "Secure Event Passes",
  description: "Protect Event Pass purchases with your device passkey.",
};

async function WalletContent() {
  const [account, latestOperation] = await Promise.all([
    fetchAuthQuery(getWalletPasskeyAccount, {}),
    fetchAuthQuery(getLatestSponsoredOperation, {}),
  ]);
  if (account) await reconstructKernelAccount(account);

  return (
    <main className="mx-auto min-h-[75svh] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
        <section className="rounded-[2rem] bg-neutral p-7 text-neutral-content shadow-2xl sm:p-11">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Fingerprint className="size-7" />
          </div>
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Private by design
          </p>
          <h1 className="mt-3 max-w-2xl font-heading text-4xl font-black tracking-tight sm:text-6xl">
            Secure Event Passes
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-content/70 sm:text-lg">
            Use your device biometric or PIN to protect purchases. Mint Up never
            receives a private key, seed phrase, or reusable signature.
          </p>

          {account ? (
            <div className="mt-10 rounded-3xl border border-neutral-content/10 bg-neutral-content/5 p-5 sm:p-7">
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="size-5" />
                <p className="font-bold">Event Passes are secured</p>
              </div>
              <p className="mt-5 text-xs uppercase tracking-[0.18em] text-neutral-content/50">
                Your account on Arbitrum Sepolia
              </p>
              <p className="mt-2 break-all font-mono text-sm sm:text-base">
                {account.address}
              </p>
              <div className="mt-5">
                <CopyAddressButton address={account.address} />
              </div>
              {account.deploymentState === "counterfactual" ? (
                <SponsoredAction account={account} />
              ) : (
                <div className="mt-6 border-t border-neutral-content/10 pt-6">
                  <p className="text-sm font-bold text-primary">
                    Account deployed on Arbitrum Sepolia
                  </p>
                  {latestOperation ? (
                    <div className="mt-4 space-y-3 text-xs">
                      <p className="break-all font-mono">
                        UserOperation: {latestOperation.userOperationHash}
                      </p>
                      <p className="break-all font-mono">
                        Transaction: {latestOperation.transactionHash}
                      </p>
                      <a
                        href={`https://sepolia.arbiscan.io/tx/${latestOperation.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex font-bold text-primary underline underline-offset-4"
                      >
                        View transaction on Arbiscan
                      </a>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-10">
              <SecureEventPasses />
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <article className="rounded-3xl border bg-card p-6 sm:p-7">
            <KeyRound className="size-6 text-primary" />
            <h2 className="mt-5 font-heading text-xl font-bold">
              A dedicated passkey
            </h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              This credential authorizes Event Pass actions only. Your existing
              Mint Up sign-in remains unchanged.
            </p>
          </article>
          <article className="rounded-3xl border bg-card p-6 sm:p-7">
            <Smartphone className="size-6 text-primary" />
            <h2 className="mt-5 font-heading text-xl font-bold">
              No wallet setup
            </h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              No MetaMask, ETH, seed phrase, or manual network configuration is
              required. Your authenticator keeps control.
            </p>
          </article>
          <aside className="rounded-3xl bg-primary/10 p-6 text-sm leading-6 sm:col-span-2 sm:p-7 lg:col-span-1">
            <strong>Returning on another device?</strong> Synced passkeys may be
            available there. Device-bound credentials do not automatically move,
            and creating a replacement does not recover an existing account.
          </aside>
        </section>
      </div>
    </main>
  );
}

export default async function WalletPage() {
  return <WalletContent />;
}
