import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLocalRedirect } from "~~/lib/auth-redirect";
import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";
import { WalletProofButton } from "~~/components/auth/wallet-proof-button";
import {
  eventPassChainName,
  eventPassEnvironment,
} from "~~/contracts/eventPassEnvironment";
import { getMintUpSiweOrigin, getPassesOrigin } from "~~/lib/siwe-server";

async function LoginCard({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; handoff?: string }>;
}) {
  const { callbackUrl, handoff } = await searchParams;
  const destination = getLocalRedirect(callbackUrl ?? null);

  if (handoff !== "attempted") {
    const passesOrigin = getPassesOrigin();
    const callback = new URL("/auth/callback", passesOrigin);
    callback.searchParams.set("callbackUrl", destination);
    const fallback = new URL("/login", passesOrigin);
    fallback.searchParams.set("callbackUrl", destination);
    fallback.searchParams.set("handoff", "attempted");
    const handoffUrl = new URL("/auth/passes-handoff", getMintUpSiweOrigin());
    handoffUrl.searchParams.set("returnTo", callback.toString());
    handoffUrl.searchParams.set("unauthenticatedTo", fallback.toString());
    redirect(handoffUrl.toString());
  }

  return (
    <main className="grid min-h-[70svh] place-items-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Mint Up Passes
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold">
          Your passes, one sign-in away.
        </h1>
        <p className="mb-8 mt-3 text-base-content/70">
          Continue with your Mint Up identity or prove control of an external
          wallet.
        </p>
        <GoogleSignInButton callbackUrl={destination} />
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-base-content/45">
          <span className="h-px flex-1 bg-base-300" />
          or
          <span className="h-px flex-1 bg-base-300" />
        </div>
        <WalletProofButton
          intent="sign-in"
          origin={getMintUpSiweOrigin()}
          targetChainId={eventPassEnvironment.chainId}
          targetChainName={eventPassChainName}
          callbackUrl={destination}
        />
      </section>
    </main>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; handoff?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-[70svh]" />}>
      <LoginCard searchParams={searchParams} />
    </Suspense>
  );
}
