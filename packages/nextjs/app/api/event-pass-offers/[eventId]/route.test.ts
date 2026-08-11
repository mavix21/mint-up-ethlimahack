import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPassOffer = vi.fn();

vi.mock("~~/lib/event-pass-offer-data", () => ({ getEventPassOffer }));
vi.mock("~~/contracts/eventPassEnvironment", () => ({
  eventPassChainName: "Arbitrum Sepolia",
  eventPassEnvironment: {
    chainId: 421614,
    eventPassAddress: "0x1111111111111111111111111111111111111111",
    usdcAddress: "0x2222222222222222222222222222222222222222",
  },
}));

const request = new Request(
  "https://passes.mint-up.xyz/api/event-pass-offers/event-1",
);
const context = { params: Promise.resolve({ eventId: "event-1" }) };

describe("Event Pass offer route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the purchase fields and chain configuration", async () => {
    getEventPassOffer.mockResolvedValueOnce({
      eventId: "event-1",
      name: "Builder Night",
      eventIdentifier: `0x${"a".repeat(64)}`,
      price: { amountSubunits: "12500000" },
      remaining: 12,
      revenueRecipient: "0x3333333333333333333333333333333333333333",
      availability: { kind: "available" },
    });
    const { GET } = await import("./route");

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(getEventPassOffer).toHaveBeenCalledWith("event-1");
    expect(await response.json()).toMatchObject({
      offer: {
        eventId: "event-1",
        eventName: "Builder Night",
        priceAmountSubunits: "12500000",
      },
      environment: {
        chainId: 421614,
        chainName: "Arbitrum Sepolia",
      },
    });
  });

  it("returns not found when the event has no Event Pass offer", async () => {
    getEventPassOffer.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });
});
