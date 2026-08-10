"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMachine } from "@xstate/react";

import { successDialogMachine } from "~~/lib/machines/success-dialog-machine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~~/components/ui/dialog";
import { Button } from "~~/components/ui/button";
import { EventPassPurchaseSuccess } from "./event-pass-purchase-content";

type Props = {
  eventName: string;
};

export function SuccessDialog({ eventName }: Props) {
  const router = useRouter();
  const [state, send] = useMachine(successDialogMachine);

  const isRedirecting = state.matches("redirecting");
  const isOpen = state.matches("open");

  // Auto-redirect side effect when machine reaches redirecting (timer or user skip)
  useEffect(() => {
    if (isRedirecting) {
      router.push("/my-passes");
    }
  }, [isRedirecting, router]);

  const handleViewPasses = () => {
    send({ type: "VIEW_PASSES" });
    // Immediate navigation for skip affordance; machine transition also handles it
    router.push("/my-passes");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      send({ type: "CLOSE" });
      // If user dismisses via overlay/esc, also navigate (matches spec: dialog is temporal)
      // Navigation is handled by the effect above, but push immediately as well for responsiveness
      router.push("/my-passes");
    }
  };

  // Only celebration copy; no UserOperation, transaction hash, or explorer link per spec
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-md"
        data-testid="success-dialog"
      >
        <DialogHeader>
          <DialogTitle>You&apos;re in!</DialogTitle>
          <DialogDescription>
            <EventPassPurchaseSuccess eventName={eventName} />
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleViewPasses}
            data-testid="view-passes-button"
          >
            View passes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
