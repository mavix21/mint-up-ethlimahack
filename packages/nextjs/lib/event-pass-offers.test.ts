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
    [
      "unpublished",
      { publication: "unpublished" },
      "El evento no está publicado",
    ],
    [
      "inactive configuration",
      { configuration: "inactive" },
      "La venta de Event Pass no está activa",
    ],
    [
      "disabled contract sales",
      { contractSales: "disabled" },
      "Las ventas onchain están desactivadas",
    ],
    ["unsupported asset", { paymentAsset: "USDT" }, "Solo se admite USDC"],
    [
      "multiple ticket types",
      { onchainTicketTypeCount: 2 },
      "Se requiere exactamente una oferta de Event Pass",
    ],
    ["phased price", { pricePhaseCount: 1 }, "No se admiten fases de precios"],
    [
      "flexible price",
      { pricing: "flexible" },
      "No se admiten precios flexibles",
    ],
    [
      "approval",
      { approval: "required" },
      "No se admiten entradas que requieren aprobación",
    ],
    [
      "before the window",
      { saleStartsAt: NOW + 1 },
      "La venta aún no ha comenzado",
    ],
    ["at the exclusive end", { saleEndsAt: NOW }, "La venta ha finalizado"],
    ["exhausted", { remaining: 0 }, "Este Event Pass está agotado"],
    ["cancelled", { lifecycle: "cancelled" }, "Este evento fue cancelado"],
  ])("marks %s offers unavailable", (_name, patch, reason) => {
    const offer = parseOffer(offerPayload(patch), NOW);
    expect(offer.availability).toEqual({ kind: "unavailable", reason });
  });

  it("keeps the start of the sales window inclusive", () => {
    const offer = parseOffer(offerPayload({ saleStartsAt: NOW }), NOW);
    expect(offer.availability).toEqual({ kind: "available" });
  });

  it("never upgrades production-unavailable offers", () => {
    const offer = parseOffer(
      offerPayload({
        availability: { kind: "unavailable", reason: "sale_ended" },
      }),
      NOW,
    );

    expect(offer.availability).toEqual({
      kind: "unavailable",
      reason: "La venta ha finalizado",
    });
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
    const legacyOffer: Record<string, unknown> = { ...eligibleOfferPayload };
    delete legacyOffer.availability;
    expect(() => parseOffer(legacyOffer, NOW)).toThrow(
      "Invalid Mint Up Event Pass response",
    );
    expect(() =>
      parseOffer(offerPayload({ directPayment: true }), NOW),
    ).toThrow("Invalid Mint Up Event Pass response");
  });
});
