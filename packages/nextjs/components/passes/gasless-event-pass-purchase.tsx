"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  WalletCards,
} from "lucide-react";
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
  fixtureMode?: boolean;
};

type Stage =
  | "idle"
  | "preparing"
  | "prepared"
  | "sponsoring"
  | "confirming"
  | "submitting"
  | "included"
  | "reconciling"
  | "confirmed"
  | "rejected"
  | "failed"
  | "cancelled";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function GaslessEventPassPurchase(props: Props) {
  const chain =
    props.chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
  const rpcUrl = chain.rpcUrls.default.http[0];
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const price = BigInt(props.priceAmountSubunits);

  const [funds, setFunds] = useState<bigint | null>(
    props.fixtureMode ? price * 2n : null,
  );
  const [prepared, setPrepared] = useState<PreparedPurchase | null>(null);
  const [frozen, setFrozen] = useState<PreparedPurchase | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [userOperationHash, setUserOperationHash] = useState<
    `0x${string}` | null
  >(null);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(
    null,
  );
  const [passId, setPassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncKey = `mint-up:gasless-purchase:${props.eventId}:${props.passkeyAccount.address.toLowerCase()}`;

  async function readUsdcBalance() {
    return (await publicClient.readContract({
      address: props.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [props.passkeyAccount.address],
    })) as bigint;
  }

  const loadFunds = useEffectEvent(() => readUsdcBalance());

  useEffect(() => {
    if (props.fixtureMode) return;
    let active = true;
    loadFunds()
      .then(v => {
        if (active) setFunds(v);
      })
      .catch(() => {
        if (active) setError(`Could not read USDC on ${props.chainName}.`);
      });
    return () => {
      active = false;
    };
  }, [props.chainId, props.usdcAddress, props.passkeyAccount.address]);

  // resume from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(syncKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        purchaseId?: string;
        userOperationHash?: string;
        transactionHash?: string;
        stage?: Stage;
        passId?: string;
      };
      if (data.userOperationHash)
        setUserOperationHash(data.userOperationHash as `0x${string}`);
      if (data.transactionHash)
        setTransactionHash(data.transactionHash as `0x${string}`);
      if (data.passId) setPassId(data.passId);
      if (data.stage === "included" || data.stage === "reconciling")
        setStage("reconciling");
    } catch {
      localStorage.removeItem(syncKey);
    }
  }, [syncKey]);

  async function preparePurchase() {
    setStage("preparing");
    setError(null);
    try {
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
      // authoritative checks
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
      setPrepared(preparedPurchase);
      setStage("prepared");
    } catch (e) {
      setStage("failed");
      setError(e instanceof Error ? e.message : "Could not prepare purchase.");
    }
  }

  async function confirmPurchase() {
    if (!prepared) return;
    const frozenSnapshot = { ...prepared } as PreparedPurchase;
    setFrozen(frozenSnapshot);
    setStage("sponsoring");
    setError(null);
    setUserOperationHash(null);
    setTransactionHash(null);
    setPassId(null);

    try {
      // frozen intent guard: snapshot must equal prepared at this moment
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
      if (!canFundPurchase(balance, price)) {
        throw new Error(
          `This smart account needs ${formatUnits(price - balance, 6)} more USDC on ${props.chainName}. No ETH is required. Use the faucet to fund ${props.passkeyAccount.address}.`,
        );
      }

      if (props.fixtureMode) {
        await wait(50);
        setStage("confirming");
        await wait(50);
        setStage("submitting");
        const mockUserOp = `0x${"b".repeat(64)}` as const;
        const mockTx = `0x${"c".repeat(64)}` as const;
        setUserOperationHash(mockUserOp);
        setTransactionHash(mockTx);
        localStorage.setItem(
          syncKey,
          JSON.stringify({
            purchaseId: frozenSnapshot.purchaseId,
            userOperationHash: mockUserOp,
            transactionHash: mockTx,
            stage: "included",
            passId: "42",
          }),
        );
        setStage("included");
        await wait(50);
        setStage("reconciling");
        // submit for reconciliation
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

      // Build and validate batch before sponsorship
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

      // sponsorship boundary validation (client-side simulation)
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

      setStage("confirming");

      const { userOperationHash: hash } =
        await prepareSignAndSubmitUserOperation({
          prepare: async () => {
            const res = await fetch("/api/wallet/user-operation/prepare", {
              method: "POST",
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as {
                message?: string;
              };
              throw new Error(body.message ?? "Sponsorship rejected.");
            }
            const preparedOp = (await res.json()) as PrepareUserOperationResult;
            // sponsorship must happen before signing: freeze intent and validate returned operation
            const opCallData = (preparedOp.operation.callData ??
              preparedOp.operation.calldata) as string | undefined;
            if (opCallData) {
              // ensure sponsored operation matches frozen intent
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
              throw new Error(body.message ?? "Submission rejected.");
            }
            const data = (await res.json()) as {
              userOperationHash: `0x${string}`;
            };
            setUserOperationHash(data.userOperationHash);
            localStorage.setItem(
              syncKey,
              JSON.stringify({
                purchaseId: frozenSnapshot.purchaseId,
                userOperationHash: data.userOperationHash,
                stage: "submitted",
              }),
            );
            return data;
          },
        });

      setUserOperationHash(hash);
      setStage("included");

      // poll inclusion
      let status: UserOperationStatusResult | null = null;
      for (let attempt = 0; attempt < 60; attempt++) {
        const res = await fetch("/api/wallet/user-operation/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userOperationHash: hash }),
        });
        if (!res.ok) {
          await wait(2000);
          continue;
        }
        status = (await res.json()) as UserOperationStatusResult;
        if (status.status === "included" && status.transactionHash) {
          setTransactionHash(status.transactionHash as `0x${string}`);
          localStorage.setItem(
            syncKey,
            JSON.stringify({
              purchaseId: frozenSnapshot.purchaseId,
              userOperationHash: hash,
              transactionHash: status.transactionHash,
              stage: "included",
            }),
          );
          break;
        }
        if (
          status.status === "rejected" ||
          status.status === "failed" ||
          status.status === "reverted"
        ) {
          throw new Error(status.message ?? "Operation rejected by bundler.");
        }
        await wait(2000);
      }
      if (
        !status ||
        status.status !== "included" ||
        !("transactionHash" in status) ||
        !status.transactionHash
      ) {
        throw new Error("Operation inclusion timed out.");
      }

      setStage("reconciling");
      const reconciled = await submitForReconciliation(
        frozenSnapshot.purchaseId,
        hash,
        status.transactionHash as `0x${string}`,
      );
      if (reconciled?.pass) setPassId(reconciled.pass.passId);
      setStage("confirmed");
      localStorage.setItem(
        syncKey,
        JSON.stringify({
          purchaseId: frozenSnapshot.purchaseId,
          userOperationHash: hash,
          transactionHash: status.transactionHash,
          stage: "confirmed",
          passId: reconciled?.pass?.passId ?? passId,
        }),
      );
    } catch (e) {
      if (e instanceof Error && e.name === "NotAllowedError") {
        setStage("cancelled");
        setError("Passkey confirmation was cancelled. Nothing was submitted.");
        return;
      }
      const msg = e instanceof Error ? e.message : "Purchase failed.";
      const isRejection =
        /rejected|sponsorship|allowlist|Wrong|expired|mismatch/i.test(msg);
      setStage(isRejection ? "rejected" : "failed");
      setError(msg);
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
      }
      if (!accepted) await wait(1000 * 2 ** attempt);
    }
    if (!accepted) throw new Error("Reconciliation temporarily unavailable.");

    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await fetch(`/api/purchases/${purchaseId}`);
      const status = await responseJson(res, purchaseStatusSchema);
      if (status.status === "confirmed") return status;
      if (status.status === "rejected")
        throw new Error(
          status.failure ?? "Purchase rejected during reconciliation.",
        );
      await wait(2000);
    }
    throw new Error("Reconciliation timed out. Reload to resume.");
  }

  const hasFunds = funds !== null && canFundPurchase(funds, price);
  const frozenPrice = frozen?.priceAmountSubunits ?? props.priceAmountSubunits;

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
              {funds !== null ? `${formatUnits(funds, 6)} USDC` : "Checking..."}
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

      {stage === "idle" && (
        <button
          type="button"
          onClick={preparePurchase}
          className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
        >
          Review purchase
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
            disabled={!hasFunds}
            onClick={confirmPurchase}
            className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            Confirm with passkey
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
        stage === "confirming" ||
        stage === "submitting" ||
        stage === "included" ||
        stage === "reconciling") && (
        <div aria-live="polite" className="rounded-2xl bg-muted p-4 text-sm">
          <p className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Stage: {stage}
          </p>
          {frozen && (
            <p className="mt-2 text-xs">
              Frozen intent: {formatUsdc(frozenPrice)} to{" "}
              {frozen.contractAddress} for {frozen.eventIdentifier.slice(0, 10)}
              ...
            </p>
          )}
          {userOperationHash && (
            <p className="mt-2 break-all font-mono text-xs">
              UserOperation: {userOperationHash}
            </p>
          )}
          {transactionHash && (
            <p className="mt-1 break-all font-mono text-xs">
              Transaction: {transactionHash}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Approval is exact price, atomic, revert-on-failure. Smart account is
            payer and owner.
          </p>
        </div>
      )}

      {stage === "confirmed" && passId && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 font-bold text-emerald-700">
          <CheckCircle2 className="size-5" /> Event Pass #{passId} confirmed
          onchain and reconciled
        </p>
      )}

      {(stage === "failed" || stage === "rejected" || stage === "cancelled") &&
        error && (
          <p
            role="alert"
            className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}{" "}
            {stage === "rejected" &&
              "Check the purchase details and prepare again."}
          </p>
        )}

      {stage === "failed" && (
        <button
          type="button"
          onClick={preparePurchase}
          className="w-full rounded-xl border px-5 py-3 font-semibold"
        >
          Prepare again
        </button>
      )}
    </div>
  );
}
