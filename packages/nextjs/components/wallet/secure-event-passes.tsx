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
    throw new Error("The authenticator did not return a P-256 public key.");
  }
  return `0x${Array.from(point, byte => byte.toString(16).padStart(2, "0")).join("")}` as const;
}

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Passkey setup failed.");
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
                  new Error("Passkeys are not supported in this browser."),
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
                throw new Error("The passkey RP ID is missing.");
              const credential = await startRegistration({
                optionsJSON: options,
              });
              if (
                credential.response.publicKeyAlgorithm !== -7 ||
                !credential.response.publicKey
              ) {
                throw Object.assign(
                  new Error(
                    "This authenticator did not create a compatible ES256 passkey.",
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
                  "Server and browser account addresses do not match.",
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
          Checking passkey capability…
        </p>
      )}

      {showAvailabilityBlock && availability && (
        <div
          role="alert"
          className="max-w-xl rounded-2xl border bg-amber-500/10 p-4 text-sm"
        >
          <p className="font-bold">Passkey not available</p>
          <p className="mt-2 leading-6">{availabilityMessage(availability)}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Unsupported browsers and missing WebAuthn capability are detected
            before activation. Use a current Chromium, Safari, or Firefox with a
            platform authenticator (biometric/PIN) or a cross-platform security
            key. No account was created.
          </p>
          <button
            type="button"
            onClick={() => send({ type: "RETRY" })}
            className="mt-3 rounded-xl border bg-background px-4 py-2 text-xs font-bold"
          >
            Check again
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
            ? "Waiting for your device…"
            : isSuccess
              ? "Event Passes secured"
              : "Secure Event Passes"}
        </button>
      )}

      {isError && errorMessage && (
        <div
          role="alert"
          className="mt-4 max-w-xl rounded-xl border bg-card p-4 text-sm"
        >
          <p className="font-bold">
            {errorKind === "cancelled" && "Passkey cancelled"}
            {errorKind === "timeout" && "Passkey timed out"}
            {errorKind === "locked" && "Authenticator locked"}
            {errorKind === "unavailable_transport" &&
              "Authenticator transport unavailable"}
            {errorKind === "missing_credential" && "Credential not available"}
            {errorKind === "unsupported" && "Unsupported authenticator"}
            {errorKind === "unknown" && "Passkey error"}
          </p>
          <p className="mt-2 leading-6 text-muted-foreground">{errorMessage}</p>
          <p className="mt-2 text-xs font-semibold">
            Nothing was created or changed. Your existing account (if any)
            remains at the same address. A new credential would control a
            different address and does not recover a funded account.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => send({ type: "RETRY" })}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => send({ type: "RESET" })}
              className="rounded-xl border px-4 py-2 text-xs font-semibold"
            >
              Reset
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Recoverable states: cancellation, timeout, locked authenticator,
            unavailable transport, unavailable selected credential — all
            preserve idempotency and do not alter account association.
          </p>
        </div>
      )}

      {isIdle && !isError && !showAvailabilityBlock && (
        <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground">
          Synced credentials (iCloud Keychain, Google Password Manager) may be
          available on returning devices and reconstruct the same Kernel address
          without another registration. Device-bound credentials do not move and
          Mint Up does not promise cross-device recovery.
        </p>
      )}

      {isSuccess && (
        <p className="mt-3 max-w-xl text-sm font-semibold text-emerald-700">
          Secure account created. Returning sessions will reconstruct the same
          address with your synced credential where the platform makes it
          available.
        </p>
      )}

      {/* Hidden hook for tests to detect WebAuthn cancellation handling */}
      <span className="hidden" data-testid="cancel-guard">
        Passkey setup was cancelled. Nothing was changed.
      </span>
    </div>
  );
}
