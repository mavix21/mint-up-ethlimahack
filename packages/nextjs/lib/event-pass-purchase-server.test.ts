import { beforeEach, describe, expect, it, vi } from "vitest";

const readContract = vi.fn();
const getBlock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("viem", async importOriginal => {
  const original = await importOriginal<typeof import("viem")>();
  return {
    ...original,
    createPublicClient: () => ({ readContract, getBlock }),
    http: () => ({}),
  };
});
vi.mock("../contracts/eventPassEnvironment", () => ({
  eventPassEnvironment: {
    chainId: 421614,
    eventPassAddress: "0x1111111111111111111111111111111111111111",
    usdcAddress: "0x2222222222222222222222222222222222222222",
  },
}));

import { verifyPreparedPurchaseAvailability } from "./event-pass-purchase-server";

const purchase = {
  purchaseId: "purchase-1",
  chainId: 421614,
  contractAddress: "0x1111111111111111111111111111111111111111",
  paymentAssetAddress: "0x2222222222222222222222222222222222222222",
  eventIdentifier: `0x${"3".repeat(64)}`,
  buyerAddress: "0x4444444444444444444444444444444444444444",
  revenueRecipient: "0x5555555555555555555555555555555555555555",
  priceAmountSubunits: "25000000",
  remaining: 10,
  expiresAt: Date.now() + 60_000,
};

describe("live Event Pass purchase availability", () => {
  beforeEach(() => {
    readContract
      .mockReset()
      .mockResolvedValueOnce([
        "0x6666666666666666666666666666666666666666",
        purchase.paymentAssetAddress,
        false,
      ])
      .mockResolvedValueOnce([
        purchase.revenueRecipient,
        25_000_000n,
        10,
        2,
        100n,
        200n,
        true,
        true,
        false,
        "0x7777777777777777777777777777777777777777",
      ]);
    getBlock.mockReset().mockResolvedValue({ timestamp: 100n });
  });

  it("accepts sale start inclusively after matching live price and capacity", async () => {
    await expect(
      verifyPreparedPurchaseAvailability(purchase),
    ).resolves.toBeUndefined();
  });

  it("rejects the exclusive sale end", async () => {
    getBlock.mockResolvedValue({ timestamp: 200n });
    await expect(verifyPreparedPurchaseAvailability(purchase)).rejects.toThrow(
      "no longer available onchain",
    );
  });
});
