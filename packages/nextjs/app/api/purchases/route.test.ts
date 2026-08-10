import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticated = vi.fn(async () => true);
const verifyPreparedPurchaseAvailability = vi.fn(async () => undefined);
const getEventPassOffer = vi.fn(
  async (): Promise<{
    eventIdentifier: string;
    price: { amountSubunits: string; asset: string; decimals: number };
    revenueRecipient: string;
    startTime: number;
    availability: { kind: "available" | "unavailable"; reason?: string };
  } | null> => ({
    eventIdentifier: `0x${"3".repeat(64)}`,
    price: { amountSubunits: "25000000", asset: "USDC", decimals: 6 },
    revenueRecipient: "0x5555555555555555555555555555555555555555",
    startTime: 1_786_000_000_000,
    availability: { kind: "available" },
  }),
);
const fetchAuthMutation = vi.fn(async () => ({
  purchaseId: "purchase-1",
  chainId: 421614,
  contractAddress: "0x1111111111111111111111111111111111111111",
  paymentAssetAddress: "0x2222222222222222222222222222222222222222",
  eventIdentifier: `0x${"3".repeat(64)}`,
  buyerAddress: "0x4444444444444444444444444444444444444444",
  revenueRecipient: "0x5555555555555555555555555555555555555555",
  priceAmountSubunits: "25000000",
  remaining: 10,
  expiresAt: 1_786_000_000_000,
}));

vi.mock("~~/lib/auth-server", () => ({
  isAuthenticated,
  fetchAuthMutation,
}));
vi.mock("../../../lib/event-pass-purchase-server", () => ({
  verifyPreparedPurchaseAvailability,
}));
vi.mock("~~/lib/event-pass-offer-data", () => ({ getEventPassOffer }));

const buyerAddress = "0x4444444444444444444444444444444444444444";

function request(body: unknown) {
  return new Request("https://passes.mint-up.xyz/api/purchases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("purchase preparation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prepares through the authenticated backend without accepting price or recipient", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        eventId: "event-1",
        buyerAddress,
        idempotencyKey: "purchase-request-1",
        priceAmountSubunits: "1",
        revenueRecipient: "0x6666666666666666666666666666666666666666",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      eventId: "event-1",
      buyerAddress,
      idempotencyKey: "purchase-request-1",
    });
    expect(verifyPreparedPurchaseAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ priceAmountSubunits: "25000000" }),
      {
        eventIdentifier: `0x${"3".repeat(64)}`,
        priceAmountSubunits: "25000000",
        revenueRecipient: "0x5555555555555555555555555555555555555555",
        fundsReleaseAt: 1_786_000_000_000,
      },
    );
    expect(await response.json()).toMatchObject({
      priceAmountSubunits: "25000000",
      revenueRecipient: "0x5555555555555555555555555555555555555555",
    });
  });

  it("requires authentication before reserving inventory", async () => {
    isAuthenticated.mockResolvedValueOnce(false);
    const { POST } = await import("./route");
    const response = await POST(
      request({
        eventId: "event-1",
        buyerAddress,
        idempotencyKey: "purchase-request-1",
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("fails closed when fresh eligibility no longer permits purchase", async () => {
    fetchAuthMutation.mockRejectedValueOnce(new Error("event_pass_sold_out"));
    const { POST } = await import("./route");
    const response = await POST(
      request({
        eventId: "event-1",
        buyerAddress,
        idempotencyKey: "purchase-request-1",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message:
        "This Event Pass is no longer available. Refresh the offer and try again.",
    });
  });

  it("does not reserve inventory when the protected offer is unavailable", async () => {
    getEventPassOffer.mockResolvedValueOnce({
      eventIdentifier: `0x${"3".repeat(64)}`,
      price: { amountSubunits: "25000000", asset: "USDC", decimals: 6 },
      revenueRecipient: "0x5555555555555555555555555555555555555555",
      startTime: 1_786_000_000_000,
      availability: { kind: "unavailable", reason: "Sales have ended" },
    });
    const { POST } = await import("./route");
    const response = await POST(
      request({
        eventId: "event-1",
        buyerAddress,
        idempotencyKey: "purchase-request-1",
      }),
    );

    expect(response.status).toBe(409);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("fails closed when live contract state changed after backend preparation", async () => {
    verifyPreparedPurchaseAvailability.mockRejectedValueOnce(
      new Error("sales disabled"),
    );
    const { POST } = await import("./route");
    const response = await POST(
      request({
        eventId: "event-1",
        buyerAddress,
        idempotencyKey: "purchase-request-1",
      }),
    );

    expect(response.status).toBe(409);
  });
});
