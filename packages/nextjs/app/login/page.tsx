import { Suspense } from "react";
import { getLocalRedirect } from "~~/lib/auth-redirect";
import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";

async function LoginCard({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const destination = getLocalRedirect(callbackUrl ?? null);

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
          Sign in with the same Google identity you use for Mint Up.
        </p>
        <GoogleSignInButton callbackUrl={destination} />
      </section>
    </main>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-[70svh]" />}>
      <LoginCard searchParams={searchParams} />
    </Suspense>
  );
}
