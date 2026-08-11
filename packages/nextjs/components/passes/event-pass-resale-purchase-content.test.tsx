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

    expect(html).toContain("Pass resale");
    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("Total: 40 USDC");
    expect(html).toContain("Available balance: 55 USDC");
    expect(html).toContain("Mint Up fee: 9% included");
    expect(html).toContain("Protected payment: 25 USDC");
    expect(html).toContain("If the Event is cancelled");
    expect(html).toContain("This purchase is final");
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

  it("shows balance, total, and deficit when funds are insufficient", () => {
    const html = renderToStaticMarkup(
      <EventPassResalePurchaseContent
        state="insufficient"
        eventName={listing.event.name}
        priceAmountSubunits={listing.price.amountSubunits}
        balanceAmountSubunits="25000000"
      />,
    );

    expect(html).toContain("You need 15 more USDC to buy this Event Pass.");
    expect(html).toContain("Available balance: 25 USDC");
    expect(html).toContain("Total: 40 USDC");
    expect(html).toContain("Retry");
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
      "We couldn&#x27;t check your USDC balance. Try again.",
    );
    expect(html).toContain("Retry");
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

    expect(html).toContain("This Pass resale is no longer available");
    expect(html).toContain("Another buyer may have completed it first.");
    expect(html).toContain("You won&#x27;t be charged.");
    expect(html).toContain("Back to Marketplace");
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

    expect(html).toContain("ETH Lima 2026 is now in My passes.");
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

    expect(html).toContain("Another buyer may have completed it first");
    expect(html).toContain("you won&#x27;t be charged");
    expect(html).toContain("Retry");
    expect(html).toContain("Back to Marketplace");
    expectBuyerSafe(html);
  });

  it("shows a concise Marketplace loading failure with Retry", () => {
    const html = renderToStaticMarkup(<EventPassResalePurchaseLoadError />);

    expect(html).toContain(
      "We couldn&#x27;t load this Pass resale. Try again.",
    );
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });
});
