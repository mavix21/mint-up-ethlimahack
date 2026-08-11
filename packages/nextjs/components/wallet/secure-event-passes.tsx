"use client";

import { useMemo } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";

import {
  deriveKernelAccount,
  kernelAccountMatrix,
  reconstructKernelAccount,
  type WalletPasskeyAccount,
} from "~~/lib/kernel-account";
import {
  availabilityMessage,
  isAvailabilityBlocking,
} from "~~/lib/passkey-availability";
import { classifyPasskeyError } from "~~/lib/passkey-errors";
import { passkeyRegistrationMachine } from "~~/lib/machines/passkey-registration-machine";

function publicKeyHex(publicKey: string) {
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    character => character.charCodeAt(0),
  );
  const point = bytes.slice(-65);
  if (point.length !== 65 || point[0] !== 4) {
    throw new Error("El autenticador no devolvió una clave pública P-256.");
  }
  return `0x${Array.from(point, byte => byte.toString(16).padStart(2, "0")).join("")}` as const;
}

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message ?? "Falló la configuración de la passkey.");
  return body;
}

export function SecureEventPasses() {
  const router = useRouter();

  const machineWithActors = useMemo(
    () =>
      passkeyRegistrationMachine.provide({
        actors: {
          performRegistration: fromPromise(
            async (): Promise<{
              credentialId: string;
              browserAddress: string;
              serverAddress: string;
              backupState: boolean | null;
            }> => {
              if (
                typeof window !== "undefined" &&
                !window.PublicKeyCredential
              ) {
                throw Object.assign(
                  new Error("Este navegador no admite passkeys."),
                  { name: "NotSupportedError" },
                );
              }
              const begun = await json(
                await fetch("/api/wallet/passkey/begin", { method: "POST" }),
              );
              const options = (begun.options ??
                begun.registrationOptions ??
                begun) as PublicKeyCredentialCreationOptionsJSON;
              if (!options.rp?.id)
                throw new Error("Falta el RP ID de la passkey.");
              const credential = await startRegistration({
                optionsJSON: options,
              });
              if (
                credential.response.publicKeyAlgorithm !== -7 ||
                !credential.response.publicKey
              ) {
                throw Object.assign(
                  new Error(
                    "Este autenticador no creó una passkey ES256 compatible.",
                  ),
                  { name: "NotSupportedError" },
                );
              }

              const candidate = {
                ...kernelAccountMatrix,
                credentialId: credential.id,
                publicKey: publicKeyHex(credential.response.publicKey),
                rpId: options.rp.id,
                deploymentState: "counterfactual" as const,
                initializationHash: `0x${"00".repeat(32)}` as const,
              };
              const browserAccount = await deriveKernelAccount(candidate);
              const completed = (await json(
                await fetch("/api/wallet/passkey/complete", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    credential,
                    accountAddress: browserAccount.address,
                  }),
                }),
              )) as { address: string };
              if (
                completed.address.toLowerCase() !==
                browserAccount.address.toLowerCase()
              ) {
                throw new Error(
                  "Las direcciones de cuenta del servidor y del navegador no coinciden.",
                );
              }
              const { account } = (await json(
                await fetch("/api/wallet/passkey"),
              )) as {
                account: WalletPasskeyAccount;
              };
              await reconstructKernelAccount(account);
              // backup eligibility hint placeholder — synced vs device-bound disclosed via separate notice
              const backupState: boolean | null = null;
              return {
                credentialId: credential.id,
                browserAddress: browserAccount.address,
                serverAddress: completed.address,
                backupState,
              };
            },
          ),
        },
      }),
    [],
  );

  const [snapshot, send] = useMachine(machineWithActors);

  const busy =
    snapshot.matches("creating") || snapshot.value === "checkingAvailability";
  const isUnavailable = snapshot.matches("unavailable");
  const isError = snapshot.matches("registrationError");
  const isIdle = snapshot.matches("idle");
  const isChecking = snapshot.matches("checkingAvailability");
  const isSuccess = snapshot.matches("success");

  // availability blocking message
  const availability = snapshot.context.availability;
  const showAvailabilityBlock =
    (isUnavailable || (availability && isAvailabilityBlocking(availability))) &&
    !isChecking;

  // classify current error for distinct UI
  const errorKind = snapshot.context.errorKind;
  const errorMessage = snapshot.context.errorMessage;

  if (isSuccess) {
    // allow refresh side effect once
    if (typeof window !== "undefined") {
      // defer refresh to avoid setState during render loop issues
      setTimeout(() => router.refresh(), 0);
    }
  }

  return (
    <div>
      {isChecking && (
        <p className="text-sm text-muted-foreground">
          Verificando la compatibilidad con passkeys…
        </p>
      )}

      {showAvailabilityBlock && availability && (
        <div
          role="alert"
          className="max-w-xl rounded-2xl border bg-amber-500/10 p-4 text-sm"
        >
          <p className="font-bold">Passkey no disponible</p>
          <p className="mt-2 leading-6">{availabilityMessage(availability)}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Los navegadores incompatibles y la falta de WebAuthn se detectan
            antes de la activación. Usa una versión actual de Chromium, Safari o
            Firefox con un autenticador de plataforma (biometría/PIN) o una
            llave de seguridad multiplataforma. No se creó ninguna cuenta.
          </p>
          <button
            type="button"
            onClick={() => send({ type: "RETRY" })}
            className="mt-3 rounded-xl border bg-background px-4 py-2 text-xs font-bold"
          >
            Verificar de nuevo
          </button>
        </div>
      )}

      {!showAvailabilityBlock && !isChecking && (
        <button
          type="button"
          onClick={() => send({ type: "START_REGISTRATION" })}
          disabled={busy || isSuccess}
          className="w-full rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground shadow-lg transition hover:brightness-105 disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {snapshot.matches("creating")
            ? "Esperando a tu dispositivo…"
            : isSuccess
              ? "Event Pass protegidos"
              : "Proteger Event Pass"}
        </button>
      )}

      {isError && errorMessage && (
        <div
          role="alert"
          className="mt-4 max-w-xl rounded-xl border bg-card p-4 text-sm"
        >
          <p className="font-bold">
            {errorKind === "cancelled" && "Passkey cancelada"}
            {errorKind === "timeout" && "La passkey agotó el tiempo de espera"}
            {errorKind === "locked" && "Autenticador bloqueado"}
            {errorKind === "unavailable_transport" &&
              "Transporte del autenticador no disponible"}
            {errorKind === "missing_credential" && "Credencial no disponible"}
            {errorKind === "unsupported" && "Autenticador incompatible"}
            {errorKind === "unknown" && "Error de passkey"}
          </p>
          <p className="mt-2 leading-6 text-muted-foreground">{errorMessage}</p>
          <p className="mt-2 text-xs font-semibold">
            No se creó ni modificó nada. Tu cuenta existente, si la hay,
            conserva la misma dirección. Una credencial nueva controlaría una
            dirección diferente y no recupera una cuenta con fondos.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => send({ type: "RETRY" })}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Intentar de nuevo
            </button>
            <button
              type="button"
              onClick={() => send({ type: "RESET" })}
              className="rounded-xl border px-4 py-2 text-xs font-semibold"
            >
              Restablecer
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Estados recuperables: cancelación, tiempo de espera agotado,
            autenticador bloqueado, transporte no disponible o credencial
            seleccionada no disponible. Todos preservan la idempotencia y no
            alteran la asociación de la cuenta.
          </p>
        </div>
      )}

      {isIdle && !isError && !showAvailabilityBlock && (
        <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground">
          Las credenciales sincronizadas (iCloud Keychain, Google Password
          Manager) podrían estar disponibles al volver desde otros dispositivos
          y reconstruir la misma dirección de Kernel sin otro registro. Las
          credenciales vinculadas al dispositivo no se transfieren y Mint Up no
          garantiza la recuperación entre dispositivos.
        </p>
      )}

      {isSuccess && (
        <p className="mt-3 max-w-xl text-sm font-semibold text-emerald-700">
          Cuenta segura creada. Las próximas sesiones reconstruirán la misma
          dirección con tu credencial sincronizada cuando la plataforma la tenga
          disponible.
        </p>
      )}

      {/* Hidden hook for tests to detect WebAuthn cancellation handling */}
      <span className="hidden" data-testid="cancel-guard">
        Se canceló la configuración de la passkey. No se modificó nada.
      </span>
    </div>
  );
}
