"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "../../lib/abortable-wait";
import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import { reconstructKernelAccount } from "../../lib/kernel-account";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "../../lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "../../lib/pimlico-user-operation";
import { prepareUserOperationResultSchema } from "../../lib/pimlico-user-operation-schema";
import type { ResalePurchasePreparation } from "../../lib/event-pass-resale-schema";
import { resalePurchasePreparationSchema } from "../../lib/event-pass-resale-schema";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "../../lib/user-operation-status-polling";
import {
  EventPassResalePurchaseButton,
  EventPassResalePurchaseContent,
  type ResalePurchaseContentState,
} from "./event-pass-resale-purchase-content";

type RetryStep = "purchase" | "status" | "reconcile";

class OfferUnavailableError extends Error {}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    if (body.code === "offer_unavailable")
      throw new OfferUnavailableError(body.message);
    throw new StatusRequestError(
      response.status,
      body.message ?? "The purchase could not be completed.",
    );
  }
  return body as T;
}

export function EventPassResalePurchase({
  passId,
  status,
  eventName,
  priceAmountSubunits,
  account,
  initialUsdcBalance,
  review,
}: {
  passId: string;
  status: "actionable" | "unavailable";
  eventName: string;
  priceAmountSubunits: string;
  account: WalletPasskeyAccount;
  initialUsdcBalance: string | null;
  review: ReactNode;
}) {
  const insufficient =
    initialUsdcBalance !== null &&
    BigInt(initialUsdcBalance) < BigInt(priceAmountSubunits);
  const [state, setState] = useState<"review" | ResalePurchaseContentState>(
    status === "unavailable"
      ? "stale"
      : insufficient
        ? "insufficient"
        : "review",
  );
  const [preparation, setPreparation] = useState<ResalePurchasePreparation>();
  const [submittedHash, setSubmittedHash] = useState<`0x${string}`>();
  const [retryStep, setRetryStep] = useState<RetryStep>("purchase");
  const controller = useRef<AbortController>(null);
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);

  async function reconcile(resalePurchaseId: string, signal: AbortSignal) {
    await responseJson<{ status: "verified" }>(
      await fetch(
        `/api/resale-purchases/${encodeURIComponent(resalePurchaseId)}/reconcile`,
        { method: "POST", signal },
      ),
    );
  }

  async function verifyAndReconcile(
    userOperationHash: `0x${string}`,
    prepared: ResalePurchasePreparation,
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
      setRetryStep("purchase");
      setSubmittedHash(undefined);
      throw new Error("Purchase was not included");
    }
    setRetryStep("reconcile");
    await reconcile(prepared.resalePurchaseId, signal);
  }

  async function runPurchase() {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("pending");
    setRetryStep("purchase");

    try {
      const prepared = resalePurchasePreparationSchema.parse(
        await responseJson<ResalePurchasePreparation>(
          await fetch("/api/resale-purchases", {
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
      if (
        prepared.priceAmountSubunits !== priceAmountSubunits ||
        Date.now() >= prepared.expiresAt
      ) {
        throw new OfferUnavailableError();
      }
      setPreparation(prepared);

      const kernel = await reconstructKernelAccount(account);
      const { userOperationHash } = await prepareSignAndSubmitUserOperation({
        prepare: async () =>
          prepareUserOperationResultSchema.parse(
            await responseJson<PrepareUserOperationResult>(
              await fetch("/api/wallet/user-operation/prepare", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  resalePurchaseId: prepared.resalePurchaseId,
                }),
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
      setState("success");
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setState(error instanceof OfferUnavailableError ? "stale" : "failure");
    }
  }

  async function retryProgress() {
    if (!preparation || retryStep === "purchase") {
      await runPurchase();
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
        await reconcile(preparation.resalePurchaseId, signal);
      }
      setState("success");
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setState("failure");
    }
  }

  if (state === "review") {
    return (
      <div className="space-y-4">
        {review}
        <EventPassResalePurchaseButton
          priceAmountSubunits={priceAmountSubunits}
          onConfirm={() => void runPurchase()}
        />
      </div>
    );
  }

  return (
    <EventPassResalePurchaseContent
      state={state}
      eventName={eventName}
      priceAmountSubunits={priceAmountSubunits}
      balanceAmountSubunits={initialUsdcBalance}
      onRetry={() => {
        if (state === "stale" || state === "insufficient") {
          startTransition(() => router.refresh());
        } else {
          void retryProgress();
        }
      }}
    />
  );
}
