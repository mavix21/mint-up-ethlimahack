"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "../../lib/abortable-wait";
import type { TransferPreparation } from "../../lib/event-pass-transfer-schema";
import { transferPreparationSchema } from "../../lib/event-pass-transfer-schema";
import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import { reconstructKernelAccount } from "../../lib/kernel-account";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "../../lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "../../lib/pimlico-user-operation";
import { prepareUserOperationResultSchema } from "../../lib/pimlico-user-operation-schema";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "../../lib/user-operation-status-polling";
import { EventPassTransferContent } from "./event-pass-transfer-content";

type State = "idle" | "form" | "review" | "pending" | "success" | "failure";
type RetryStep = "form" | "review" | "status" | "reconcile";

class RecipientUnavailableError extends Error {}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    if (body.code === "recipient_unavailable")
      throw new RecipientUnavailableError(body.message);
    throw new StatusRequestError(
      response.status,
      body.message ?? "No se pudo completar la transferencia.",
    );
  }
  return body as T;
}

export function EventPassTransfer({
  passId,
  eventName,
  account,
}: {
  passId: string;
  eventName: string;
  account: WalletPasskeyAccount;
}) {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const [preparation, setPreparation] = useState<TransferPreparation>();
  const [failure, setFailure] = useState<"recipient" | "operation">(
    "operation",
  );
  const [retryStep, setRetryStep] = useState<RetryStep>("form");
  const [submittedHash, setSubmittedHash] = useState<`0x${string}`>();
  const controller = useRef<AbortController>(null);
  const inputId = useId();
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);

  function cancel() {
    controller.current?.abort();
    setState("idle");
    setPreparation(undefined);
  }

  async function prepareRecipient() {
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          passId,
          recipientEmail: email,
          idempotencyKey: crypto.randomUUID(),
        }),
        signal: controller.current.signal,
      });
      const prepared = transferPreparationSchema.parse(
        await responseJson<TransferPreparation>(response),
      );
      setPreparation(prepared);
      setState("review");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure(
        error instanceof RecipientUnavailableError ? "recipient" : "operation",
      );
      setRetryStep("form");
      setState("failure");
    }
  }

  async function reconcile(transferId: string, signal: AbortSignal) {
    const response = await fetch(
      `/api/transfers/${encodeURIComponent(transferId)}/reconcile`,
      { method: "POST", signal },
    );
    await responseJson<{ status: "verified" }>(response);
  }

  async function retryVerifiedReconciliation() {
    if (!preparation) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setState("pending");
    try {
      await reconcile(preparation.transferId, controller.current.signal);
      setState("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setRetryStep("reconcile");
      setState("failure");
    }
  }

  async function verifyInclusionAndReconcile(
    userOperationHash: `0x${string}`,
    transferId: string,
    signal: AbortSignal,
  ) {
    const result = await pollUserOperationStatus({
      maxAttempts: 60,
      wait: () => abortableWait(2_000, signal),
      fetchStatus: async () =>
        responseJson<UserOperationStatusResult>(
          await fetch("/api/wallet/user-operation/status", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userOperationHash }),
            signal,
          }),
        ),
    });
    if (result.status !== "included") {
      setSubmittedHash(undefined);
      setRetryStep("review");
      throw new Error("No se verificó la inclusión de la transferencia");
    }

    setRetryStep("reconcile");
    await reconcile(transferId, signal);
  }

  async function retryVerifiedInclusion() {
    if (!preparation || !submittedHash) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setState("pending");
    try {
      await verifyInclusionAndReconcile(
        submittedHash,
        preparation.transferId,
        controller.current.signal,
      );
      setState("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setState("failure");
    }
  }

  async function confirmTransfer() {
    if (!preparation) return;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("pending");
    setRetryStep("review");

    if (Date.now() >= preparation.expiresAt) {
      setPreparation(undefined);
      setRetryStep("form");
      setFailure("operation");
      setState("failure");
      return;
    }

    try {
      const kernel = await reconstructKernelAccount(account);
      const { userOperationHash } = await prepareSignAndSubmitUserOperation({
        prepare: async () => {
          const response = await fetch("/api/wallet/user-operation/prepare", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ transferId: preparation.transferId }),
            signal,
          });
          return prepareUserOperationResultSchema.parse(
            await responseJson<PrepareUserOperationResult>(response),
          );
        },
        signUserOperation: operation =>
          kernel.signUserOperation(operation as never),
        submit: async payload =>
          responseJson<{ userOperationHash: `0x${string}` }>(
            await fetch("/api/wallet/user-operation/submit", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
              signal,
            }),
          ),
      });

      setSubmittedHash(userOperationHash);
      setRetryStep("status");
      await verifyInclusionAndReconcile(
        userOperationHash,
        preparation.transferId,
        signal,
      );
      setState("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setState("failure");
    }
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("form")}
        className="mt-auto min-h-10 rounded-full border bg-background px-4 text-sm font-bold hover:bg-muted"
      >
        Transferir
      </button>
    );
  }

  return (
    <div className="mt-1 border-t pt-4">
      <EventPassTransferContent
        state={state}
        eventName={eventName}
        recipientName={preparation?.recipientName}
        recipientEmail={email.trim().toLowerCase()}
        failure={failure}
        inputId={inputId}
        email={email}
        onEmailChange={setEmail}
        onPrepare={prepareRecipient}
        onConfirm={confirmTransfer}
        onCancel={cancel}
        onRetry={() => {
          if (retryStep === "reconcile") void retryVerifiedReconciliation();
          else if (retryStep === "status") void retryVerifiedInclusion();
          else setState(retryStep);
        }}
        onDone={() => {
          setState("idle");
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
