// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~~/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

import {
  EventPassResalePurchaseButton,
  EventPassResalePurchaseContent,
} from "./event-pass-resale-purchase-content";
import {
  EventPassResalePurchaseLoadError,
  EventPassResalePurchaseReview,
} from "./event-pass-resale-purchase-review";

const listing = {
  passId: "42",
  status: "actionable" as const,
  event: { name: "ETH Lima 2026", startTime: Date.UTC(2026, 8, 10) },
  price: {
    amountSubunits: "40000000",
    denomination: "USDC" as const,
  },
  originalProtectedPrice: {
    amountSubunits: "25000000",
    denomination: "USDC" as const,
  },
  protection: "original_price_only" as const,
};

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
  "escrow",
  "0x1111111111111111111111111111111111111111",
  "Event Pass #42",
  "seller",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("public Pass resale purchase rendered states", () => {
  it("reviews buyer-safe economics, balance, cancellation, and finality", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseReview
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
        originalProtectedAmountSubunits={
          listing.originalProtectedPrice.amountSubunits
        }
        balanceAmountSubunits="55000000"
      />,
    );

    expect(html).toContain("Reventa");
    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("Total: 40 USDC");
    expect(html).toContain("Saldo disponible: 55 USDC");
    expect(html).toContain("Comisión de Mint Up: 9% incluido");
    expect(html).toContain("Pago protegido: 25 USDC");
    expect(html).toContain("Si el evento se cancela");
    expect(html).toContain("Esta compra es definitiva");
    expect(html).toContain("Face ID o huella digital");
    expectBuyerSafe(html);
  });

  it("offers one exact-price purchase action", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseButton priceAmountSubunits="40000000" />,
    );

    expect(html).toContain("Comprar por 40 USDC");
    expectBuyerSafe(html);
  });

  it("shows balance, total, and deficit when funds are insufficient", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="insufficient"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
        balanceAmountSubunits="25000000"
      />,
    );

    expect(html).toContain(
      "Necesitas 15 USDC más para comprar este Event Pass.",
    );
    expect(html).toContain("Saldo disponible: 25 USDC");
    expect(html).toContain("Total: 40 USDC");
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });

  it("blocks confirmation when the balance cannot be checked", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="balance_unavailable"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
      />,
    );

    expect(html).toContain(
      "No pudimos consultar tu saldo de USDC. Inténtalo de nuevo.",
    );
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });

  it("explains an unavailable listing and returns to the Marketplace", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="stale"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
      />,
    );

    expect(html).toContain("Esta reventa ya no está disponible");
    expect(html).toContain("otro comprador la haya completado primero");
    expect(html).toContain("No se te cobrará.");
    expect(html).toContain("Volver a Marketplace");
    expectBuyerSafe(html);
  });

  it("shows authoritative success only as final ownership", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="success"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
      />,
    );

    expect(html).toContain("ETH Lima 2026 ahora está en Mis pases.");
    expectBuyerSafe(html);
  });

  it("shows a concise inclusion failure with Retry", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="failure"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
      />,
    );

    expect(html).toContain("No pudimos completar esta compra");
    expect(html).toContain("no se te cobrará");
    expect(html).toContain("Reintentar");
    expect(html).toContain("Volver a Marketplace");
    expectBuyerSafe(html);
  });

  it("shows a concise Marketplace loading failure with Retry", () => {
    const html = renderToStaticMarkup(<EventPassResalePurchaseLoadError />);

    expect(html).toContain(
      "No pudimos cargar esta reventa. Inténtalo de nuevo.",
    );
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });
});
