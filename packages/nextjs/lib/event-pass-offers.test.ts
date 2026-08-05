import { describe, expect, it } from "vitest";

import {
  eligibleOfferPayload,
  offerPayload,
} from "../tests/fixtures/event-pass-offers";
import { parseOffer, parseOfferCatalog } from "./event-pass-offers";

const NOW = Date.UTC(2026, 7, 4, 12);

describe("Mint Up Event Pass consumer contract", () => {
  it("accepts the approved eligible offer shape", () => {
    const offer = parseOffer(eligibleOfferPayload, NOW);

    expect(offer.availability).toEqual({ kind: "available" });
    expect(offer.eventIdentifier).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
    expect(offer.price).toEqual({
      amountSubunits: "25000000",
      asset: "USDC",
      decimals: 6,
    });
    expect(offer.remaining).toBe(37);
  });

  it.each([
    ["unpublished", { publication: "unpublished" }, "Event is not published"],
    [
      "inactive configuration",
      { configuration: "inactive" },
      "Pass sales are not active",
    ],
    [
      "disabled contract sales",
      { contractSales: "disabled" },
      "Onchain sales are disabled",
    ],
    ["unsupported asset", { paymentAsset: "USDT" }, "Only USDC is supported"],
    [
      "multiple ticket types",
      { onchainTicketTypeCount: 2 },
      "Exactly one Event Pass offer is required",
    ],
    ["phased price", { pricePhaseCount: 1 }, "Price phases are not supported"],
    [
      "flexible price",
      { pricing: "flexible" },
      "Flexible pricing is not supported",
    ],
    [
      "approval",
      { approval: "required" },
      "Approval-based tickets are not supported",
    ],
    ["before the window", { saleStartsAt: NOW + 1 }, "Sales have not started"],
    ["at the exclusive end", { saleEndsAt: NOW }, "Sales have ended"],
    ["exhausted", { remaining: 0 }, "This Event Pass is sold out"],
    ["cancelled", { lifecycle: "cancelled" }, "This event was cancelled"],
  ])("marks %s offers unavailable", (_name, patch, reason) => {
    const offer = parseOffer(offerPayload(patch), NOW);
    expect(offer.availability).toEqual({ kind: "unavailable", reason });
  });

  it("keeps the start of the sales window inclusive", () => {
    const offer = parseOffer(offerPayload({ saleStartsAt: NOW }), NOW);
    expect(offer.availability).toEqual({ kind: "available" });
  });

  it("fails safely for malformed or incompatible responses", () => {
    expect(() =>
      parseOffer({ ...eligibleOfferPayload, remaining: -1 }, NOW),
    ).toThrow("Invalid Mint Up Event Pass response");
    expect(() => parseOfferCatalog({ offers: "unauthorized" }, NOW)).toThrow(
      "Invalid Mint Up Event Pass response",
    );
    expect(() =>
      parseOffer(offerPayload({ ticketTypeKind: "donation" }), NOW),
    ).toThrow();
    expect(() => parseOffer(offerPayload({ remaining: 251 }), NOW)).toThrow();
    expect(() =>
      parseOffer(offerPayload({ saleEndsAt: Date.UTC(2026, 5, 1) }), NOW),
    ).toThrow();
    expect(() =>
      parseOffer(offerPayload({ timezone: "Not/A_Timezone" }), NOW),
    ).toThrow();
  });
});
