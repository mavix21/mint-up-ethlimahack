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
        <button>Put up for resale</button>
      ) : null,
    );

    expect(html).not.toContain("Put up for resale");
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
        <button>Put up for resale</button>
      ) : null,
    );

    expect(html).toContain("Put up for resale");
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
        <button>Put up for resale</button>
      ) : null,
    );

    expect(html).not.toContain("Put up for resale");
  });

  it("renders a human email and USDC form for an eligible pass", () => {
    const html = renderToStaticMarkup(
      <EventPassResaleContent state="form" eventName="ETH Lima 2026" />,
    );

    expect(html).toContain("Buyer email");
    expect(html).toContain('type="email"');
    expect(html).toContain("Price in USDC");
    expect(html).toContain('inputMode="decimal"');
    expectBuyerSafe(html);
  });

  it.each(["create", "replace"] as const)(
    "reviews %s with one biometric confirmation",
    kind => {
      const html = renderToStaticMarkup(
        <EventPassResaleContent
          state="review"
          eventName="ETH Lima 2026"
          action={kind}
          buyerName="Gianna"
          buyerEmail="gianna@example.com"
          price="25.50"
        />,
      );

      expect(html).toContain(
        kind === "replace" ? "Replace offer" : "Create offer",
      );
      expect(html).toContain("25.50 USDC");
      expect(html).toContain("Confirm with Face ID or fingerprint");
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

    expect(html).toContain("Withdraw offer");
    expect(html).toContain("You keep your Event Pass");
    expect(html).toContain("No USDC moves");
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

    expect(pending).toContain("Confirming your offer");
    expect(pending).not.toContain("has been replaced");
    expect(failure).toContain("Try again");
    expect(failure).toContain("Retry");
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
      "Enter a valid email and a positive USDC price with up to 6 decimals.",
    );
    expect(html).toContain("Retry");
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

    expect(html).toContain("Offer unavailable");
    expect(html).not.toContain("Replace offer");
    expect(html).not.toContain("Withdraw offer");
    expectBuyerSafe(html);
  });
});
