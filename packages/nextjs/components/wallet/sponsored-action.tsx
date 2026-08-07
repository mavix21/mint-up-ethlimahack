"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "~~/lib/abortable-wait";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { reconstructKernelAccount } from "~~/lib/kernel-account";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "~~/lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "~~/lib/pimlico-user-operation";
import { resumeOrCreateSponsoredOperation } from "~~/lib/sponsored-operation-flow";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "~~/lib/user-operation-status-polling";

type State =
  | "idle"
  | "preparing"
  | "biometric"
  | "submitted"
  | "included"
  | "rejected"
  | "failure"
  | "cancelled";

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new StatusRequestError(
      response.status,
      body.message ?? "The action failed.",
    );
  return body;
}

const MAX_STATUS_ATTEMPTS = 60;

export function SponsoredAction({
  account,
}: {
  account: WalletPasskeyAccount;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>();
  const [userOperationHash, setUserOperationHash] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<string>();
  const controller = useRef<AbortController>(null);
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);

  async function send() {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("preparing");
    setMessage(undefined);
    setUserOperationHash(undefined);
    setTransactionHash(undefined);
    try {
      const started = await resumeOrCreateSponsoredOperation({
        resume: async () =>
          json(
            await fetch("/api/wallet/user-operation/resume", {
              method: "POST",
              signal,
            }),
          ),
        create: async () => {
          const kernel = await reconstructKernelAccount(account);
          return await prepareSignAndSubmitUserOperation({
            prepare: async () => {
              const prepared = await json<PrepareUserOperationResult>(
                await fetch("/api/wallet/user-operation/prepare", {
                  method: "POST",
                  signal,
                }),
              );
              setState("biometric");
              return prepared;
            },
            signUserOperation: operation =>
              kernel.signUserOperation(operation as never),
            submit: async payload =>
              json<{ userOperationHash: `0x${string}` }>(
                await fetch("/api/wallet/user-operation/submit", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(payload),
                  signal,
                }),
              ),
          });
        },
      });
      setUserOperationHash(started.userOperationHash);

      let result = started.result;
      if (result.status === "pending") {
        setState("submitted");
        result = await pollUserOperationStatus({
          maxAttempts: MAX_STATUS_ATTEMPTS,
          wait: () => abortableWait(2_000, signal),
          fetchStatus: async () =>
            json<UserOperationStatusResult>(
              await fetch("/api/wallet/user-operation/status", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  userOperationHash: started.userOperationHash,
                }),
                signal,
              }),
            ),
        });
      }
      if (result.status === "included") {
        setTransactionHash(result.transactionHash);
        setState("included");
        router.refresh();
      } else {
        setState(result.status === "rejected" ? "rejected" : "failure");
        setMessage(result.message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const cancelled =
        error instanceof Error && error.name === "NotAllowedError";
      setState(cancelled ? "cancelled" : "failure");
      setMessage(
        cancelled
          ? "Passkey confirmation was cancelled. Nothing was submitted."
          : error instanceof Error
            ? error.message
            : "The sponsored action failed.",
      );
    }
  }

  const busy =
    state === "preparing" || state === "biometric" || state === "submitted";
  const labels: Record<State, string> = {
    idle: "Run approved action",
    preparing: "Preparing sponsored operation...",
    biometric: "Confirm with your passkey...",
    submitted: "Submitted, waiting for inclusion...",
    included: "Included on Arbitrum Sepolia",
    rejected: "Operation rejected",
    failure: "Operation failed",
    cancelled: "Confirmation cancelled",
  };

  return (
    <div className="mt-6 border-t border-neutral-content/10 pt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-content/50">
        Approved action
      </p>
      <p className="mt-2 text-sm">
        EntryPoint.balanceOf(account) · 0 ETH · Arbitrum Sepolia
      </p>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="mt-4 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-65"
      >
        {labels[state]}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
      {userOperationHash ? (
        <p className="mt-3 break-all font-mono text-xs">
          UserOperation: {userOperationHash}
        </p>
      ) : null}
      {transactionHash ? (
        <p className="mt-2 break-all font-mono text-xs">
          Transaction: {transactionHash}
        </p>
      ) : null}
    </div>
  );
}
