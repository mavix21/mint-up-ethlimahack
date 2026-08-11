"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "~~/components/ui/button";

export function RetryWalletButton({ retry }: { retry?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => (retry ? retry() : router.refresh()))
      }
    >
      <RefreshCw className={isPending ? "animate-spin" : undefined} />
      {isPending ? "Verificando billetera..." : "Intentar de nuevo"}
    </Button>
  );
}
