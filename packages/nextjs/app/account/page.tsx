import { SignOutButton } from "~~/components/auth/sign-out-button";

export default function AccountPage() {
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        Authenticated
      </p>
      <h1 className="mt-3 font-heading text-4xl font-bold">
        Your Passes account
      </h1>
      <p className="mb-8 mt-3 max-w-xl text-base-content/70">
        This route is available only while your isolated Mint Up Passes session
        is valid.
      </p>
      <SignOutButton />
    </main>
  );
}
