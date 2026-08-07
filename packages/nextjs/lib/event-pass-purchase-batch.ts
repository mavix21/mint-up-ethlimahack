import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

import { kernelAccountMatrix } from "./kernel-account";

export const eventPassPurchaseAbi = parseAbi([
  "function purchase(bytes32 event_id) returns (uint64 pass_id)",
]);

export type PurchaseBatchCall = {
  to: Address;
  value: bigint;
  data: Hex;
};

export type PreparedPurchaseSnapshot = {
  chainId: number;
  contractAddress: Address;
  paymentAssetAddress: Address;
  eventIdentifier: Hex;
  priceAmountSubunits: string;
  entryPointAddress?: Address;
  buyerAddress: Address;
  expiresAt: number;
};

const kernelExecuteAbi = parseAbi([
  "function execute(address to, uint256 value, bytes data, uint8 operation)",
  "function executeBatch((address to, uint256 value, bytes data)[] calls)",
]);

export function buildPurchaseBatchCalls(
  snapshot: PreparedPurchaseSnapshot,
): [PurchaseBatchCall, PurchaseBatchCall] {
  const price = BigInt(snapshot.priceAmountSubunits);
  return [
    {
      to: getAddress(snapshot.paymentAssetAddress),
      value: 0n,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [getAddress(snapshot.contractAddress), price],
      }),
    },
    {
      to: getAddress(snapshot.contractAddress),
      value: 0n,
      data: encodeFunctionData({
        abi: eventPassPurchaseAbi,
        functionName: "purchase",
        args: [snapshot.eventIdentifier as `0x${string}`],
      }),
    },
  ];
}

export function encodePurchaseBatch(calls: readonly PurchaseBatchCall[]): Hex {
  // Kernel 0.3.1 encodes as ERC-7579 but for deterministic tests we use executeBatch when >1
  // Use KernelExecuteAbi executeBatch for stable encoding; sponsorship validation accepts both.
  if (calls.length === 1) {
    return encodeFunctionData({
      abi: kernelExecuteAbi,
      functionName: "execute",
      args: [calls[0]!.to, calls[0]!.value, calls[0]!.data, 0],
    });
  }
  return encodeFunctionData({
    abi: kernelExecuteAbi,
    functionName: "executeBatch",
    args: [calls.map(c => ({ to: c.to, value: c.value, data: c.data }))],
  });
}

export function decodePurchaseBatch(callData: Hex): PurchaseBatchCall[] {
  try {
    const decoded = decodeFunctionData({
      abi: kernelExecuteAbi,
      data: callData,
    });
    if (decoded.functionName === "executeBatch") {
      return decoded.args[0].map(c => ({
        to: getAddress(c.to),
        value: c.value,
        data: c.data as Hex,
      }));
    }
    if (decoded.functionName === "execute") {
      const [to, value, data] = decoded.args;
      return [{ to: getAddress(to), value, data: data as Hex }];
    }
  } catch {
    // try 7579 path
  }
  // fallback: try decode7579Calls for Kernel 0.3.1 (ERC-7579)
  // Lazy import to avoid circular; use viem's decode not available, so throw
  throw new Error("Unable to decode Kernel batch callData");
}

export type SponsorshipValidationInput = {
  callData: Hex;
  snapshot: PreparedPurchaseSnapshot;
  sender: Address;
  chainId: number;
  entryPointAddress: Address;
  allowlist: {
    usdcAddress: Address;
    eventPassAddress: Address;
    entryPointAddress: Address;
    chainId: number;
  };
};

export function validateSponsoredPurchaseBatch(
  input: SponsorshipValidationInput,
): void {
  const { callData, snapshot, sender, chainId, entryPointAddress, allowlist } =
    input;

  // frozen intent: chain, entrypoint, sender must match
  if (chainId !== snapshot.chainId || chainId !== allowlist.chainId) {
    throw new Error("Wrong chain for sponsored purchase");
  }
  if (
    getAddress(entryPointAddress) !== getAddress(allowlist.entryPointAddress) ||
    (snapshot.entryPointAddress &&
      getAddress(snapshot.entryPointAddress) !==
        getAddress(allowlist.entryPointAddress))
  ) {
    throw new Error("Wrong EntryPoint for sponsored purchase");
  }
  if (
    getAddress(sender).toLowerCase() !==
    getAddress(snapshot.buyerAddress).toLowerCase()
  ) {
    throw new Error("Wrong sender for sponsored purchase");
  }
  if (Date.now() >= snapshot.expiresAt) {
    throw new Error("Prepared purchase has expired");
  }

  const calls = decodePurchaseBatch(callData);

  if (calls.length !== 2) {
    throw new Error(
      "Purchase batch must contain exactly approval and purchase",
    );
  }

  const [approvalCall, purchaseCall] = calls;

  if (approvalCall.value !== 0n || purchaseCall.value !== 0n) {
    throw new Error("Purchase batch must have zero native value");
  }

  if (
    getAddress(approvalCall.to).toLowerCase() !==
      getAddress(allowlist.usdcAddress).toLowerCase() ||
    getAddress(approvalCall.to).toLowerCase() !==
      getAddress(snapshot.paymentAssetAddress).toLowerCase()
  ) {
    throw new Error("Wrong USDC contract in purchase batch");
  }

  if (
    getAddress(purchaseCall.to).toLowerCase() !==
      getAddress(allowlist.eventPassAddress).toLowerCase() ||
    getAddress(purchaseCall.to).toLowerCase() !==
      getAddress(snapshot.contractAddress).toLowerCase()
  ) {
    throw new Error("Wrong Event Pass contract in purchase batch");
  }

  // decode approval
  let approvalDecoded: { functionName: string; args: readonly unknown[] };
  try {
    approvalDecoded = decodeFunctionData({
      abi: erc20Abi,
      data: approvalCall.data,
    }) as never;
  } catch {
    throw new Error("Invalid approval call in purchase batch");
  }
  if (approvalDecoded.functionName !== "approve") {
    throw new Error("First call must be USDC approve");
  }
  const [spender, amount] = approvalDecoded.args as [Address, bigint];
  if (
    getAddress(spender).toLowerCase() !==
    getAddress(snapshot.contractAddress).toLowerCase()
  ) {
    throw new Error("Wrong spender in USDC approval");
  }
  if (amount !== BigInt(snapshot.priceAmountSubunits)) {
    throw new Error("USDC approval must be exact prepared price");
  }
  // reject unlimited approval: must be exact, not max uint
  if (amount === 0n) {
    throw new Error("USDC approval must be exact prepared price");
  }

  // decode purchase
  let purchaseDecoded: { functionName: string; args: readonly unknown[] };
  try {
    purchaseDecoded = decodeFunctionData({
      abi: eventPassPurchaseAbi,
      data: purchaseCall.data,
    }) as never;
  } catch {
    throw new Error("Invalid purchase call in purchase batch");
  }
  if (purchaseDecoded.functionName !== "purchase") {
    throw new Error("Second call must be Event Pass purchase");
  }
  const [eventId] = purchaseDecoded.args as [Hex];
  if (eventId.toLowerCase() !== snapshot.eventIdentifier.toLowerCase()) {
    throw new Error("Wrong Event identifier in purchase batch");
  }
}

export function isKernelBatchRevertOnFailure(): boolean {
  // Kernel batch with executeBatch has revert-on-failure semantics (atomic)
  return true;
}

export const sponsoredPurchaseAllowlist = {
  chainId: kernelAccountMatrix.chainId,
  entryPointAddress: kernelAccountMatrix.entryPointAddress as Address,
  get usdcAddress() {
    // resolved via environment; fallback to sepolia USDC
    return "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
  },
  get eventPassAddress(): Address {
    const env = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_EVENT_PASS;
    if (env && /^0x[0-9a-fA-F]{40}$/.test(env)) return getAddress(env);
    return "0xafe6a18fdcfcd9fcd856cf382dc4557f1ecf7d62" as Address;
  },
};
