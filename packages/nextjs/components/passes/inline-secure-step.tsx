"use client";

import { useEffect, useEffectEvent, useMemo } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { BiometricUnavailable } from "./event-pass-purchase-content";
import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";

import {
  deriveKernelAccount,
  kernelAccountMatrix,
  reconstructKernelAccount,
  type WalletPasskeyAccount,
} from "~~/lib/kernel-account";
import { isAvailabilityBlocking } from "~~/lib/passkey-availability";
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
  if (!response.ok) throw new Error(body.message ?? "Passkey setup failed.");
  return body;
}

type Props = {
  onSuccess?: () => void;
};

export function InlineSecureStep({ onSuccess }: Props) {
  const router = useRouter();
  const notifySuccess = useEffectEvent(() => onSuccess?.());

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
  const isChecking = snapshot.matches("checkingAvailability");
  const isSuccess = snapshot.matches("success");

  const availability = snapshot.context.availability;
  const showAvailabilityBlock =
    (isUnavailable || (availability && isAvailabilityBlocking(availability))) &&
    !isChecking;

  useEffect(() => {
    if (!isSuccess) return;
    router.refresh();
    notifySuccess();
  }, [isSuccess, router]);

  if (showAvailabilityBlock) {
    return <BiometricUnavailable onRetry={() => send({ type: "RETRY" })} />;
  }

  if (isChecking) {
    return <p className="text-sm text-muted-foreground">Checking Face ID…</p>;
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-bold">Secure your passes</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Use Face ID to keep your passes safe
      </p>

      {!showAvailabilityBlock && !isChecking && (
        <button
          type="button"
          onClick={() => send({ type: "START_REGISTRATION" })}
          disabled={busy || isSuccess}
          className="mt-5 w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {snapshot.matches("creating")
            ? "Waiting for your device…"
            : isSuccess
              ? "Your passes are secured"
              : "Continue with Face ID"}
        </button>
      )}

      {isError && snapshot.context.errorMessage && (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <span>Not completed — try again</span>
          <button
            type="button"
            onClick={() => send({ type: "RETRY" })}
            className="ml-auto font-bold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        No seed phrase. No extension.
      </p>

      {isSuccess && (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Your passes are secured
        </p>
      )}

      {/* hidden guard for tests */}
      <span className="hidden" data-testid="secure-step">
        Secure your passes
      </span>
    </div>
  );
}
