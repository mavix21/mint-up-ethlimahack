// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~~/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { EventPassRefundContent } from "./event-pass-refund-content";
import { EventPassRefundPanel } from "./event-pass-refund-panel";
import type { WalletPasskeyAccount } from "../../lib/kernel-account";

const holder = "0x1111111111111111111111111111111111111111";
const otherHolder = "0x2222222222222222222222222222222222222222";
const account = { address: holder } as WalletPasskeyAccount;
const pass = {
  passId: "42",
  owner: { address: holder },
  refund: { status: "available" as const },
  checkIn: { status: "notRecorded" as const },
};

const forbidden = [
  "owner address",
  "event id",
  "pass id",
  "chain",
  "hash",
  "explorer",
  "wallet",
  "gas",
  "claim",
  "escrow",
  holder,
  "private-resale-0001",
  "#42",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("Event Pass refund rendered states", () => {
  it("shows the available original protected amount and one biometric action", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundContent
        state="available"
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
      />,
    );

    expect(html).toContain("Reembolso disponible");
    expect(html).toContain("25 USDC");
    expect(html).toContain("Recibir reembolso");
    expect(html).toContain("Face ID o huella digital");
    expectBuyerSafe(html);
  });

  it("does not present pending work as a received refund", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundContent
        state="pending"
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
      />,
    );

    expect(html).toContain("Confirmando tu reembolso");
    expect(html).not.toContain("Reembolso recibido");
    expectBuyerSafe(html);
  });

  it("shows a reconciled refund without a repeat action", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundContent
        state="received"
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
      />,
    );

    expect(html).toContain("Reembolso recibido");
    expect(html).not.toContain("Recibir reembolso");
    expectBuyerSafe(html);
  });

  it("renders no refund controls when the pass is not held by this user", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundPanel
        pass={{ ...pass, owner: { address: otherHolder } }}
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
        account={account}
      />,
    );

    expect(html).toBe("");
  });

  it("keeps the original protected amount after a higher-price resale", () => {
    const completedResale = {
      buyerAddress: holder,
      displayPrice: "40 USDC",
    };
    const html = renderToStaticMarkup(
      <EventPassRefundPanel
        pass={{
          ...pass,
          owner: { address: completedResale.buyerAddress },
        }}
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
        account={account}
      />,
    );

    expect(html).toContain("25 USDC");
    expect(html).not.toContain(completedResale.displayPrice);
    expect(html).toContain("Recibir reembolso");
    expect(html).toContain("pago protegido");
    expectBuyerSafe(html);
  });

  it("keeps the action available for a checked-in cancelled pass", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundPanel
        pass={{ ...pass, checkIn: { status: "recorded" } }}
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
        account={account}
      />,
    );

    expect(html).toContain("Recibir reembolso");
    expectBuyerSafe(html);
  });

  it("shows a concise failure with Retry", () => {
    const html = renderToStaticMarkup(
      <EventPassRefundContent
        state="failure"
        eventName="ETH Lima 2026"
        originalAmountSubunits="25000000"
      />,
    );

    expect(html).toContain(
      "No pudimos completar tu reembolso. Inténtalo de nuevo.",
    );
    expect(html).toContain("Reintentar");
    expectBuyerSafe(html);
  });
});
