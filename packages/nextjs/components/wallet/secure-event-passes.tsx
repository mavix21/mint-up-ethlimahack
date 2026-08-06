"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

import {
  deriveKernelAccount,
  kernelAccountMatrix,
  reconstructKernelAccount,
  type WalletPasskeyAccount,
} from "~~/lib/kernel-account";

type State = "idle" | "creating" | "verifying" | "complete" | "error";

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
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>();

  async function secure() {
    setState("creating");
    setMessage(undefined);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Passkeys are not supported in this browser.");
      }
      const begun = await json(
        await fetch("/api/wallet/passkey/begin", { method: "POST" }),
      );
      const options = (begun.options ??
        begun.registrationOptions ??
        begun) as PublicKeyCredentialCreationOptionsJSON;
      if (!options.rp.id) throw new Error("The passkey RP ID is missing.");
      const credential = await startRegistration({ optionsJSON: options });
      if (
        credential.response.publicKeyAlgorithm !== -7 ||
        !credential.response.publicKey
      ) {
        throw new Error(
          "This authenticator did not create a compatible ES256 passkey.",
        );
      }

      setState("verifying");
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
        completed.address.toLowerCase() !== browserAccount.address.toLowerCase()
      ) {
        throw new Error("Server and browser account addresses do not match.");
      }
      const { account } = (await json(await fetch("/api/wallet/passkey"))) as {
        account: WalletPasskeyAccount;
      };
      await reconstructKernelAccount(account);
      setState("complete");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Passkey setup was cancelled. Nothing was changed."
          : error instanceof Error
            ? error.message
            : "Passkey setup failed.",
      );
    }
  }

  const busy = state === "creating" || state === "verifying";
  return (
    <div>
      <button
        type="button"
        onClick={secure}
        disabled={busy}
        className="w-full rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground shadow-lg transition hover:brightness-105 disabled:cursor-wait disabled:opacity-65 sm:w-auto"
      >
        {state === "creating"
          ? "Waiting for your device..."
          : state === "verifying"
            ? "Verifying secure account..."
            : "Secure Event Passes"}
      </button>
      {message ? (
        <p role="alert" className="mt-4 max-w-xl text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
