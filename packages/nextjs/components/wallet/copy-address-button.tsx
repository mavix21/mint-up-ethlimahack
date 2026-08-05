"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "~~/components/ui/button";

export function CopyAddressButton({ address }: { address: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" variant="outline" onClick={copyAddress}>
        {state === "copied" ? <Check /> : <Copy />}
        {state === "copied" ? "Copied" : "Copy address"}
      </Button>
      {state === "failed" ? (
        <p className="text-xs text-destructive" role="alert">
          Copy failed. Select the address and copy it manually.
        </p>
      ) : null}
    </div>
  );
}
