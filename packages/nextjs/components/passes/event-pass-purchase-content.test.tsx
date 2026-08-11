// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BiometricUnavailable,
  EventPassPurchaseError,
  EventPassPurchaseReview,
  EventPassPurchaseSuccess,
} from "./event-pass-purchase-content";

const forbidden = [
  "wallet",
  "gas",
  "approval",
  "hash",
  "explorer",
  "NFT",
  "token",
  "EntryPoint",
  "UserOperation",
  "paymaster",
  "transaction",
  "0x1111111111111111111111111111111111111111",
  "Event Pass #42",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("Get Pass rendered states", () => {
  it("reviews the Event, total price, protection, and one biometric confirmation", () => {
    const html = renderToStaticMarkup(
      <EventPassPurchaseReview
        eventName="ETH Lima 2026"
        priceAmountSubunits="25000000"
        confirmDisabled={false}
      />,
    );

    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("25 USDC");
    expect(html).toContain("Pago protegido");
    expect(html).toContain("precio original completo");
    expect(html).toContain("Confirmar con Face ID o huella digital");
    expectBuyerSafe(html);
  });

  it("renders one actionable failure and Retry", () => {
    const html = renderToStaticMarkup(<EventPassPurchaseError />);

    expect(html).toContain(
      "No pudimos obtener tu Event Pass. Inténtalo de nuevo.",
    );
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });

  it("renders biometric recovery without account infrastructure", () => {
    const html = renderToStaticMarkup(<BiometricUnavailable />);

    expect(html).toContain("Face ID o la huella digital no están disponibles");
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });

  it("renders authoritative success without technical identifiers", () => {
    const html = renderToStaticMarkup(
      <EventPassPurchaseSuccess eventName="ETH Lima 2026" />,
    );

    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("Tu Event Pass está confirmado.");
    expect(html).not.toContain("<p>");
    expectBuyerSafe(html);
  });
});
