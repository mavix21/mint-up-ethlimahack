import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi, getAddress } from "viem";

import {
  buildPurchaseBatchCalls,
  decodePurchaseBatch,
  encodePurchaseBatch,
  eventPassPurchaseAbi,
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

describe("purchase batch construction", () => {
  it("builds exactly approval then purchase with zero value and exact price", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.to.toLowerCase()).toBe(
      snapshot.paymentAssetAddress.toLowerCase(),
    );
    expect(calls[0]!.value).toBe(0n);
    expect(calls[1]!.to.toLowerCase()).toBe(
      snapshot.contractAddress.toLowerCase(),
    );
    expect(calls[1]!.value).toBe(0n);
    // approval is exact price
    const price = BigInt(snapshot.priceAmountSubunits);
    const encodedApprove = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [snapshot.contractAddress as `0x${string}`, price],
    });
    expect(calls[0]!.data).toBe(encodedApprove);
    const encodedPurchase = encodeFunctionData({
      abi: eventPassPurchaseAbi,
      functionName: "purchase",
      args: [snapshot.eventIdentifier as `0x${string}`],
    });
    expect(calls[1]!.data).toBe(encodedPurchase);
  });

  it("encodes and decodes a two-call batch", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    const encoded = encodePurchaseBatch(calls);
    const decoded = decodePurchaseBatch(encoded);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.to.toLowerCase()).toBe(calls[0]!.to.toLowerCase());
    expect(decoded[1]!.data.toLowerCase()).toBe(calls[1]!.data.toLowerCase());
  });

  it("validates a correct sponsored batch", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    const callData = encodePurchaseBatch(calls);
    expect(() =>
      validateSponsoredPurchaseBatch({
        callData,
        snapshot,
        sender: snapshot.buyerAddress as `0x${string}`,
        chainId: 421614,
        entryPointAddress: allowlist.entryPointAddress,
        allowlist,
      }),
    ).not.toThrow();
  });

  it("rejects wrong sender, chain, entryPoint, expiry", () => {
    const calls = buildPurchaseBatchCalls(snapshot);
    const callData = encodePurchaseBatch(calls);
    const base = {
      callData,
      snapshot,
      sender: snapshot.buyerAddress as `0x${string}`,
      chainId: 421614,
      entryPointAddress: allowlist.entryPointAddress,
      allowlist,
    };
    expect(() =>
      validateSponsoredPurchaseBatch({
        ...base,
        sender: "0x9999999999999999999999999999999999999999" as `0x${string}`,
      }),
    ).toThrow("Wrong sender");
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, chainId: 1 }),
    ).toThrow("Wrong chain");
    expect(() =>
      validateSponsoredPurchaseBatch({
        ...base,
        entryPointAddress:
          "0x1111111111111111111111111111111111111111" as `0x${string}`,
      }),
    ).toThrow("Wrong EntryPoint");
    expect(() =>
      validateSponsoredPurchaseBatch({
        ...base,
        snapshot: { ...snapshot, expiresAt: Date.now() - 1000 },
      }),
    ).toThrow("expired");
  });

  it("rejects extra calls, nonzero value, wrong contracts, wrong method, wrong args, unlimited approval", () => {
    const validCalls = buildPurchaseBatchCalls(snapshot);
    const validData = encodePurchaseBatch(validCalls);
    const base = {
      snapshot,
      sender: snapshot.buyerAddress as `0x${string}`,
      chainId: 421614,
      entryPointAddress: allowlist.entryPointAddress,
      allowlist,
    };
    // extra call
    const extra = encodePurchaseBatch([...validCalls, validCalls[0]!]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: extra }),
    ).toThrow("exactly approval and purchase");

    // nonzero value
    const nonzero = encodePurchaseBatch([
      { ...validCalls[0]!, value: 1n },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: nonzero }),
    ).toThrow("zero native value");

    // wrong USDC
    const wrongUsdc = encodePurchaseBatch([
      {
        ...validCalls[0]!,
        to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
      },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: wrongUsdc }),
    ).toThrow("Wrong USDC");

    // wrong spender
    const wrongSpender = encodePurchaseBatch([
      {
        ...validCalls[0]!,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
            BigInt(snapshot.priceAmountSubunits),
          ],
        }),
      },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: wrongSpender }),
    ).toThrow("Wrong spender");

    // unlimited approval
    const unlimited = encodePurchaseBatch([
      {
        ...validCalls[0]!,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [snapshot.contractAddress as `0x${string}`, 2n ** 256n - 1n],
        }),
      },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: unlimited }),
    ).toThrow("exact prepared price");

    // wrong price
    const wrongPrice = encodePurchaseBatch([
      {
        ...validCalls[0]!,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [
            snapshot.contractAddress as `0x${string}`,
            BigInt(snapshot.priceAmountSubunits) + 1n,
          ],
        }),
      },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: wrongPrice }),
    ).toThrow("exact prepared price");

    // wrong event identifier
    const wrongEvent = encodePurchaseBatch([
      validCalls[0]!,
      {
        ...validCalls[1]!,
        data: encodeFunctionData({
          abi: eventPassPurchaseAbi,
          functionName: "purchase",
          args: [`0x${"ff".repeat(32)}` as `0x${string}`],
        }),
      },
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: wrongEvent }),
    ).toThrow("Wrong Event identifier");

    // wrong method (transfer instead of approve)
    const wrongMethod = encodePurchaseBatch([
      {
        ...validCalls[0]!,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [
            snapshot.contractAddress as `0x${string}`,
            BigInt(snapshot.priceAmountSubunits),
          ],
        }),
      },
      validCalls[1]!,
    ]);
    expect(() =>
      validateSponsoredPurchaseBatch({ ...base, callData: wrongMethod }),
    ).toThrow("must be USDC approve");
  });
});
