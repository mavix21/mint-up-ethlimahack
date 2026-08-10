import { describe, expect, it } from "vitest";

import {
  initialPurchaseLifecycleStage,
  preparedPurchaseSchema,
} from "./event-pass-purchase-api";

const protectedPurchase = {
  purchaseId: "purchase-1",
  chainId: 421614,
  contractAddress: "0x1111111111111111111111111111111111111111",
  paymentAssetAddress: "0x2222222222222222222222222222222222222222",
  eventIdentifier:
    "0x3333333333333333333333333333333333333333333333333333333333333333",
  buyerAddress: "0x4444444444444444444444444444444444444444",
  revenueRecipient: "0x5555555555555555555555555555555555555555",
  priceAmountSubunits: "25000000",
  remaining: 10,
  expiresAt: Date.UTC(2030, 0, 1),
  entryPointAddress: "0x6666666666666666666666666666666666666666",
};

describe("prepared Protected payment snapshot", () => {
  it("accepts the production preparation shape", () => {
    expect(preparedPurchaseSchema.parse(protectedPurchase)).toEqual(
      protectedPurchase,
    );
  });

  it("rejects incompatible and client-extended snapshots", () => {
    expect(() =>
      preparedPurchaseSchema.parse({
        ...protectedPurchase,
        priceAmountSubunits: "0",
      }),
    ).toThrow();
    expect(() =>
      preparedPurchaseSchema.parse({
        ...protectedPurchase,
        directPayment: true,
      }),
    ).toThrow();
  });
});

describe("resumed purchase authority", () => {
  it("rechecks persisted success with the backend before showing confirmation", () => {
    expect(initialPurchaseLifecycleStage("confirmed", true)).toBe(
      "reconciling",
    );
    expect(initialPurchaseLifecycleStage("confirmed", false)).toBe("idle");
  });
});
