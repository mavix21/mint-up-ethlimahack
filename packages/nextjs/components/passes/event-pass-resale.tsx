"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "../../lib/abortable-wait";
import { formatUsdc } from "../../lib/event-pass-offers";
import type { WalletPasskeyAccount } from "../../lib/kernel-account";
import { reconstructKernelAccount } from "../../lib/kernel-account";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "../../lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "../../lib/pimlico-user-operation";
import { prepareUserOperationResultSchema } from "../../lib/pimlico-user-operation-schema";
import type {
  PrivateResaleOffer,
  ResalePreparation,
  ResaleWithdrawalPreparation,
} from "../../lib/event-pass-resale-schema";
import {
  parseHumanUsdc,
  resaleEconomics,
  resalePreparationSchema,
  resaleWithdrawalPreparationSchema,
} from "../../lib/event-pass-resale-schema";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "../../lib/user-operation-status-polling";
import {
  EventPassResaleContent,
  type ResaleAction,
  type ResaleContentState,
} from "./event-pass-resale-content";

type RetryStep = "form" | "review" | "withdraw" | "status" | "reconcile";
type Preparation =
  ResalePreparation | (ResaleWithdrawalPreparation & { kind: "withdraw" });

function formatSubunits(value: string) {
  return formatUsdc(value);
}

function formatEconomics(price: string) {
  try {
    const economics = resaleEconomics(parseHumanUsdc(price));
    return { fee: formatUsdc(economics.fee), net: formatUsdc(economics.net) };
  } catch {
    return { fee: "", net: "" };
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new StatusRequestError(
      response.status,
      body.message ?? "The offer could not be completed.",
    );
  }
  return body as T;
}

export function EventPassResale({
  passId,
  eventName,
  account,
  offer,
  maximumPriceAmountSubunits,
}: {
  passId: string;
  eventName: string;
  account: WalletPasskeyAccount;
  offer: PrivateResaleOffer | null;
  maximumPriceAmountSubunits: string;
}) {
  const [state, setState] = useState<"idle" | ResaleContentState>("idle");
  const [action, setAction] = useState<ResaleAction>(
    offer ? "replace" : "create",
  );
  const [price, setPrice] = useState(offer?.price.amount ?? "");
  const [preparation, setPreparation] = useState<Preparation>();
  const [failure, setFailure] = useState<"validation" | "operation">(
    "operation",
  );
  const [retryStep, setRetryStep] = useState<RetryStep>("form");
  const [submittedHash, setSubmittedHash] = useState<`0x${string}`>();
  const [preparingWithdrawal, setPreparingWithdrawal] = useState(false);
  const controller = useRef<AbortController>(null);
  const priceId = useId();
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);

  function cancel() {
    controller.current?.abort();
    setState("idle");
    setPreparation(undefined);
  }

  function openForm() {
    setAction(offer ? "replace" : "create");
    setState("form");
  }

  async function prepareOffer() {
    try {
      const amount = parseHumanUsdc(price);
      if (BigInt(amount) > BigInt(maximumPriceAmountSubunits))
        throw new Error();
    } catch {
      setFailure("validation");
      setRetryStep("form");
      setState("failure");
      return;
    }

    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/resales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          passId,
          price,
          idempotencyKey: crypto.randomUUID(),
        }),
        signal: controller.current.signal,
      });
      const prepared = resalePreparationSchema.parse(
        await responseJson<ResalePreparation>(response),
      );
      setPreparation(prepared);
      setAction(prepared.kind);
      setState("review");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setRetryStep("form");
      setState("failure");
    }
  }

  async function prepareWithdrawal() {
    controller.current?.abort();
    controller.current = new AbortController();
    setPreparingWithdrawal(true);
    setAction("withdraw");
    try {
      const response = await fetch("/api/resales/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          passId,
          idempotencyKey: crypto.randomUUID(),
        }),
        signal: controller.current.signal,
      });
      const prepared = resaleWithdrawalPreparationSchema.parse(
        await responseJson<ResaleWithdrawalPreparation>(response),
      );
      setPreparation({ ...prepared, kind: "withdraw" });
      setState("review");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setRetryStep("withdraw");
      setState("failure");
    } finally {
      setPreparingWithdrawal(false);
    }
  }

  async function reconcile(resaleId: string, signal: AbortSignal) {
    const response = await fetch(
      `/api/resales/${encodeURIComponent(resaleId)}/reconcile`,
      { method: "POST", signal },
    );
    await responseJson<{ status: "verified" }>(response);
  }

  async function verifyInclusionAndReconcile(
    userOperationHash: `0x${string}`,
    resaleId: string,
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
      throw new Error("Offer inclusion was not verified");
    }
    setRetryStep("reconcile");
    await reconcile(resaleId, signal);
  }

  async function retryVerifiedReconciliation() {
    if (!preparation) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setState("pending");
    try {
      await reconcile(preparation.resaleId, controller.current.signal);
      setState("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setRetryStep("reconcile");
      setState("failure");
    }
  }

  async function retryVerifiedInclusion() {
    if (!preparation || !submittedHash) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setState("pending");
    try {
      await verifyInclusionAndReconcile(
        submittedHash,
        preparation.resaleId,
        controller.current.signal,
      );
      setState("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFailure("operation");
      setState("failure");
    }
  }

  async function confirm() {
    if (!preparation) return;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("pending");
    setRetryStep("review");

    if (Date.now() >= preparation.expiresAt) {
      setPreparation(undefined);
      setFailure("operation");
      setRetryStep(action === "withdraw" ? "withdraw" : "form");
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
            body: JSON.stringify({ resaleId: preparation.resaleId }),
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
        preparation.resaleId,
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
    if (!offer) {
      return (
        <button
          type="button"
          onClick={openForm}
          className="min-h-10 rounded-full border bg-background px-4 text-sm font-bold hover:bg-muted"
        >
          Put up for resale
        </button>
      );
    }
    return (
      <div className="space-y-3 rounded-xl bg-muted/60 p-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pass resale
          </p>
          <p className="mt-1 font-bold">{offer.price.amount} USDC</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openForm}
            disabled={preparingWithdrawal}
            className="min-h-10 flex-1 rounded-full border bg-background px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
          >
            Update listing
          </button>
          <button
            type="button"
            onClick={() => void prepareWithdrawal()}
            disabled={preparingWithdrawal}
            className="min-h-10 flex-1 rounded-full border bg-background px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
          >
            {preparingWithdrawal ? "Preparing..." : "Remove listing"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <EventPassResaleContent
        state={state}
        eventName={eventName}
        action={action}
        price={price}
        fee={formatEconomics(price).fee}
        net={formatEconomics(price).net}
        maximumPrice={formatSubunits(maximumPriceAmountSubunits)}
        failure={failure}
        priceInputId={priceId}
        onPriceChange={setPrice}
        onPrepare={prepareOffer}
        onConfirm={confirm}
        onCancel={cancel}
        onRetry={() => {
          if (retryStep === "reconcile") void retryVerifiedReconciliation();
          else if (retryStep === "status") void retryVerifiedInclusion();
          else if (retryStep === "withdraw") void prepareWithdrawal();
          else setState(retryStep);
        }}
        onDone={() => {
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
