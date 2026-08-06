import { Skeleton } from "~~/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <main
      className="mx-auto min-h-[70svh] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16"
      aria-label="Loading your secured Event Pass account"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        Secure Event Passes
      </p>
      <Skeleton className="mt-4 h-12 w-full max-w-lg" />
      <Skeleton className="mt-8 h-80 w-full rounded-4xl" />
      <p className="mt-5 text-sm text-base-content/65">
        Checking your protected Event Pass account...
      </p>
    </main>
  );
}
