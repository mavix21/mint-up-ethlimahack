"use client";

import { useMachine } from "@xstate/react";

import {
  availabilityMessage,
  isAvailabilityBlocking,
} from "~~/lib/passkey-availability";
import { passkeyAvailabilityMachine } from "~~/lib/machines/availability-machine";

export function PasskeyAvailabilityGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [snapshot] = useMachine(passkeyAvailabilityMachine);
  const availability = snapshot.context.availability;

  if (snapshot.matches("checking")) {
    return (
      <p className="text-sm text-muted-foreground">
        Checking passkey capability…
      </p>
    );
  }
  if (snapshot.matches("failed")) {
    return (
      <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
        <p className="font-semibold">Could not check passkey support.</p>
        <p className="mt-1 text-muted-foreground">
          Refresh to retry. No account was created.
        </p>
      </div>
    );
  }
  if (availability && isAvailabilityBlocking(availability)) {
    return (
      <div
        role="alert"
        className="rounded-2xl border bg-amber-500/10 p-4 text-sm"
      >
        <p className="font-bold">Passkey not available</p>
        <p className="mt-2 leading-6">{availabilityMessage(availability)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Switch to a supported browser or device (current Chromium,
          Safari/WebKit, Firefox) with biometrics/PIN or a cross-platform
          security key. No activation was attempted and no account was changed.
        </p>
        {fallback}
      </div>
    );
  }
  return <>{children}</>;
}
