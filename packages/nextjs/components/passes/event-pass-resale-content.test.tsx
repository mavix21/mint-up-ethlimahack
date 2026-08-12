// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isEventPassResaleEligible } from "../../lib/event-pass-resale-eligibility";
import { EventPassResaleContent } from "./event-pass-resale-content";

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
  "base units",
  "0x1111111111111111111111111111111111111111",
  "Event Pass #42",
  "private-resale-0001",
  "421614",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("Event Pass resale rendered states", () => {
  it.each([
    ["event started", { event: { startTime: 99 } }],
    ["event cancelled", { cancellation: { status: "cancelled" as const } }],
    ["checked in", { checkIn: { status: "recorded" } }],
    ["ownership lost", { transfer: { status: "transferred" as const } }],
    ["pass invalid", { validity: { status: "invalid" as const } }],
  ])("does not render resale controls when the %s", (_name, patch) => {
    const pass = {
      validity: { status: "valid" as const },
      cancellation: { status: "active" as const },
      transfer: { status: "transferable" as const },
      checkIn: { status: "notRecorded" },
      event: { startTime: 101 },
      ...patch,
    };
    const html = renderToStaticMarkup(
      isEventPassResaleEligible(pass, true, 100) ? (
        <button>Poner en reventa</button>
      ) : null,
    );

    expect(html).not.toContain("Poner en reventa");
  });

  it("renders resale controls before the event for the current eligible holder", () => {
    const pass = {
      validity: { status: "valid" as const },
      cancellation: { status: "active" as const },
      transfer: { status: "transferable" as const },
      checkIn: { status: "notRecorded" },
      event: { startTime: 101 },
    };
    const html = renderToStaticMarkup(
      isEventPassResaleEligible(pass, true, 100) ? (
        <button>Poner en reventa</button>
      ) : null,
    );

    expect(html).toContain("Poner en reventa");
  });

  it("does not render resale controls while resale actions are paused", () => {
    const pass = {
      validity: { status: "valid" as const },
      cancellation: { status: "active" as const },
      transfer: { status: "transferable" as const },
      checkIn: { status: "notRecorded" },
      event: { startTime: 101 },
    };
    const html = renderToStaticMarkup(
      isEventPassResaleEligible(pass, true, 100, false) ? (
        <button>Poner en reventa</button>
      ) : null,
    );

    expect(html).not.toContain("Poner en reventa");
  });

  it("renders a price-only form with the protected payment cap", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent
        state="form"
        eventName="ETH Lima 2026"
        maximumPrice="30 USDC"
      />,
    );

    expect(html).not.toContain("Buyer email");
    expect(html).not.toContain('type="email"');
    expect(html).toContain("Precio en USDC");
    expect(html).toContain("30 USDC");
    expect(html).toContain('inputMode="decimal"');
    expectBuyerSafe(html);
  });

  it("disables Continue and shows feedback while preparing the resale", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent
        state="form"
        eventName="ETH Lima 2026"
        preparing
      />,
    );

    expect(html).toContain("disabled");
    expect(html).toContain("Cargando...");
    expect(html).toContain("animate-spin");
  });

  it.each(["create", "replace"] as const)(
    "reviews %s with one biometric confirmation",
    kind => {
      const html = renderToStaticMarkup(
        <EventPassResaleContent
          state="review"
          eventName="ETH Lima 2026"
          action={kind}
          price="25.50"
          fee="2.295 USDC"
          net="23.205 USDC"
        />,
      );

      expect(html).toContain(
        kind === "replace" ? "Actualizar anuncio" : "Crear anuncio",
      );
      expect(html).toContain("25.50 USDC");
      expect(html).toContain("Comisión del 9% de Marketplace");
      expect(html).toContain("2.295 USDC");
      expect(html).toContain("Recibes (91%)");
      expect(html).toContain("23.205 USDC");
      expect(html).toContain("Confirmar con Face ID o huella digital");
      expectBuyerSafe(html);
    },
  );

  it("reviews withdrawal without implying payment or ownership changes", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent
        state="review"
        eventName="ETH Lima 2026"
        action="withdraw"
        price="25.5"
      />,
    );

    expect(html).toContain("Eliminar anuncio");
    expect(html).toContain("Conservas tu Event Pass");
    expect(html).toContain("No se transfieren USDC");
    expectBuyerSafe(html);
  });

  it("keeps pending non-authoritative and offers concise retry", () => {
    const pending = renderToStaticMarkup(
      <EventPassResaleContent
        state="pending"
        eventName="ETH Lima 2026"
        action="replace"
      />,
    );
    const failure = renderToStaticMarkup(
      <EventPassResaleContent
        state="failure"
        eventName="ETH Lima 2026"
        action="replace"
        failure="operation"
      />,
    );

    expect(pending).toContain("Confirmando tu anuncio");
    expect(pending).not.toContain("has been replaced");
    expect(failure).toContain("Inténtalo de nuevo");
    expect(failure).toContain("Reintentar");
    expectBuyerSafe(pending + failure);
  });

  it("renders actionable validation without technical details", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent
        state="failure"
        eventName="ETH Lima 2026"
        action="create"
        failure="validation"
      />,
    );

    expect(html).toContain(
      "Ingresa un precio positivo en USDC con hasta 6 decimales que no supere tu pago protegido.",
    );
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });

  it("hides actions for a stale offer", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent
        state="unavailable"
        eventName="ETH Lima 2026"
        price="25.5"
      />,
    );

    expect(html).toContain("Anuncio no disponible");
    expect(html).not.toContain("Actualizar anuncio");
    expect(html).not.toContain("Eliminar anuncio");
    expectBuyerSafe(html);
  });
});
