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

import type { PurchaseStatus } from "~~/lib/event-pass-purchase-api";
import type { OpenfortBrowserConfig } from "~~/lib/openfort-browser-config";
import {
  responseJson,
  preparedPurchaseSchema,
  purchaseStatusSchema,
} from "~~/lib/event-pass-purchase-api";
import {
  approvalRequired,
  assertApprovalConfirmed,
  canFundPurchase,
  eventPassPurchaseAbi,
  purchasedPassFromReceipt,
} from "~~/lib/event-pass-transactions";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";

type Outcome =
  "not-needed" | "idle" | "pending" | "replaced" | "confirmed" | "failed";
type Funds = { balance: bigint; allowance: bigint };
type PendingSynchronization = {
  purchaseId: string;
  transactionHash: `0x${string}`;
  passId?: string;
};

type Props = {
  eventId: string;
  walletAddress: `0x${string}`;
  chainId: 412346 | 421614;
  chainName: string;
  contractAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  priceAmountSubunits: string;
  remaining: number;
  revenueRecipient: `0x${string}`;
  openfort: OpenfortBrowserConfig | null;
  fixtureMode?: boolean;
};

const wait = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

function outcomeLabel(name: string, outcome: Outcome) {
  if (outcome === "idle") return `${name}: ready`;
  if (outcome === "not-needed") return `${name}: not needed`;
  return `${name}: ${outcome}`;
}

export function EventPassPurchase(props: Props) {
  const chain =
    props.chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
  const rpcUrl = chain.rpcUrls.default.http[0];
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const price = BigInt(props.priceAmountSubunits);
  const [funds, setFunds] = useState<Funds | null>(
    props.fixtureMode ? { balance: price * 2n, allowance: 0n } : null,
  );
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [approval, setApproval] = useState<Outcome>("idle");
  const [purchase, setPurchase] = useState<Outcome>("idle");
  const [approvalWasReplaced, setApprovalWasReplaced] = useState(false);
  const [purchaseWasReplaced, setPurchaseWasReplaced] = useState(false);
  const [sync, setSync] = useState<PurchaseStatus | null>(null);
  const [passId, setPassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const synchronizationKey = `mint-up:purchase-sync:${props.eventId}:${props.walletAddress.toLowerCase()}`;

  async function readFunds(
    owner = props.walletAddress,
    token = props.usdcAddress,
    spender = props.contractAddress,
  ) {
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      }),
    ]);
    return { balance, allowance };
  }

  const loadFunds = useEffectEvent(() => readFunds());

  useEffect(() => {
    if (props.fixtureMode) return;
    let active = true;
    loadFunds()
      .then(value => {
        if (active) setFunds(value);
      })
      .catch(() => {
        if (active) {
          setFundsError(
            `Could not read USDC on ${props.chainName}. Check the network and retry.`,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [
    props.chainId,
    props.chainName,
    props.contractAddress,
    props.fixtureMode,
    props.usdcAddress,
    props.walletAddress,
  ]);

  const resumeSynchronization = useEffectEvent(
    async (pending: PendingSynchronization) => {
      setBusy(true);
      setPurchase(pending.passId ? "confirmed" : "pending");
      setPassId(pending.passId ?? null);
      try {
        const status = await submitForSynchronization(
          pending.purchaseId,
          pending.transactionHash,
        );
        if (status?.status === "confirmed" && status.pass) {
          setPurchase("confirmed");
          setPassId(status.pass.passId);
        }
      } catch {
        setError(
          "Your Event Pass is confirmed onchain. Keep this page open or reload to retry Mint Up synchronization.",
        );
      } finally {
        setBusy(false);
      }
    },
  );

  useEffect(() => {
    const value = localStorage.getItem(synchronizationKey);
    if (!value) return;
    try {
      const pending = JSON.parse(value) as Partial<PendingSynchronization>;
      if (
        typeof pending.purchaseId === "string" &&
        (pending.passId === undefined || typeof pending.passId === "string") &&
        typeof pending.transactionHash === "string" &&
        /^0x[0-9a-fA-F]{64}$/.test(pending.transactionHash)
      ) {
        void resumeSynchronization(pending as PendingSynchronization);
      } else {
        localStorage.removeItem(synchronizationKey);
      }
    } catch {
      localStorage.removeItem(synchronizationKey);
    }
  }, [synchronizationKey]);

  async function preparePurchase() {
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: props.eventId,
        buyerAddress: props.walletAddress,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const prepared = await responseJson(response, preparedPurchaseSchema);
    const mismatches = [
      prepared.chainId !== props.chainId ? "network" : null,
      getAddress(prepared.buyerAddress) !== getAddress(props.walletAddress)
        ? "buyer"
        : null,
      getAddress(prepared.contractAddress) !== getAddress(props.contractAddress)
        ? "contract"
        : null,
      getAddress(prepared.paymentAssetAddress) !== getAddress(props.usdcAddress)
        ? "payment asset"
        : null,
      getAddress(prepared.revenueRecipient) !==
      getAddress(props.revenueRecipient)
        ? "recipient"
        : null,
      prepared.priceAmountSubunits !== props.priceAmountSubunits
        ? "price"
        : null,
    ].filter(value => value !== null);
    if (mismatches.length > 0) {
      throw new Error(
        `The prepared purchase has a different ${mismatches.join(
          ", ",
        )}. Refresh and try again.`,
      );
    }
    return prepared;
  }

  async function submitForSynchronization(
    purchaseId: string,
    transactionHash: `0x${string}`,
  ) {
    let accepted = false;
    for (let attempt = 0; attempt < 5 && !accepted; attempt += 1) {
      try {
        const response = await fetch(`/api/purchases/${purchaseId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactionHash }),
        });
        accepted = response.ok;
        if (!accepted && response.status < 500) {
          const value = (await response.json()) as { message?: string };
          throw new Error(
            value.message ?? "Backend synchronization could not start.",
          );
        }
      } catch (cause) {
        if (attempt === 4) throw cause;
      }
      if (!accepted) await wait(1_000 * 2 ** attempt);
    }
    if (!accepted) {
      throw new Error("Backend synchronization is temporarily unavailable.");
    }
    setSync({ status: "synchronizing", transactionHash });
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const statusResponse = await fetch(`/api/purchases/${purchaseId}`);
      const status = await responseJson(statusResponse, purchaseStatusSchema);
      setSync(status);
      if (status.status === "confirmed" || status.status === "rejected") {
        localStorage.removeItem(synchronizationKey);
        return status;
      }
      await wait(2_000);
    }
    return null;
  }

  async function confirm() {
    if (!props.openfort || busy) return;
    setBusy(true);
    setError(null);
    setSync(null);
    setPassId(null);
    setApproval("idle");
    setPurchase("idle");
    setApprovalWasReplaced(false);
    setPurchaseWasReplaced(false);
    let activeTransaction: "approval" | "purchase" | null = null;
    try {
      const prepared = await preparePurchase();
      if (props.fixtureMode) {
        setApproval("pending");
        await wait(50);
        setApproval("confirmed");
        setPurchase("pending");
        await wait(50);
        setPurchase("confirmed");
        setPassId("42");
        const transactionHash = `0x${"a".repeat(64)}` as const;
        localStorage.setItem(
          synchronizationKey,
          JSON.stringify({
            purchaseId: prepared.purchaseId,
            transactionHash,
            passId: "42",
          }),
        );
        await submitForSynchronization(prepared.purchaseId, transactionHash);
        return;
      }
      const currentFunds = await readFunds(
        getAddress(prepared.buyerAddress) as `0x${string}`,
        getAddress(prepared.paymentAssetAddress) as `0x${string}`,
        getAddress(prepared.contractAddress) as `0x${string}`,
      );
      setFunds(currentFunds);
      if (!canFundPurchase(currentFunds.balance, price)) {
        throw new Error(
          `This embedded wallet needs ${formatUnits(price - currentFunds.balance, 6)} more USDC on ${props.chainName}.`,
        );
      }

      const { createEmbeddedWalletClient } =
        await import("~~/lib/embedded-wallet-client");
      const walletClient = await createEmbeddedWalletClient({
        address: props.walletAddress,
        chain,
        rpcUrl,
        config: props.openfort,
      });
      if (approvalRequired(currentFunds.allowance, price)) {
        activeTransaction = "approval";
        setApproval("pending");
        const approvalHash = await walletClient.writeContract({
          address: getAddress(prepared.paymentAssetAddress),
          abi: erc20Abi,
          functionName: "approve",
          args: [getAddress(prepared.contractAddress), price],
        });
        let approvalCancelled = false;
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
          onReplaced: replacement => {
            if (replacement.reason === "cancelled") {
              approvalCancelled = true;
              setApproval("failed");
            } else {
              setApprovalWasReplaced(true);
              setApproval("replaced");
            }
          },
        });
        const allowance = await publicClient.readContract({
          address: getAddress(prepared.paymentAssetAddress),
          abi: erc20Abi,
          functionName: "allowance",
          args: [
            getAddress(prepared.buyerAddress),
            getAddress(prepared.contractAddress),
          ],
        });
        assertApprovalConfirmed({
          receiptStatus: approvalReceipt.status,
          cancelled: approvalCancelled,
          allowance,
          price,
        });
        setFunds(current => (current ? { ...current, allowance } : current));
        setApproval("confirmed");
        activeTransaction = null;
      } else {
        setApproval("not-needed");
      }

      activeTransaction = "purchase";
      setPurchase("pending");
      const purchaseHash = await walletClient.writeContract({
        address: getAddress(prepared.contractAddress),
        abi: eventPassPurchaseAbi,
        functionName: "purchase",
        args: [prepared.eventIdentifier as `0x${string}`],
      });
      localStorage.setItem(
        synchronizationKey,
        JSON.stringify({
          purchaseId: prepared.purchaseId,
          transactionHash: purchaseHash,
        }),
      );
      void submitForSynchronization(prepared.purchaseId, purchaseHash).catch(
        () => null,
      );
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: purchaseHash,
        onReplaced: replacement => {
          if (replacement.reason === "cancelled") {
            setPurchase("failed");
          } else {
            const replacementHash =
              replacement.transactionReceipt.transactionHash;
            setPurchaseWasReplaced(true);
            setPurchase("replaced");
            localStorage.setItem(
              synchronizationKey,
              JSON.stringify({
                purchaseId: prepared.purchaseId,
                transactionHash: replacementHash,
              }),
            );
            void submitForSynchronization(
              prepared.purchaseId,
              replacementHash,
            ).catch(() => null);
          }
        },
      });
      const issued = purchasedPassFromReceipt(
        receipt,
        getAddress(prepared.contractAddress) as `0x${string}`,
        prepared.eventIdentifier as `0x${string}`,
        getAddress(prepared.buyerAddress) as `0x${string}`,
      );
      setPassId(issued.passId);
      setPurchase("confirmed");
      activeTransaction = null;
      localStorage.setItem(
        synchronizationKey,
        JSON.stringify({
          purchaseId: prepared.purchaseId,
          transactionHash: issued.transactionHash,
          passId: issued.passId,
        }),
      );
      const status = await submitForSynchronization(
        prepared.purchaseId,
        issued.transactionHash,
      );
      if (status?.status === "rejected") {
        setError(
          status.failure ??
            "The chain transaction confirmed, but Mint Up could not verify it.",
        );
      }
    } catch (cause) {
      if (activeTransaction === "purchase") setPurchase("failed");
      if (activeTransaction === "approval") setApproval("failed");
      setError(
        cause instanceof Error
          ? cause.message
          : "The purchase could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const hasFunds = funds ? canFundPurchase(funds.balance, price) : false;
  const configReady = props.openfort !== null;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border bg-background p-4 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <WalletCards className="size-4" /> Selected embedded wallet
        </p>
        <p className="mt-2 break-all font-mono text-xs">
          {props.walletAddress}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-muted-foreground">USDC balance</dt>
            <dd className="font-bold">
              {funds ? `${formatUnits(funds.balance, 6)} USDC` : "Checking..."}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining now</dt>
            <dd className="font-bold">{props.remaining}</dd>
          </div>
        </dl>
      </div>

      {fundsError ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {fundsError}
        </p>
      ) : null}
      {!configReady ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          Embedded-wallet signing is not configured for this deployment.
        </p>
      ) : null}
      {funds && !hasFunds ? (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
          Fund this exact wallet with USDC on {props.chainName} before
          purchasing.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!funds || !hasFunds || !configReady || busy}
        onClick={confirm}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {busy ? "Purchase in progress" : "Confirm one Event Pass"}
      </button>

      {approval !== "idle" || purchase !== "idle" ? (
        <div aria-live="polite" className="rounded-2xl bg-muted p-4 text-sm">
          <p>{outcomeLabel("USDC approval", approval)}</p>
          {approvalWasReplaced ? (
            <p className="text-xs text-muted-foreground">
              The network accepted a replacement approval transaction.
            </p>
          ) : null}
          <p className="mt-1">
            {outcomeLabel("Event Pass purchase", purchase)}
          </p>
          {purchaseWasReplaced ? (
            <p className="text-xs text-muted-foreground">
              The network accepted a replacement purchase transaction.
            </p>
          ) : null}
          {passId ? (
            <p className="mt-3 flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> Event Pass #{passId} confirmed
              onchain
            </p>
          ) : null}
          {sync ? (
            <p className="mt-1 font-semibold">
              Mint Up synchronization: {sync.status}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}
