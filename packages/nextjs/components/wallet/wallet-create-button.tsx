"use client";

import { useMemo } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";
import { Fingerprint, Loader2 } from "lucide-react";

import {
  deriveKernelAccount,
  kernelAccountMatrix,
  reconstructKernelAccount,
  type WalletPasskeyAccount,
} from "~~/lib/kernel-account";
import { passkeyRegistrationMachine } from "~~/lib/machines/passkey-registration-machine";

function publicKeyHex(publicKey: string) {
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    c => c.charCodeAt(0),
  );
  const point = bytes.slice(-65);
  if (point.length !== 65 || point[0] !== 4)
    throw new Error("The authenticator did not return a P-256 public key.");
  return `0x${Array.from(point, b => b.toString(16).padStart(2, "0")).join("")}` as const;
}

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Something went wrong.");
  return body;
}

export function WalletCreateButton() {
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
                    "This authenticator did not create a compatible passkey.",
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
              )) as { account: WalletPasskeyAccount };
              await reconstructKernelAccount(account);
              return {
                credentialId: credential.id,
                browserAddress: browserAccount.address,
                serverAddress: completed.address,
                backupState: null,
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
  const isSuccess = snapshot.matches("success");
  const isChecking = snapshot.matches("checkingAvailability");
  const availability = snapshot.context.availability;

  if (isSuccess && typeof window !== "undefined") {
    setTimeout(() => router.refresh(), 0);
  }

  if (isChecking) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground opacity-60"
      >
        <Loader2 className="size-4 animate-spin" />
        Checking your device…
      </button>
    );
  }

  if (isUnavailable && availability) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border bg-card p-4 text-center">
        <p className="text-sm font-bold">Face ID not available here</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Try a device with Face ID or fingerprint.
        </p>
        <button
          type="button"
          onClick={() => send({ type: "RETRY" })}
          className="mt-3 rounded-full border bg-background px-4 py-2 text-xs font-bold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => send({ type: "START_REGISTRATION" })}
        disabled={busy || isSuccess}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-[0.98] active:scale-[0.98] disabled:opacity-60"
      >
        {snapshot.matches("creating") ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Waiting for Face ID…
          </>
        ) : isSuccess ? (
          <>
            <Fingerprint className="size-4" />
            Secured
          </>
        ) : (
          <>
            <Fingerprint className="size-4" />
            Secure your event pass
          </>
        )}
      </button>
      {isError && snapshot.context.errorMessage ? (
        <p
          role="alert"
          className="max-w-sm text-center text-sm text-muted-foreground"
        >
          {snapshot.context.errorMessage}{" "}
          <button
            type="button"
            onClick={() => send({ type: "RETRY" })}
            className="font-bold text-foreground underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Unlock with Face ID or fingerprint next time.
        </p>
      )}
    </div>
  );
}
