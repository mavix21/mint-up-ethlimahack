"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "~~/components/ui/button";

export function CopyPassIdButton({ passId }: { passId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(passId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy pass ID"}
      className="h-7 gap-1.5 px-2 text-xs"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
