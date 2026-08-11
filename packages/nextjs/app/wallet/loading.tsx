import { Skeleton } from "~~/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <main
      className="mx-auto min-h-[70svh] w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10"
      aria-label="Cargando billetera"
    >
      <div className="mx-auto w-full max-w-105">
        <div className="overflow-hidden rounded-[2rem] border bg-card shadow-xl">
          <div className="bg-primary p-6 sm:p-7">
            <Skeleton className="h-11 w-32 rounded-2xl bg-primary-foreground/20" />
            <Skeleton className="mt-6 h-19 w-full rounded-2xl bg-primary-foreground/80" />
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-18 w-full rounded-2xl" />
            <Skeleton className="h-18 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
