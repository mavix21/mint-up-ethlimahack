"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "../../lib/abortable-wait";
import type { RefundPreparation } from "../../lib/event-pass-refund-schema";
import { refundPreparationSchema } from "../../lib/event-pass-refund-schema";
import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import { reconstructKernelAccount } from "../../lib/kernel-account";
import { prepareSignAndSubmitUserOperation } from "../../lib/pimlico-user-operation";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "../../lib/pimlico-user-operation-api";
import { prepareUserOperationResultSchema } from "../../lib/pimlico-user-operation-schema";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "../../lib/user-operation-status-polling";
import {
  EventPassRefundContent,
  type EventPassRefundContentState,
} from "./event-pass-refund-content";

type RetryStep = "refund" | "status" | "reconcile";

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok) {
    throw new StatusRequestError(
      response.status,
      body.message ?? "No se pudo completar el reembolso.",
    );
  }
  return body as T;
}

export function EventPassRefund({
  passId,
  eventName,
  originalAmountSubunits,
  account,
}: {
  passId: string;
  eventName: string;
  originalAmountSubunits: string;
  account: WalletPasskeyAccount;
}) {
  const [state, setState] = useState<EventPassRefundContentState>("available");
  const [preparation, setPreparation] = useState<RefundPreparation>();
  const [submittedHash, setSubmittedHash] = useState<`0x${string}`>();
  const [retryStep, setRetryStep] = useState<RetryStep>("refund");
  const controller = useRef<AbortController>(null);
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);

  async function reconcile(refundId: string, signal: AbortSignal) {
    await responseJson<{ status: "verified" }>(
      await fetch(`/api/refunds/${encodeURIComponent(refundId)}/reconcile`, {
        method: "POST",
        signal,
      }),
    );
  }

  async function verifyAndReconcile(
    userOperationHash: `0x${string}`,
    prepared: RefundPreparation,
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
      setRetryStep("refund");
      setSubmittedHash(undefined);
      throw new Error("El reembolso no fue incluido");
    }
    setRetryStep("reconcile");
    await reconcile(prepared.refundId, signal);
  }

  async function runRefund() {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("pending");
    setRetryStep("refund");

    try {
      const prepared = refundPreparationSchema.parse(
        await responseJson<RefundPreparation>(
          await fetch("/api/refunds", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              passId,
              idempotencyKey: crypto.randomUUID(),
            }),
            signal,
          }),
        ),
      );
      if (prepared.originalAmountSubunits !== originalAmountSubunits) {
        throw new Error("El monto del reembolso cambió");
      }
      setPreparation(prepared);
      if (prepared.requiresReconciliation) {
        setRetryStep("reconcile");
        await reconcile(prepared.refundId, signal);
        setState("received");
        startTransition(() => router.refresh());
        return;
      }

      const kernel = await reconstructKernelAccount(account);
      const { userOperationHash } = await prepareSignAndSubmitUserOperation({
        prepare: async () =>
          prepareUserOperationResultSchema.parse(
            await responseJson<PrepareUserOperationResult>(
              await fetch("/api/wallet/user-operation/prepare", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ refundId: prepared.refundId }),
                signal,
              }),
            ),
          ),
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
      await verifyAndReconcile(userOperationHash, prepared, signal);
      setState("received");
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setState("failure");
    }
  }

  async function retryProgress() {
    if (!preparation || retryStep === "refund") {
      await runRefund();
      return;
    }
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("pending");
    try {
      if (retryStep === "status" && submittedHash) {
        await verifyAndReconcile(submittedHash, preparation, signal);
      } else {
        await reconcile(preparation.refundId, signal);
      }
      setState("received");
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setState("failure");
    }
  }

  return (
    <EventPassRefundContent
      state={state}
      eventName={eventName}
      originalAmountSubunits={originalAmountSubunits}
      onConfirm={() => void runRefund()}
      onRetry={() => void retryProgress()}
    />
  );
}
