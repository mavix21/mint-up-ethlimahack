// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isEventPassTransferEligible } from "../../lib/event-pass-transfer-eligibility";
import { EventPassTransferContent } from "./event-pass-transfer-content";

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
  "USDC",
  "0x1111111111111111111111111111111111111111",
  "Event Pass #42",
];

function expectBuyerSafe(html: string) {
  for (const term of forbidden)
    expect(html.toLowerCase()).not.toContain(term.toLowerCase());
}

describe("Event Pass transfer rendered states", () => {
  it("shows Transfer only for an eligible Event Pass", () => {
    const pass = {
      validity: { status: "valid" as const },
      cancellation: { status: "active" as const },
      transfer: { status: "transferable" as const },
      checkIn: { status: "notRecorded" },
    };
    const eligible = renderToStaticMarkup(
      isEventPassTransferEligible(pass, true) ? (
        <button>Transfer</button>
      ) : null,
    );
    const ineligible = renderToStaticMarkup(
      isEventPassTransferEligible(
        { ...pass, cancellation: { status: "cancelled" } },
        true,
      ) ? (
        <button>Transfer</button>
      ) : null,
    );

    expect(eligible).toContain("Transfer");
    expect(ineligible).not.toContain("Transfer");
  });

  it("reviews the Event and safe recipient with one biometric confirmation", () => {
    const html = renderToStaticMarkup(
      <EventPassTransferContent
        state="review"
        eventName="ETH Lima 2026"
        recipientName="Gianna"
        recipientEmail="gianna@example.com"
      />,
    );

    expect(html).toContain("ETH Lima 2026");
    expect(html).toContain("Gianna");
    expect(html).toContain("gianna@example.com");
    expect(html).toContain("Free transfer");
    expect(html).toContain("Confirm with Face ID or fingerprint");
    expectBuyerSafe(html);
  });

  it("keeps pending state non-authoritative", () => {
    const html = renderToStaticMarkup(
      <EventPassTransferContent state="pending" eventName="ETH Lima 2026" />,
    );

    expect(html).toContain("Confirming your transfer");
    expect(html).not.toContain("has been transferred");
    expectBuyerSafe(html);
  });

  it("renders success only as a verified completed state", () => {
    const html = renderToStaticMarkup(
      <EventPassTransferContent
        state="success"
        eventName="ETH Lima 2026"
        recipientName="Gianna"
      />,
    );

    expect(html).toContain("has been transferred to Gianna");
    expectBuyerSafe(html);
  });

  it("uses the same actionable message for an unavailable recipient", () => {
    const html = renderToStaticMarkup(
      <EventPassTransferContent
        state="failure"
        eventName="ETH Lima 2026"
        failure="recipient"
      />,
    );

    expect(html).toContain(
      "Ask them to secure their passes, then check the email and try again.",
    );
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });

  it("renders concise retry for preparation, signing, inclusion, or reconciliation failures", () => {
    const html = renderToStaticMarkup(
      <EventPassTransferContent
        state="failure"
        eventName="ETH Lima 2026"
        failure="operation"
      />,
    );

    expect(html).toContain(
      "We couldn&#x27;t complete the transfer. Try again.",
    );
    expect(html).toContain("Retry");
    expectBuyerSafe(html);
  });
});
