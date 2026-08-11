import { describe, expect, it } from "vitest";

import { composeMarketplace } from "./marketplace";

describe("composeMarketplace", () => {
  it("groups primary and resale offers by event, then sorts events and prices", () => {
    const result = composeMarketplace(
      [
        {
          eventId: "later",
          name: "Later",
          startTime: 200,
          price: { amountSubunits: "1000000" },
        },
        {
          eventId: "soon",
          name: "Soon",
          startTime: 100,
          price: { amountSubunits: "3000000" },
        },
        {
          eventId: "soon",
          name: "Soon",
          startTime: 100,
          price: { amountSubunits: "5000000" },
        },
      ],
      [
        {
          event: { id: "soon", name: "Soon", startTime: 100 },
          listings: [
            {
              passId: "pass-2",
              ticketTypeName: "General",
              price: { amountSubunits: "2000000", denomination: "USDC" },
              originalProtectedPrice: {
                amountSubunits: "4000000",
                denomination: "USDC",
              },
              offerKind: "pass_resale",
            },
          ],
        },
      ],
    );

    expect(result.map(group => group.event.id)).toEqual(["soon", "later"]);
    expect(
      result[0]?.offers.map(offer => [offer.kind, offer.priceAmountSubunits]),
    ).toEqual([
      ["pass_resale", "2000000"],
      ["event_pass_offer", "3000000"],
      ["event_pass_offer", "5000000"],
    ]);
    expect(result[0]?.offers[0]).toMatchObject({
      originalProtectedPriceAmountSubunits: "4000000",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /seller|address|email|userId|resaleId/,
    );
  });
});
