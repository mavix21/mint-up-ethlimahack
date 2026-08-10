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
import { PrivateResalePurchases } from "./private-resale-purchases";

const offer = {
  passId: "42",
  status: "actionable" as const,
  event: { name: "ETH Lima 2026", startTime: Date.UTC(2026, 8, 10) },
  seller: { name: "Gianella C." },
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
  "private-resale-0001",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("private resale purchase rendered states", () => {
  it("renders no actionable offer when the authenticated user is not designated", () => {
    const html = renderToStaticMarkup(
      <PrivateResalePurchases
        offers={[]}
        account={null}
        initialUsdcBalance={null}
        unavailable={false}
      />,
    );

    expect(html).toBe("");
  });

  it("reviews only buyer-safe Event, seller, total, and protection details", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseReview
        eventName={offer.event.name}
        sellerName={offer.seller.name}
        priceAmountSubunits={offer.price.amountSubunits}
        originalProtectedAmountSubunits={
          offer.originalProtectedPrice.amountSubunits
        }
      />,
    );

    expect(html).toContain("Private offer for you");
    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("Sold by Gianella C.");
    expect(html).toContain("Total: 40 USDC");
    expect(html).toContain("original protected amount of 25 USDC");
    expect(html).toContain("not the 40 USDC resale price");
    expect(html).toContain("Face ID or fingerprint");
    expectBuyerSafe(html);
  });

  it("offers one exact-price purchase action", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseButton priceAmountSubunits="40000000" />,
    );

    expect(html).toContain("Buy for 40 USDC");
    expectBuyerSafe(html);
  });

  it("shows insufficient funds with one concise Retry action", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="insufficient"
        eventName={offer.event.name}
        priceAmountSubunits={offer.price.amountSubunits}
        balanceAmountSubunits="25000000"
      />,
    );

    expect(html).toContain("You need 15 more USDC to buy this Event Pass.");
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });

  it("shows a stale offer with one concise Retry action", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="stale"
        eventName={offer.event.name}
        priceAmountSubunits={offer.price.amountSubunits}
      />,
    );

    expect(html).toContain("This private offer is no longer available.");
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });

  it("shows authoritative success only as final ownership", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="success"
        eventName={offer.event.name}
        priceAmountSubunits={offer.price.amountSubunits}
      />,
    );

    expect(html).toContain("ETH Lima 2026 is now in My passes.");
    expectBuyerSafe(html);
  });

  it("shows a concise inclusion failure with Retry", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="failure"
        eventName={offer.event.name}
        priceAmountSubunits={offer.price.amountSubunits}
      />,
    );

    expect(html).toContain("We couldn&#x27;t finish this purchase. Try again.");
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });

  it("shows a concise private-offer loading failure with Retry", () => {
    const html = renderToStaticMarkup(<EventPassResalePurchaseLoadError />);

    expect(html).toContain(
      "We couldn&#x27;t load your private offers. Try again.",
    );
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });
});
