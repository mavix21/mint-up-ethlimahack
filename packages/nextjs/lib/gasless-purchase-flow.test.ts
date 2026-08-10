import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi } from "viem";

import {
  buildPurchaseBatchCalls,
  encodePurchaseBatch,
  validateSponsoredPurchaseBatch,
} from "./event-pass-purchase-batch";

const snapshot = {
  chainId: 421614,
  contractAddress: "0x1111111111111111111111111111111111111111" as const,
  paymentAssetAddress: "0x2222222222222222222222222222222222222222" as const,
  eventIdentifier: `0x${"ab".repeat(32)}` as const,
  priceAmountSubunits: "25000000",
  buyerAddress: "0x3333333333333333333333333333333333333333" as const,
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const,
  expiresAt: Date.now() + 60_000,
};
const allowlist = {
  chainId: 421614,
  entryPointAddress:
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`,
  usdcAddress: snapshot.paymentAssetAddress as `0x${string}`,
  eventPassAddress: snapshot.contractAddress as `0x${string}`,
};

describe("gasless purchase acceptance seam", () => {
  it("requires exactly one approval of exact price and one purchase with zero ETH and revert-on-failure", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.value).toBe(0n);
    expect(calls[1]!.value).toBe(0n);
    const data = encodePurchaseBatch(calls);
    // validation passes
    expect(() =>
      validateSponsoredPurchaseBatch({
        callData: data,
        snapshot,
        sender: snapshot.buyerAddress as `0x${string}`,
        chainId: 421614,
        entryPointAddress: allowlist.entryPointAddress,
        allowlist,
      }),
    ).not.toThrow();
  });

  it("frozen intent: changing price or event identifier after review invalidates sponsorship", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    const data = encodePurchaseBatch(calls);
    const mutated = { ...snapshot, priceAmountSubunits: "99999999" };
    expect(() =>
      validateSponsoredPurchaseBatch({
        callData: data,
        snapshot: mutated,
        sender: snapshot.buyerAddress as `0x${string}`,
        chainId: 421614,
        entryPointAddress: allowlist.entryPointAddress,
        allowlist,
      }),
    ).toThrow("exact prepared price");

    const mutated2 = {
      ...snapshot,
      eventIdentifier: `0x${"ff".repeat(32)}` as `0x${string}`,
    };
    const wrongCalls = buildPurchaseBatchCalls(mutated2);
    const wrongData = encodePurchaseBatch(wrongCalls);
    expect(() =>
      validateSponsoredPurchaseBatch({
        callData: wrongData,
        snapshot,
        sender: snapshot.buyerAddress as `0x${string}`,
        chainId: 421614,
        entryPointAddress: allowlist.entryPointAddress,
        allowlist,
      }),
    ).toThrow("Wrong Event identifier");
  });

  it("payer and owner are the selected Kernel account, not an infrastructure account", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    const data = encodePurchaseBatch(calls);
    const infra = "0x9999999999999999999999999999999999999999" as `0x${string}`;
    expect(() =>
      validateSponsoredPurchaseBatch({
        callData: data,
        snapshot,
        sender: infra,
        chainId: 421614,
        entryPointAddress: allowlist.entryPointAddress,
        allowlist,
      }),
    ).toThrow("Wrong sender");
  });

  it("rejects unlimited approval, non-zero value, extra calls, wrong spender/recipient", () => {
    const valid = buildPurchaseBatchCalls(snapshot);
    const base = {
      snapshot,
      sender: snapshot.buyerAddress as `0x${string}`,
      chainId: 421614,
      entryPointAddress: allowlist.entryPointAddress,
      allowlist,
    };
    const unlimited = encodePurchaseBatch([
      {
        ...valid[0]!,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [snapshot.contractAddress as `0x${string}`, 2n ** 256n - 1n],
        }),
      },
      valid[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: unlimited }),
    ).toThrow("exact prepared price");

    const nonzero = encodePurchaseBatch([
      { ...valid[0]!, value: 1n },
      valid[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: nonzero }),
    ).toThrow("zero native value");

    const extra = encodePurchaseBatch([...valid, valid[0]!]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: extra }),
    ).toThrow("exactly approval and purchase");
  });
});
