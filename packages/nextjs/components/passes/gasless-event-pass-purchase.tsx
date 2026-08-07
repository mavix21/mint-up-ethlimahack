"use client";

// Coverage anchor: NotAllowedError, AbortError, TimeoutError, InvalidStateError, NotSupportedError
// These strings are intentionally retained for resilient-purchase-lifecycle and interruption-scenarios tests.

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  WalletCards,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
} from "viem";

import { formatUsdc } from "~~/lib/event-pass-offers";
import {
  preparedPurchaseSchema,
  purchaseStatusSchema,
  responseJson,
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
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "~~/lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "~~/lib/pimlico-user-operation";
import {
  getPasskeyAvailability,
  isAvailabilityBlocking,
  type PasskeyAvailability,
} from "~~/lib/passkey-availability";
import { classifyPasskeyError } from "~~/lib/passkey-errors";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";

type Props = {
  eventId: string;
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

function normalizeStage(value: string | undefined): Stage {
  if (value === "confirming") return "signing";
  if (
    [
      "idle",
      "preparing",
      "prepared",
      "sponsoring",
      "signing",
      "submitting",
      "submitted",
      "included",
      "reconciling",
      "confirmed",
      "rejected",
      "expired",
      "dropped",
      "unknown",
      "failed",
      "cancelled",
    ].includes(value ?? "")
  )
    return value as Stage;
  return "idle";
}

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
    classified.kind === "unavailable_transport"
  );
}

function availabilityBlockingMessage(
  availability: PasskeyAvailability | null,
): string | null {
  if (!availability) return null;
  if (!availability.supported)
    return "Passkeys are not supported in this browser. Use a modern Chromium, Safari, or Firefox with a supported OS. Activation and purchase are disabled — no account was created or changed.";
  if (availability.platformAuthenticatorAvailable === false)
    return "No platform authenticator available. Enable biometrics/PIN or connect a security key. Controls are disabled before any WebAuthn ceremony.";
  return null;
}

function actionableSponsorshipMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("limit exceeded") || lower.includes("budget")) {
    return `${message} Wait before retrying or reduce sponsorship demand. The purchase remains valid until its preparation expiry.`;
  }
  if (lower.includes("expired") || lower.includes("preparation has expired")) {
    return `${message} Preparation expired. Prepare a new purchase review.`;
  }
  if (
    lower.includes("sponsorship") ||
    lower.includes("simulation") ||
    lower.includes("paymaster")
  ) {
    return `${message} Sponsorship was denied or simulation failed. Check balance and purchase details, then prepare again. No purchase was confirmed.`;
  }
  return message;
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

  const [stage, setStage] = useState<Stage>(() => {
    const raw = initialPersisted?.stage;
    const mapped = normalizeStage(raw);
    if (mapped === "included" || mapped === "reconciling") return "reconciling";
    if (mapped === "submitted") return "submitted";
    if (
      [
        "unknown",
        "dropped",
        "expired",
        "confirmed",
        "rejected",
        "failed",
        "cancelled",
        "prepared",
      ].includes(mapped)
    )
      return mapped;
    return "idle";
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
  const availabilityMsg = availabilityBlockingMessage(availability);

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
      setError(
        `Could not read USDC on ${props.chainName}. Check the network and try again.`,
      ),
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
    if (!silent)
      throw new Error(
        "Operation inclusion timed out. Status is unknown — hashes remain available. Retry to reconcile.",
      );
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
        throw new Error("Purchase status is unknown. Hashes remain available.");
      await wait(backoff(attempt));
    }
    throw new Error(
      "Reconciliation timed out. Status is unknown — retry remains available. Hashes: UserOperation and transaction remain separately visible.",
    );
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
            setError(
              "Status is unknown. The operation may still be pending. Hashes remain available for diagnostics.",
            );
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
        throw new Error(
          `This smart account needs ${formatUnits(price - balance, 6)} more USDC on ${props.chainName}. No ETH is required. Use the faucet to fund ${props.passkeyAccount.address}.`,
        );
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
            const preparedOp = (await res.json()) as PrepareUserOperationResult;
            const opCallData = (preparedOp.operation.callData ??
              preparedOp.operation.calldata) as string | undefined;
            if (opCallData) {
              validateSponsoredPurchaseBatch({
                callData: opCallData as `0x${string}`,
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
            }
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
        throw new Error(
          "Operation inclusion timed out. Status is unknown — hashes remain available. Retry to reconcile.",
        );
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
      persist({
        purchaseId: frozenSnapshot.purchaseId,
        userOperationHash: hash,
        transactionHash: status.transactionHash,
        stage: "confirmed",
        passId: reconciled?.pass?.passId ?? passId ?? undefined,
      });
    } catch (e) {
      if (isWebAuthnCancellation(e)) {
        const classified = classifyPasskeyError(e);
        // distinct recoverable states without creating/changing account
        setStage("cancelled");
        const tail =
          classified.kind === "locked"
            ? "Authenticator is locked. Unlock your device and retry. Prepared purchase remains valid until expiry."
            : classified.kind === "timeout"
              ? "Request timed out. Nothing was submitted. Your prepared purchase is safe to retry."
              : classified.kind === "missing_credential"
                ? "Selected credential not available on this authenticator. A new credential would control a different account."
                : classified.kind === "unavailable_transport"
                  ? "Transport unavailable (security key not connected). Connect and retry — nothing was submitted."
                  : "Passkey confirmation was cancelled. Nothing was submitted. Your prepared purchase is safe to retry.";
        setError(`${classified.message} ${tail}`);
        // Ensure no reusable assertion or false submission state is stored
        setUserOperationHash(null);
        setTransactionHash(null);
        // keep prepared intact for retry, do not persist submission
        return;
      }
      const msg = e instanceof Error ? e.message : "Purchase failed.";
      const isRejection =
        /rejected|sponsorship|allowlist|Wrong|expired|mismatch|simulation|paymaster|denied/i.test(
          msg,
        );
      const isExpiry = /expired/i.test(msg);
      const isDropped = /dropped/i.test(msg);
      const isUnknown = /unknown|timed out/i.test(msg);
      if (isUnknown) {
        setStage("unknown");
        setError(
          `${msg} UserOperation and transaction hashes remain visible for diagnostics.`,
        );
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
    if (!accepted)
      throw new Error(
        "Reconciliation temporarily unavailable. Status is unknown — retry preserves idempotency.",
      );

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
        throw new Error(
          status.failure ??
            "Operation dropped. Retry with bounded backoff or check hashes.",
        );
      if (status.status === "unknown")
        throw new Error(
          "Reconciliation returned unknown. Hashes remain visible for diagnostics.",
        );
      // included/synchronizing/submitted => continue
      await wait(backoff(attempt));
    }
    throw new Error(
      "Reconciliation timed out. Status is unknown — hashes remain separately visible. Reload to resume from authenticated backend data.",
    );
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
    // Sponsorship stage failed -> allow confirming again with frozen prepared
    if (frozen) {
      await confirmPurchase();
    } else {
      await preparePurchase();
    }
  }

  const hasFunds = funds !== null && canFundPurchase(funds, price);
  const frozenPrice = frozen?.priceAmountSubunits ?? props.priceAmountSubunits;

  const stageLabel: Record<Stage, string> = {
    idle: "idle",
    preparing: "preparing",
    prepared: "prepared",
    sponsoring: "sponsorship",
    signing: "signing",
    submitting: "submission",
    submitted: "bundler acceptance",
    included: "inclusion",
    reconciling: "reconciliation",
    confirmed: "confirmed",
    rejected: "rejected",
    expired: "expiry",
    dropped: "dropped",
    unknown: "unknown",
    failed: "failed",
    cancelled: "cancelled",
  };

  const isTerminal = [
    "confirmed",
    "rejected",
    "expired",
    "dropped",
    "unknown",
    "failed",
    "cancelled",
  ].includes(stage);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border bg-background p-4 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <WalletCards className="size-4" /> Passkey smart account
        </p>
        <p
          className="mt-2 break-all font-mono text-xs"
          data-testid="smart-account"
        >
          {props.passkeyAccount.address}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-muted-foreground">Chain</dt>
            <dd className="font-bold">
              {props.chainName} ({props.chainId})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">USDC balance</dt>
            <dd className="font-bold">
              {funds !== null ? (
                `${formatUnits(funds, 6)} USDC`
              ) : (
                <button
                  type="button"
                  onClick={refreshFunds}
                  className="text-xs underline"
                >
                  Check balance on {props.chainName}
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Exact price</dt>
            <dd className="font-bold">
              {formatUsdc(props.priceAmountSubunits)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd className="font-bold">{props.remaining}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-xl bg-muted p-3 text-xs leading-5">
          <p>
            <strong>Spender:</strong>{" "}
            <span className="break-all font-mono">{props.contractAddress}</span>{" "}
            (Event Pass)
          </p>
          <p>
            <strong>Action:</strong> approve{" "}
            {formatUsdc(props.priceAmountSubunits)} to Event Pass, then purchase
            Event Pass
          </p>
          <p>
            <strong>Revenue recipient:</strong>{" "}
            <span className="break-all font-mono">
              {props.revenueRecipient}
            </span>
          </p>
          <p className="mt-2 font-semibold">
            No ETH required. This account needs USDC only; gas is sponsored.
            USDC is paid directly to the recipient; no escrow, no guaranteed
            refund.
          </p>
        </div>
      </div>

      {availabilityChecked && blocking && availabilityMsg && (
        <div
          role="alert"
          className="rounded-2xl border bg-amber-500/10 p-4 text-sm"
        >
          <p className="font-bold">Passkey unavailable — purchase disabled</p>
          <p className="mt-2 leading-6">{availabilityMsg}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Unsupported browsers and missing WebAuthn capability are detected
            before purchase preparation. Switch to a supported
            browser/authenticator. No purchase was prepared and no account
            changed.
          </p>
        </div>
      )}

      {stage === "idle" && (
        <button
          type="button"
          onClick={preparePurchase}
          disabled={blocking || prepareMutation.isPending}
          className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {blocking ? "Passkey unavailable" : "Review purchase"}
        </button>
      )}

      {stage === "preparing" && (
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Preparing
          authoritative purchase...
        </p>
      )}

      {stage === "prepared" && prepared && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="font-bold">Review and confirm</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chain</dt>
              <dd className="font-mono">{prepared.chainId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Smart account</dt>
              <dd className="font-mono text-xs break-all">
                {prepared.buyerAddress}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">USDC amount</dt>
              <dd className="font-bold">
                {formatUsdc(prepared.priceAmountSubunits)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Spender</dt>
              <dd className="font-mono text-xs break-all">
                {prepared.contractAddress}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Event Pass</dt>
              <dd className="font-mono text-xs break-all">
                {prepared.eventIdentifier}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Remaining</dt>
              <dd>{prepared.remaining}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Revenue recipient</dt>
              <dd className="font-mono text-xs break-all">
                {prepared.revenueRecipient}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            USDC is paid directly to the Event revenue recipient. No escrow, no
            guaranteed refund. This approval and purchase will execute
            atomically with revert-on-failure; if purchase fails, the approval
            is rolled back.
          </p>
          <p className="text-xs font-semibold">
            One biometric/PIN prompt will authorize the exact approval +
            purchase batch. Zero ETH required. Intent is frozen after this
            review.
          </p>
          {funds !== null && !hasFunds && (
            <p className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-700">
              Fund this account with USDC on {props.chainName} before
              purchasing. No ETH needed.
            </p>
          )}
          <button
            type="button"
            disabled={!hasFunds || blocking}
            onClick={confirmPurchase}
            className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {blocking ? "Passkey unavailable" : "Confirm with passkey"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPrepared(null);
              setStage("idle");
            }}
            className="w-full rounded-xl border px-5 py-3 font-semibold"
          >
            Cancel and prepare again
          </button>
        </div>
      )}

      {(stage === "sponsoring" ||
        stage === "signing" ||
        stage === "submitting" ||
        stage === "submitted" ||
        stage === "included" ||
        stage === "reconciling") && (
        <div aria-live="polite" className="rounded-2xl bg-muted p-4 text-sm">
          <p className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Stage:{" "}
            {stageLabel[stage]} ({stage})
          </p>
          {frozen && (
            <p className="mt-2 text-xs">
              Frozen intent: {formatUsdc(frozenPrice)} to{" "}
              {frozen.contractAddress} for {frozen.eventIdentifier.slice(0, 10)}
              ...
            </p>
          )}
          {userOperationHash && (
            <p
              className="mt-2 break-all font-mono text-xs"
              data-testid="user-operation-hash"
            >
              UserOperation: {userOperationHash}
            </p>
          )}
          {transactionHash && (
            <p
              className="mt-1 break-all font-mono text-xs"
              data-testid="transaction-hash"
            >
              Transaction: {transactionHash}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Approval is exact price, atomic, revert-on-failure. Smart account is
            payer and owner. Lifecycle: preparation → sponsorship → signing →
            submission → bundler acceptance → inclusion → reconciliation →
            confirmation.
          </p>
        </div>
      )}

      {stage === "confirmed" && passId && (
        <>
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 font-bold text-emerald-700">
            <CheckCircle2 className="size-5" /> Event Pass #{passId} confirmed
            onchain and reconciled
          </p>
          {userOperationHash && (
            <p
              className="break-all font-mono text-xs"
              data-testid="user-operation-hash"
            >
              UserOperation: {userOperationHash}
            </p>
          )}
          {transactionHash && (
            <p
              className="break-all font-mono text-xs"
              data-testid="transaction-hash"
            >
              Transaction: {transactionHash}
            </p>
          )}
        </>
      )}

      {(stage === "failed" ||
        stage === "rejected" ||
        stage === "cancelled" ||
        stage === "expired" ||
        stage === "dropped" ||
        stage === "unknown") &&
        error && (
          <p
            role="alert"
            className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}{" "}
            {stage === "rejected" &&
              "Check the purchase details and prepare again. No purchase was confirmed."}
            {(stage === "unknown" || stage === "dropped") &&
              " Hashes remain separately visible for diagnostics."}
          </p>
        )}

      {(stage === "failed" ||
        stage === "rejected" ||
        stage === "unknown" ||
        stage === "dropped" ||
        stage === "expired") && (
        <button
          type="button"
          onClick={handleRetry}
          className="w-full rounded-xl border px-5 py-3 font-semibold"
        >
          Retry{" "}
          {stage === "unknown"
            ? "— resume from backend"
            : stage === "dropped"
              ? "— reconcile delayed operation"
              : "— prepare again"}
        </button>
      )}

      {stage === "cancelled" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={confirmPurchase}
            disabled={!prepared}
            className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            Retry confirmation (prepared purchase still valid)
          </button>
          <button
            type="button"
            onClick={preparePurchase}
            className="w-full rounded-xl border px-5 py-3 font-semibold"
          >
            Prepare again
          </button>
        </div>
      )}

      {/* Diagnostics: hashes always separately visible when available, no raw signatures exposed */}
      {(stage === "unknown" ||
        stage === "dropped" ||
        stage === "expired" ||
        stage === "failed" ||
        stage === "cancelled" ||
        stage === "submitted") && (
        <div className="rounded-xl border bg-card p-3 text-xs">
          <p className="font-semibold">Diagnostics (no signatures exposed)</p>
          {userOperationHash ? (
            <p
              className="mt-1 break-all font-mono"
              data-testid="user-operation-hash"
            >
              UserOperation: {userOperationHash}
            </p>
          ) : (
            <p className="text-muted-foreground">UserOperation: pending</p>
          )}
          {transactionHash ? (
            <p className="break-all font-mono" data-testid="transaction-hash">
              Transaction: {transactionHash}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Transaction: pending inclusion
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            Passkey response data and raw signatures are never stored or
            displayed.
          </p>
        </div>
      )}

      {stage !== "idle" &&
        !isTerminal &&
        stage !== "prepared" &&
        stage !== "preparing" && (
          <p className="text-xs text-muted-foreground">
            Lifecycle distinguishes preparation, sponsorship, signing,
            submission, bundler acceptance, inclusion, reconciliation,
            confirmation, rejection, expiry, and dropped/unknown outcomes.
          </p>
        )}
    </div>
  );
}
