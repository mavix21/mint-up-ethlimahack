import { Suspense } from "react";
import { SignOutButton } from "~~/components/auth/sign-out-button";
import { WalletEmptyState } from "~~/components/wallet/wallet-empty-state";
import { fetchAuthQuery } from "~~/lib/auth-server";
import { getWalletPasskeyAccount } from "~~/lib/wallet-passkey-api";

async function ProtectedAccountStatus() {
  const protectedAccount = await fetchAuthQuery(getWalletPasskeyAccount, {});

  return protectedAccount ? (
    <section className="mb-8 rounded-2xl border bg-card p-6">
      <h2 className="font-heading text-2xl font-bold">
        Tus pases están protegidos
      </h2>
      <p className="mt-2 text-muted-foreground">
        Usa Face ID o tu huella digital cuando una acción sobre un pase necesite
        tu confirmación.
      </p>
    </section>
  ) : (
    <WalletEmptyState />
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        Sesión iniciada
      </p>
      <h1 className="mt-3 font-heading text-4xl font-bold">
        Tu cuenta de Mint Up Passes
      </h1>
      <p className="mb-8 mt-3 max-w-xl text-base-content/70">
        Esta ruta solo está disponible mientras tu sesión aislada de Mint Up
        Passes sea válida.
      </p>
      <Suspense
        fallback={
          <div className="mb-8 h-40 animate-pulse rounded-2xl bg-muted" />
        }
      >
        <ProtectedAccountStatus />
      </Suspense>
      <SignOutButton />
    </main>
  );
}
