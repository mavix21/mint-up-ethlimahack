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
        Verificando la compatibilidad con passkeys…
      </p>
    );
  }
  if (snapshot.matches("failed")) {
    return (
      <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
        <p className="font-semibold">
          No se pudo verificar la compatibilidad con passkeys.
        </p>
        <p className="mt-1 text-muted-foreground">
          Actualiza la página para reintentar. No se creó ninguna cuenta.
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
        <p className="font-bold">Passkey no disponible</p>
        <p className="mt-2 leading-6">{availabilityMessage(availability)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Cambia a un navegador o dispositivo compatible (Chromium actualizado,
          Safari/WebKit o Firefox) con biometría/PIN o una llave de seguridad
          multiplataforma. No se intentó ninguna activación ni se modificó
          ninguna cuenta.
        </p>
        {fallback}
      </div>
    );
  }
  return <>{children}</>;
}
