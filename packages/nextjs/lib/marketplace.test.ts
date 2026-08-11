import { describe, expect, it } from "vitest";

import { composeMarketplace } from "./marketplace";

describe("composeMarketplace", () => {
  it("groups resale listings by event, excludes owned passes, then sorts", () => {
    const result = composeMarketplace(
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
            {
              passId: "pass-1",
              ticketTypeName: "VIP",
              price: { amountSubunits: "1000000", denomination: "USDC" },
              originalProtectedPrice: {
                amountSubunits: "2000000",
                denomination: "USDC",
              },
              offerKind: "pass_resale",
            },
          ],
        },
        {
          event: { id: "later", name: "Later", startTime: 200 },
          listings: [
            {
              passId: "pass-3",
              ticketTypeName: "General",
              price: { amountSubunits: "3000000", denomination: "USDC" },
              originalProtectedPrice: {
                amountSubunits: "3000000",
                denomination: "USDC",
              },
              offerKind: "pass_resale",
            },
          ],
        },
      ],
      new Set(["pass-1"]),
    );

    expect(result.map(group => group.event.id)).toEqual(["soon", "later"]);
    expect(result[0]?.offers.map(offer => offer.priceAmountSubunits)).toEqual([
      "2000000",
    ]);
    expect(result[0]?.offers[0]).toMatchObject({
      originalProtectedPriceAmountSubunits: "4000000",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /seller|address|email|userId|resaleId/,
    );
  });
});
