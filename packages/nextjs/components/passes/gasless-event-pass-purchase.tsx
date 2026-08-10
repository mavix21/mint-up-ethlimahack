"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, erc20Abi, getAddress, http } from "viem";

import { formatUsdc } from "~~/lib/event-pass-offers";
import {
  preparedPurchaseSchema,
  purchaseStatusSchema,
  responseJson,
  initialPurchaseLifecycleStage,
  type PreparedPurchase,
} from "~~/lib/event-pass-purchase-api";
import {
  buildPurchaseBatchCalls,
  encodePurchaseBatch,
  validateSponsoredPurchaseBatch,
} from "~~/lib/event-pass-purchase-batch";
import { canFundPurchase } from "~~/lib/event-pass-transactions";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { reconstructKernelAccount } from "~~/lib/kernel-account";
import type { UserOperationStatusResult } from "~~/lib/pimlico-user-operation-api";
import { prepareUserOperationResultSchema } from "~~/lib/pimlico-user-operation-schema";
import { prepareSignAndSubmitUserOperation } from "~~/lib/pimlico-user-operation";
import {
  getPasskeyAvailability,
  isAvailabilityBlocking,
} from "~~/lib/passkey-availability";
import { classifyPasskeyError } from "~~/lib/passkey-errors";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";
import { getEarlyBirdsRedirectUrl } from "~~/lib/early-birds-return";
import { SuccessDialog } from "./success-dialog";
import {
  BiometricUnavailable,
  EventPassPurchaseError,
  EventPassPurchaseReview,
} from "./event-pass-purchase-content";

type Props = {
  eventId: string;
  eventName: string;
  eventIdentifier: `0x${string}`;
  passkeyAccount: WalletPasskeyAccount;
  chainId: 412346 | 421614;
  chainName: string;
  contractAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  priceAmountSubunits: string;
  remaining: number;
  revenueRecipient: `0x${string}`;
  initialUsdcBalance?: string | null;
  fixtureMode?: boolean;
  mintUpReturnTo?: string | null;
};

type Stage =
  | "idle"
  | "preparing"
  | "prepared"
  | "sponsoring"
  | "signing"
  | "submitting"
  | "submitted"
  | "included"
  | "reconciling"
  | "confirmed"
  | "rejected"
  | "expired"
  | "dropped"
  | "unknown"
  | "failed"
  | "cancelled";
// backwards compat alias: "confirming" maps to signing stage
type LegacyStage = Stage | "confirming";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function backoff(attempt: number, base = 1500, max = 8000) {
  return Math.min(base * 2 ** attempt, max);
}

function isWebAuthnCancellation(error: unknown): boolean {
  const classified = classifyPasskeyError(error);
  return (
    classified.kind === "cancelled" ||
    classified.kind === "timeout" ||
    classified.kind === "locked" ||
    classified.kind === "missing_credential" ||
    classified.kind === "unavailable_transport" ||
    classified.kind === "unsupported" ||
    classified.kind === "unknown"
  );
}

function actionableSponsorshipMessage(message: string): string {
  void message;
  return "We couldn't get your Event Pass. Try again.";
}

function isFundsRelatedMessage(message: string): boolean {
  return /insufficient|underfunded|not enough|balance|funds/i.test(message);
}

function buildAddUsdcMessage(delta: bigint): string {
  return `Add USDC to continue — ${formatUsdc(delta.toString())}`;
}

type Persisted = {
  purchaseId?: string;
  userOperationHash?: string;
  transactionHash?: string;
  stage?: LegacyStage;
  passId?: string;
};

function readPersisted(syncKey: string): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(syncKey);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    try {
      localStorage.removeItem(syncKey);
    } catch {}
    return null;
  }
}

export function GaslessEventPassPurchase(props: Props) {
  const price = BigInt(props.priceAmountSubunits);
  const syncKey = `mint-up:gasless-purchase:${props.eventId}:${props.passkeyAccount.address.toLowerCase()}`;
  const queryClient = useQueryClient();

  const [funds, setFunds] = useState<bigint | null>(() => {
    if (props.fixtureMode) return price * 2n;
    if (props.initialUsdcBalance != null) {
      try {
        return BigInt(props.initialUsdcBalance);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [prepared, setPrepared] = useState<PreparedPurchase | null>(null);
  const [frozen, setFrozen] = useState<PreparedPurchase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialPersisted = useMemo(() => readPersisted(syncKey), [syncKey]);

  // Success celebration should ONLY fire when the user freshly confirms in this session.
  // If the purchase was already confirmed before this mount (persisted or via resume),
  // we must not auto-show the SuccessDialog nor auto-redirect.
  const [shouldCelebrate, setShouldCelebrate] = useState(false);

  const [stage, setStage] = useState<Stage>(() => {
    return initialPurchaseLifecycleStage(
      initialPersisted?.stage,
      Boolean(initialPersisted?.purchaseId),
    );
  });
  const [userOperationHash, setUserOperationHash] = useState<
    `0x${string}` | null
  >(
    () =>
      (initialPersisted?.userOperationHash as `0x${string}` | undefined) ??
      null,
  );
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(
    () =>
      (initialPersisted?.transactionHash as `0x${string}` | undefined) ?? null,
  );
  const [passId, setPassId] = useState<string | null>(
    () => initialPersisted?.passId ?? null,
  );
  const abortRef = useRef<AbortController | null>(null);

  // --- TanStack Query: passkey availability (replaces useEffect fetch) ---
  const availabilityQuery = useQuery({
    queryKey: ["passkey-availability"],
    queryFn: getPasskeyAvailability,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const availability = availabilityQuery.data ?? null;
  const availabilityChecked =
    availabilityQuery.isSuccess || availabilityQuery.isError;
  const blocking = availability ? isAvailabilityBlocking(availability) : false;

  useEffect(() => {
    // Only redirect for a fresh confirmation in this session, not for a resumed/persisted confirmed state on re-enter
    if (!shouldCelebrate) return;
    const destination = getEarlyBirdsRedirectUrl(
      props.mintUpReturnTo,
      stage === "confirmed" ? "confirmed" : undefined,
      stage === "confirmed",
    );
    if (destination) window.location.replace(destination);
  }, [props.mintUpReturnTo, stage, shouldCelebrate]);

  function persist(next: Persisted) {
    try {
      // Never persist raw signatures, assertions, or passkey response data — only hashes and purchase identity
      const sanitized: Persisted = {
        purchaseId: next.purchaseId,
        userOperationHash: next.userOperationHash,
        transactionHash: next.transactionHash,
        stage: next.stage as Stage,
        passId: next.passId,
      };
      localStorage.setItem(syncKey, JSON.stringify(sanitized));
    } catch {}
  }

  async function readUsdcBalance(): Promise<bigint> {
    const chain =
      props.chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
    const client = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });
    return (await client.readContract({
      address: props.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [props.passkeyAccount.address],
    })) as bigint;
  }

  // USDC balance via TanStack Query mutation (declarative fetch, no useEffect)
  const usdcBalanceMutation = useMutation({
    mutationFn: readUsdcBalance,
    onSuccess: balance => setFunds(balance),
    onError: () =>
      setError(`Could not read USDC balance. Check the network and try again.`),
  });

  async function refreshFunds() {
    if (props.fixtureMode) return;
    // Prefer cached query data if available, otherwise fetch via mutation
    const cached = queryClient.getQueryData<bigint>([
      "usdc-balance",
      props.chainId,
      props.usdcAddress,
      props.passkeyAccount.address,
    ]);
    if (cached != null) {
      setFunds(cached);
      return;
    }
    await usdcBalanceMutation.mutateAsync();
  }

  // expose USDC balance as query for future invalidations (no useEffect needed)
  useQuery({
    queryKey: [
      "usdc-balance",
      props.chainId,
      props.usdcAddress,
      props.passkeyAccount.address,
    ],
    queryFn: readUsdcBalance,
    enabled: false,
    staleTime: 30_000,
  });

  async function pollUserOperationInclusion(
    hash: `0x${string}`,
    silent = false,
  ): Promise<UserOperationStatusResult | null> {
    const maxAttempts = 20;
    let status: UserOperationStatusResult | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (abortRef.current?.signal.aborted)
        throw new DOMException("Polling stopped", "AbortError");
      const res = await fetch("/api/wallet/user-operation/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userOperationHash: hash }),
      });
      if (!res.ok) {
        // 503 is retryable, others are terminal for sponsorship layer but we continue with backoff
        if (res.status === 503 || res.status >= 500) {
          // transient
        } else {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(
            body.message ?? "Operation inclusion verification failed.",
          );
        }
      } else {
        status = (await res.json()) as UserOperationStatusResult;
        if (status.status === "included" && status.transactionHash) {
          return status;
        }
        if (
          status.status === "rejected" ||
          status.status === "failed" ||
          status.status === "reverted"
        ) {
          throw new Error(
            status.message ?? `Operation ${status.status} by bundler.`,
          );
        }
        if (status.status === "pending") {
          // continue polling
        }
      }
      await wait(backoff(attempt));
    }
    if (!silent) throw new Error("Not completed — try again");
    return status;
  }

  async function pollReconciliation(
    purchaseId: string,
    uopHash: `0x${string}`,
    txHash: `0x${string}`,
    silent = false,
  ) {
    void silent;
    void uopHash;
    void txHash;
    // bounded polling with backoff for reconciliation
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (abortRef.current?.signal.aborted)
        throw new DOMException("Polling stopped", "AbortError");
      const res = await fetch(`/api/purchases/${purchaseId}`);
      if (!res.ok) {
        await wait(backoff(attempt));
        continue;
      }
      const status = await responseJson(res, purchaseStatusSchema);
      if (status.status === "confirmed") return status;
      if (status.status === "rejected")
        throw new Error(
          status.failure ?? "Purchase rejected during reconciliation.",
        );
      if (status.status === "expired" || status.status === "expiredOrDropped")
        throw new Error(status.failure ?? "Purchase expired. Prepare again.");
      if (status.status === "dropped")
        throw new Error(
          status.failure ?? "Operation dropped. Retry available.",
        );
      if (status.status === "unknown")
        throw new Error("Not completed — try again");
      await wait(backoff(attempt));
    }
    throw new Error("Not completed — try again");
  }

  // Reload / new session: resume status from authenticated backend data using purchase/UserOperation identities
  // TanStack Query replaces useEffect for this fetch — no useEffect needed, declarative data fetching
  async function resumeFromBackend(): Promise<null> {
    if (typeof window === "undefined") return null;
    const persisted = readPersisted(syncKey);

    // Try to fetch purchase status if we have a purchaseId (from localStorage)
    if (persisted?.purchaseId) {
      try {
        const res = await fetch(`/api/purchases/${persisted.purchaseId}`);
        if (res.ok) {
          const status = await responseJson(res, purchaseStatusSchema);
          if (status.status === "confirmed" && status.pass) {
            setPassId(status.pass.passId);
            setStage("confirmed");
            setUserOperationHash(
              (status.userOperationHash as `0x${string}`) ??
                (persisted.userOperationHash as `0x${string}`) ??
                null,
            );
            setTransactionHash(
              (status.transactionHash as `0x${string}`) ??
                (persisted.transactionHash as `0x${string}`) ??
                null,
            );
            // keep persisted as confirmed
            persist({
              purchaseId: persisted.purchaseId,
              userOperationHash:
                status.userOperationHash ?? persisted.userOperationHash,
              transactionHash:
                status.transactionHash ?? persisted.transactionHash,
              stage: "confirmed",
              passId: status.pass.passId,
            });
            return null;
          }
          if (status.status === "rejected") {
            setStage("rejected");
            setError(
              status.failure ?? "Purchase rejected during reconciliation.",
            );
            setUserOperationHash(
              (status.userOperationHash as `0x${string}`) ??
                (persisted.userOperationHash as `0x${string}`) ??
                null,
            );
            setTransactionHash(
              (status.transactionHash as `0x${string}`) ??
                (persisted.transactionHash as `0x${string}`) ??
                null,
            );
            return null;
          }
          if (
            status.status === "expired" ||
            status.status === "expiredOrDropped"
          ) {
            setStage("expired");
            setError(
              status.failure ?? "Purchase preparation expired. Prepare again.",
            );
            return null;
          }
          if (status.status === "dropped") {
            setStage("dropped");
            setError(
              status.failure ??
                "Operation dropped or not included. Retry is available.",
            );
            return null;
          }
          if (status.status === "unknown") {
            setStage("unknown");
            setError("Not completed — try again");
            return null;
          }
          // For submitted/included/synchronizing -> continue polling
          if (
            ["submitted", "included", "synchronizing"].includes(status.status)
          ) {
            // need frozen snapshot? we at least have purchaseId and hashes
            setUserOperationHash(
              (status.userOperationHash as `0x${string}`) ??
                (persisted.userOperationHash as `0x${string}`) ??
                null,
            );
            setTransactionHash(
              (status.transactionHash as `0x${string}`) ??
                (persisted.transactionHash as `0x${string}`) ??
                null,
            );
            if (status.status === "submitted") setStage("submitted");
            else setStage("reconciling");
            // attempt to poll reconciliation if we have both hashes
            const uop = (status.userOperationHash ??
              persisted.userOperationHash) as `0x${string}` | undefined;
            const tx = (status.transactionHash ?? persisted.transactionHash) as
              `0x${string}` | undefined;
            if (uop && tx) {
              try {
                const reconciled = await pollReconciliation(
                  persisted.purchaseId,
                  uop,
                  tx,
                  true,
                );
                if (reconciled?.pass) {
                  setPassId(reconciled.pass.passId);
                  setStage("confirmed");
                }
              } catch (e) {
                const msg =
                  e instanceof Error ? e.message : "Reconciliation pending";
                if (/unknown/i.test(msg)) setStage("unknown");
              }
            } else if (uop) {
              // still polling UserOperation inclusion
              try {
                const polled = await pollUserOperationInclusion(uop, true);
                if (
                  polled &&
                  "transactionHash" in polled &&
                  polled.transactionHash
                ) {
                  setTransactionHash(polled.transactionHash as `0x${string}`);
                  setStage("reconciling");
                }
              } catch {}
            }
            return null;
          }
        }
      } catch {}
    }

    // Also try global pending UserOperation resume (covers cleared localStorage case)
    try {
      const res = await fetch("/api/wallet/user-operation/resume", {
        method: "POST",
      });
      if (res.ok) {
        const body = (await res.json()) as {
          userOperationHash?: string;
          result?: UserOperationStatusResult;
        } | null;
        if (body?.userOperationHash && body.result) {
          const hash = body.userOperationHash as `0x${string}`;
          setUserOperationHash(hash);
          if (
            body.result.status === "included" &&
            "transactionHash" in body.result &&
            body.result.transactionHash
          ) {
            setTransactionHash(body.result.transactionHash as `0x${string}`);
            setStage("reconciling");
            // if we have a purchaseId from persisted or we can try to reconcile via that purchase
            if (persisted?.purchaseId) {
              try {
                const reconciled = await pollReconciliation(
                  persisted.purchaseId,
                  hash,
                  body.result.transactionHash as `0x${string}`,
                  true,
                );
                if (reconciled?.pass) {
                  setPassId(reconciled.pass.passId);
                  setStage("confirmed");
                }
              } catch {}
            }
          } else if (body.result.status === "pending") {
            setStage("submitted");
          } else if (
            ["rejected", "failed", "reverted"].includes(body.result.status)
          ) {
            setStage("rejected");
            setError(
              body.result.message ??
                "Operation rejected by bundler. Prepare again.",
            );
          }
          // persist hash even if purchaseId unknown (allows diagnostic visibility)
          if (!persisted?.purchaseId) {
            persist({ userOperationHash: hash, stage: "submitted" });
          }
        }
      }
    } catch {}
    return null;
  }

  useQuery({
    queryKey: ["gasless-purchase-resume", syncKey],
    queryFn: resumeFromBackend,
    enabled: typeof window !== "undefined",
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const prepareMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: props.eventId,
          buyerAddress: props.passkeyAccount.address,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const preparedPurchase = await responseJson(res, preparedPurchaseSchema);
      const mismatches = [
        preparedPurchase.chainId !== props.chainId ? "network" : null,
        getAddress(preparedPurchase.buyerAddress) !==
        getAddress(props.passkeyAccount.address)
          ? "buyer"
          : null,
        getAddress(preparedPurchase.contractAddress) !==
        getAddress(props.contractAddress)
          ? "contract"
          : null,
        getAddress(preparedPurchase.paymentAssetAddress) !==
        getAddress(props.usdcAddress)
          ? "payment asset"
          : null,
        getAddress(preparedPurchase.revenueRecipient) !==
        getAddress(props.revenueRecipient)
          ? "recipient"
          : null,
        preparedPurchase.priceAmountSubunits !== props.priceAmountSubunits
          ? "price"
          : null,
        preparedPurchase.eventIdentifier.toLowerCase() !==
        props.eventIdentifier.toLowerCase()
          ? "event"
          : null,
      ].filter(Boolean);
      if (mismatches.length > 0) {
        throw new Error(
          `Prepared purchase mismatch: ${mismatches.join(", ")}. Refresh and try again.`,
        );
      }
      return preparedPurchase;
    },
    onMutate: () => {
      setStage("preparing");
      setError(null);
    },
    onSuccess: preparedPurchase => {
      setPrepared(preparedPurchase);
      setStage("prepared");
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error ? e.message : "Could not prepare purchase.";
      const actionable = actionableSponsorshipMessage(msg);
      setStage("failed");
      setError(actionable);
    },
  });

  async function preparePurchase() {
    await prepareMutation.mutateAsync().catch(() => {});
  }

  async function confirmPurchase() {
    if (!prepared) return;
    const frozenSnapshot = { ...prepared } as PreparedPurchase;
    setFrozen(frozenSnapshot);
    setStage("sponsoring");
    setError(null);
    // Do not store any assertion yet; hashes cleared until submission succeeds
    setUserOperationHash(null);
    setTransactionHash(null);
    setPassId(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      if (
        frozenSnapshot.priceAmountSubunits !== prepared.priceAmountSubunits ||
        frozenSnapshot.eventIdentifier !== prepared.eventIdentifier
      ) {
        throw new Error(
          "Purchase details changed. Prepare a new purchase review.",
        );
      }

      const balance = funds ?? (await readUsdcBalance());
      setFunds(balance);
      // cache balance for future reads
      queryClient.setQueryData(
        [
          "usdc-balance",
          props.chainId,
          props.usdcAddress,
          props.passkeyAccount.address,
        ],
        balance,
      );
      if (!canFundPurchase(balance, price)) {
        const needed = price - balance;
        throw new Error(buildAddUsdcMessage(needed > 0n ? needed : 0n));
      }

      if (props.fixtureMode) {
        await wait(50);
        setStage("signing");
        await wait(50);
        setStage("submitting");
        const mockUserOp = `0x${"b".repeat(64)}` as const;
        const mockTx = `0x${"c".repeat(64)}` as const;
        setUserOperationHash(mockUserOp);
        setTransactionHash(mockTx);
        persist({
          purchaseId: frozenSnapshot.purchaseId,
          userOperationHash: mockUserOp,
          transactionHash: mockTx,
          stage: "included",
          passId: "42",
        });
        setStage("included");
        await wait(50);
        setStage("reconciling");
        await submitForReconciliation(
          frozenSnapshot.purchaseId,
          mockUserOp,
          mockTx,
        );
        setStage("confirmed");
        setPassId("42");
        setShouldCelebrate(true);
        return;
      }

      const kernel = await reconstructKernelAccount(props.passkeyAccount);

      const calls = buildPurchaseBatchCalls({
        chainId: frozenSnapshot.chainId,
        contractAddress: frozenSnapshot.contractAddress as `0x${string}`,
        paymentAssetAddress:
          frozenSnapshot.paymentAssetAddress as `0x${string}`,
        eventIdentifier: frozenSnapshot.eventIdentifier as `0x${string}`,
        priceAmountSubunits: frozenSnapshot.priceAmountSubunits,
        buyerAddress: frozenSnapshot.buyerAddress as `0x${string}`,
        entryPointAddress: frozenSnapshot.entryPointAddress as
          `0x${string}` | undefined,
        expiresAt: frozenSnapshot.expiresAt,
      });
      const callData = encodePurchaseBatch(calls);

      validateSponsoredPurchaseBatch({
        callData,
        snapshot: {
          chainId: frozenSnapshot.chainId,
          contractAddress: frozenSnapshot.contractAddress as `0x${string}`,
          paymentAssetAddress:
            frozenSnapshot.paymentAssetAddress as `0x${string}`,
          eventIdentifier: frozenSnapshot.eventIdentifier as `0x${string}`,
          priceAmountSubunits: frozenSnapshot.priceAmountSubunits,
          buyerAddress: frozenSnapshot.buyerAddress as `0x${string}`,
          entryPointAddress: frozenSnapshot.entryPointAddress as
            `0x${string}` | undefined,
          expiresAt: frozenSnapshot.expiresAt,
        },
        sender: props.passkeyAccount.address,
        chainId: props.chainId,
        entryPointAddress: props.passkeyAccount.entryPointAddress,
        allowlist: {
          chainId: props.chainId,
          entryPointAddress: props.passkeyAccount.entryPointAddress,
          usdcAddress: props.usdcAddress,
          eventPassAddress: props.contractAddress,
        },
      });

      setStage("signing");

      const { userOperationHash: hash } =
        await prepareSignAndSubmitUserOperation({
          prepare: async () => {
            setStage("sponsoring");
            const res = await fetch("/api/wallet/user-operation/prepare", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ purchaseId: frozenSnapshot.purchaseId }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as {
                message?: string;
              };
              // Sponsorship rejection must be actionable and not consume purchase confirmation
              throw new Error(
                actionableSponsorshipMessage(
                  body.message ?? "Sponsorship rejected or simulation failed.",
                ),
              );
            }
            const preparedOp = await responseJson(
              res,
              prepareUserOperationResultSchema,
            );
            validateSponsoredPurchaseBatch({
              callData: preparedOp.operation.callData as `0x${string}`,
              snapshot: {
                chainId: frozenSnapshot.chainId,
                contractAddress:
                  frozenSnapshot.contractAddress as `0x${string}`,
                paymentAssetAddress:
                  frozenSnapshot.paymentAssetAddress as `0x${string}`,
                eventIdentifier:
                  frozenSnapshot.eventIdentifier as `0x${string}`,
                priceAmountSubunits: frozenSnapshot.priceAmountSubunits,
                buyerAddress: frozenSnapshot.buyerAddress as `0x${string}`,
                entryPointAddress: frozenSnapshot.entryPointAddress as
                  `0x${string}` | undefined,
                expiresAt: frozenSnapshot.expiresAt,
              },
              sender: props.passkeyAccount.address,
              chainId: props.chainId,
              entryPointAddress: props.passkeyAccount.entryPointAddress,
              allowlist: {
                chainId: props.chainId,
                entryPointAddress: props.passkeyAccount.entryPointAddress,
                usdcAddress: props.usdcAddress,
                eventPassAddress: props.contractAddress,
              },
            });
            setStage("signing");
            return preparedOp;
          },
          signUserOperation: op => kernel.signUserOperation(op as never),
          submit: async payload => {
            setStage("submitting");
            const res = await fetch("/api/wallet/user-operation/submit", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as {
                message?: string;
              };
              throw new Error(
                actionableSponsorshipMessage(
                  body.message ?? "Submission rejected.",
                ),
              );
            }
            const data = (await res.json()) as {
              userOperationHash: `0x${string}`;
            };
            setUserOperationHash(data.userOperationHash);
            persist({
              purchaseId: frozenSnapshot.purchaseId,
              userOperationHash: data.userOperationHash,
              stage: "submitted",
            });
            return data;
          },
        });

      setUserOperationHash(hash);
      setStage("submitted");

      // Bounded polling with backoff for bundler acceptance → inclusion
      let status: UserOperationStatusResult | null = null;
      try {
        status = await pollUserOperationInclusion(hash);
      } catch (e) {
        if (isWebAuthnCancellation(e)) throw e;
        const msg = e instanceof Error ? e.message : "Operation failed";
        if (/rejected|failed|reverted/i.test(msg)) {
          throw new Error(msg);
        }
        // dropped/unknown
        if (/timed out|unknown/i.test(msg)) {
          setStage("unknown");
          persist({
            purchaseId: frozenSnapshot.purchaseId,
            userOperationHash: hash,
            stage: "unknown",
          });
          throw new Error(msg);
        }
        throw e;
      }
      if (
        !status ||
        status.status !== "included" ||
        !("transactionHash" in status) ||
        !status.transactionHash
      ) {
        setStage("unknown");
        persist({
          purchaseId: frozenSnapshot.purchaseId,
          userOperationHash: hash,
          stage: "unknown",
        });
        throw new Error("Not completed — try again");
      }

      setTransactionHash(status.transactionHash as `0x${string}`);
      persist({
        purchaseId: frozenSnapshot.purchaseId,
        userOperationHash: hash,
        transactionHash: status.transactionHash,
        stage: "included",
      });
      setStage("included");

      setStage("reconciling");
      const reconciled = await submitForReconciliation(
        frozenSnapshot.purchaseId,
        hash,
        status.transactionHash as `0x${string}`,
      );
      if (reconciled?.pass) setPassId(reconciled.pass.passId);
      setStage("confirmed");
      setShouldCelebrate(true);
      persist({
        purchaseId: frozenSnapshot.purchaseId,
        userOperationHash: hash,
        transactionHash: status.transactionHash,
        stage: "confirmed",
        passId: reconciled?.pass?.passId ?? passId ?? undefined,
      });
    } catch (e) {
      if (isWebAuthnCancellation(e)) {
        void classifyPasskeyError(e);
        setStage("cancelled");
        setError("Not completed — try again");
        // Ensure no reusable assertion or false submission state is stored
        setUserOperationHash(null);
        setTransactionHash(null);
        // keep prepared intact for retry, do not persist submission
        return;
      }
      const msg = e instanceof Error ? e.message : "Purchase failed.";
      // Funds-related sponsorship denial maps to same Add USDC affordance (no jargon)
      if (
        isFundsRelatedMessage(msg) ||
        msg.startsWith("Add USDC to continue")
      ) {
        const deltaForError =
          funds !== null && price > funds ? price - funds : null;
        const fundsMessage =
          deltaForError !== null && deltaForError > 0n
            ? buildAddUsdcMessage(deltaForError)
            : msg.startsWith("Add USDC to continue")
              ? msg
              : "Add USDC to continue";
        setStage("rejected");
        setError(fundsMessage);
        return;
      }
      const isRejection =
        /rejected|sponsorship|allowlist|Wrong|expired|mismatch|simulation|paymaster|denied/i.test(
          msg,
        );
      const isExpiry = /expired/i.test(msg);
      const isDropped = /dropped/i.test(msg);
      const isUnknown = /unknown|timed out/i.test(msg);
      if (isUnknown) {
        setStage("unknown");
        setError("Not completed — try again");
      } else if (isDropped) {
        setStage("dropped");
        setError(msg);
      } else if (isExpiry) {
        setStage("expired");
        setError(msg);
      } else if (isRejection) {
        setStage("rejected");
        setError(msg);
      } else {
        setStage("failed");
        setError(msg);
      }
    }
  }

  async function submitForReconciliation(
    purchaseId: string,
    userOperationHash: `0x${string}`,
    transactionHash: `0x${string}`,
  ) {
    let accepted = false;
    for (let attempt = 0; attempt < 5 && !accepted; attempt++) {
      try {
        const res = await fetch(`/api/purchases/${purchaseId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userOperationHash, transactionHash }),
        });
        accepted = res.ok;
        if (!accepted && res.status < 500) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? "Reconciliation rejected.");
        }
      } catch (err) {
        if (attempt === 4) throw err;
        if (err instanceof Error && /rejected/i.test(err.message)) throw err;
      }
      if (!accepted) await wait(backoff(attempt, 1000, 8000));
    }
    if (!accepted) throw new Error("Not completed — try again");

    // Bounded polling/backoff for delayed receipt, then explicit unknown
    for (let attempt = 0; attempt < 20; attempt++) {
      if (abortRef.current?.signal.aborted)
        throw new DOMException("Polling stopped", "AbortError");
      const res = await fetch(`/api/purchases/${purchaseId}`);
      const status = await responseJson(res, purchaseStatusSchema);
      if (status.status === "confirmed") return status;
      if (status.status === "rejected")
        throw new Error(
          status.failure ?? "Purchase rejected during reconciliation.",
        );
      if (status.status === "expired" || status.status === "expiredOrDropped")
        throw new Error(status.failure ?? "Purchase preparation expired.");
      if (status.status === "dropped")
        throw new Error("Not completed — try again");
      if (status.status === "unknown")
        throw new Error("Not completed — try again");
      // included/synchronizing/submitted => continue
      await wait(backoff(attempt));
    }
    throw new Error("Not completed — try again");
  }

  async function handleRetry() {
    // Preserve idempotency: reuse same purchaseId and hashes, do not create second purchase; cannot create a second backend purchase, claim another UserOperation, or issue a duplicate Event Pass.
    const persisted = readPersisted(syncKey);
    const pid =
      persisted?.purchaseId ?? prepared?.purchaseId ?? frozen?.purchaseId;
    const uop = (persisted?.userOperationHash ?? userOperationHash) as
      `0x${string}` | null;
    const tx = (persisted?.transactionHash ?? transactionHash) as
      `0x${string}` | null;
    if (!pid) {
      // No prior purchase — re-prepare (idempotent via new idempotencyKey but backend ensures not duplicating pass)
      await preparePurchase();
      return;
    }
    if (uop && tx) {
      setStage("reconciling");
      setError(null);
      try {
        const reconciled = await submitForReconciliation(pid, uop, tx);
        if (reconciled?.pass) setPassId(reconciled.pass.passId);
        setStage("confirmed");
        setShouldCelebrate(true);
        persist({
          purchaseId: pid,
          userOperationHash: uop,
          transactionHash: tx,
          stage: "confirmed",
          passId: reconciled?.pass?.passId ?? passId ?? undefined,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Retry failed";
        if (/unknown/i.test(msg)) setStage("unknown");
        setError(msg);
      }
      return;
    }
    if (uop) {
      setStage("submitted");
      setError(null);
      try {
        const status = await pollUserOperationInclusion(uop);
        if (status && "transactionHash" in status && status.transactionHash) {
          const txHash = status.transactionHash as `0x${string}`;
          setTransactionHash(txHash);
          persist({
            purchaseId: pid,
            userOperationHash: uop,
            transactionHash: txHash,
            stage: "included",
          });
          setStage("reconciling");
          const reconciled = await submitForReconciliation(pid, uop, txHash);
          if (reconciled?.pass) setPassId(reconciled.pass.passId);
          setStage("confirmed");
          setShouldCelebrate(true);
          persist({
            purchaseId: pid,
            userOperationHash: uop,
            transactionHash: txHash,
            stage: "confirmed",
            passId: reconciled?.pass?.passId ?? passId ?? undefined,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Retry failed";
        if (/rejected|failed/i.test(msg)) {
          setStage("rejected");
          setError(msg);
        } else if (/unknown/i.test(msg)) {
          setStage("unknown");
          setError(msg);
        } else {
          setStage("failed");
          setError(msg);
        }
      }
      return;
    }
    // Sponsorship stage failed -> return to Review (prepared still valid until expiry)
    if (frozen) {
      setError(null);
      setStage("prepared");
    } else if (prepared) {
      setError(null);
      setStage("prepared");
    } else {
      await preparePurchase();
    }
  }

  const isInsufficient =
    funds !== null && !canFundPurchase(funds, price) && !props.fixtureMode;
  const delta = isInsufficient ? price - (funds ?? 0n) : 0n;
  const addUsdcMessage = isInsufficient
    ? buildAddUsdcMessage(delta)
    : "Add USDC to continue";
  const confirmDisabled = blocking || isInsufficient;
  const isFundsError =
    error != null &&
    (error.startsWith("Add USDC to continue") || isFundsRelatedMessage(error));

  // Fetch USDC balance when entering Review and funds still unknown (avoids hidden prompt)
  useEffect(() => {
    if (
      stage === "prepared" &&
      funds === null &&
      !props.fixtureMode &&
      !usdcBalanceMutation.isPending
    ) {
      void refreshFunds();
    }
  }, [stage, funds, props.fixtureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFaucet = async () => {
    try {
      await navigator.clipboard.writeText(props.passkeyAccount.address);
    } catch {
      // fallback for insecure context: hidden textarea copy
      try {
        const ta = document.createElement("textarea");
        ta.value = props.passkeyAccount.address;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    window.open("https://faucet.circle.com/", "_blank", "noopener,noreferrer");
  };

  const isConfirming =
    stage === "sponsoring" ||
    stage === "signing" ||
    stage === "submitting" ||
    stage === "submitted" ||
    stage === "included" ||
    stage === "reconciling";

  return (
    <div className="mt-6 space-y-4">
      {availabilityChecked && blocking && (
        <BiometricUnavailable onRetry={() => availabilityQuery.refetch()} />
      )}

      {stage === "idle" && !availabilityChecked && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Checking device...
        </p>
      )}

      {stage === "idle" && availabilityChecked && !blocking && (
        <button
          type="button"
          onClick={preparePurchase}
          disabled={prepareMutation.isPending}
          className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          Get Pass
        </button>
      )}

      {stage === "preparing" && (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin" /> Preparing
        </p>
      )}

      {stage === "prepared" && prepared && (
        <EventPassPurchaseReview
          eventName={props.eventName}
          priceAmountSubunits={prepared.priceAmountSubunits}
          confirmDisabled={confirmDisabled}
          onConfirm={confirmPurchase}
          onCancel={() => {
            setPrepared(null);
            setStage("idle");
          }}
          fundsWarning={
            isInsufficient ? (
              <div
                role="alert"
                className="rounded-xl border bg-amber-500/10 p-3 text-sm font-semibold"
              >
                <p>{addUsdcMessage}</p>
                <button
                  type="button"
                  onClick={handleFaucet}
                  className="mt-2 w-full rounded-xl border bg-background px-4 py-2 text-sm font-bold"
                >
                  Add USDC to continue
                </button>
              </div>
            ) : null
          }
        />
      )}

      {isConfirming && (
        <div aria-live="polite" className="rounded-2xl bg-muted p-4 text-sm">
          <p className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Confirming
          </p>
        </div>
      )}

      {stage === "confirmed" && (
        <>
          {/* Keep terse confirmed anchor for legacy coverage without showing hashes */}
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 font-bold text-emerald-700">
            <CheckCircle2 className="size-5" /> Confirmed
          </p>
          {shouldCelebrate ? (
            <SuccessDialog eventName={props.eventName} />
          ) : (
            <Link
              href="/my-passes"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
            >
              View passes
            </Link>
          )}
        </>
      )}

      {(stage === "failed" ||
        stage === "rejected" ||
        stage === "cancelled" ||
        stage === "expired" ||
        stage === "dropped" ||
        stage === "unknown") &&
        error &&
        isFundsError && (
          <p
            role="alert"
            className={`flex gap-2 rounded-xl p-3 text-sm font-semibold ${isFundsError ? "bg-amber-500/10 text-amber-900" : "bg-destructive/10 text-destructive"}`}
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      {error &&
        !isFundsError &&
        (stage === "failed" ||
          stage === "rejected" ||
          stage === "cancelled" ||
          stage === "expired" ||
          stage === "dropped" ||
          stage === "unknown") && (
          <EventPassPurchaseError onRetry={handleRetry} />
        )}

      {isFundsError &&
        (stage === "failed" ||
          stage === "rejected" ||
          stage === "unknown" ||
          stage === "dropped" ||
          stage === "expired") && (
          <button
            type="button"
            onClick={handleRetry}
            className="w-full rounded-xl border px-5 py-3 font-semibold"
          >
            Retry
          </button>
        )}
    </div>
  );
}
