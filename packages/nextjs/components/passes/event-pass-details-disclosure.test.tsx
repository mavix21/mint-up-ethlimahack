import { describe, expect, it } from "vitest";
// @ts-ignore - react-dom/server types provided at runtime
import { renderToStaticMarkup } from "react-dom/server";

import { EventPassDetailsDisclosure } from "./event-pass-details-disclosure";

const baseProps = {
  saleStartsAt: Date.UTC(2026, 6, 1),
  saleEndsAt: Date.UTC(2026, 7, 8, 14),
  timezone: "America/Lima",
  remaining: 37,
  capacity: 250,
  lifecycle: "scheduled" as const,
  availabilityReason: null as string | null,
  revenueRecipient: "0x2222222222222222222222222222222222222222",
};

describe("EventPassDetailsDisclosure", () => {
  it("renders Paid directly to organizer with Details affordance collapsed by default", () => {
    const html = renderToStaticMarkup(
      <EventPassDetailsDisclosure {...baseProps} />,
    );

    // Primary disclosure line
    expect(html).toContain("Paid directly to organizer");
    // Details affordance — button with accessible name Details and controls disclosure
    expect(html).toMatch(/>Details<\/button>/);
    // Collapsed by default — content hidden attribute present
    expect(html).toContain("hidden");
    // Not expanded initially
    expect(html).toContain('aria-expanded="false"');
  });

  it("aggregates sales window, remaining, status, and refund language inside Details", () => {
    const html = renderToStaticMarkup(
      <EventPassDetailsDisclosure {...baseProps} />,
    );

    expect(html).toContain("Sales window:");
    expect(html).toContain("inclusive");
    expect(html).toContain("exclusive");
    expect(html).toContain("37 of 250 remaining");
    expect(html).toContain("Event status:");
    expect(html).toContain("Scheduled, not cancelled");
    expect(html).toContain(baseProps.revenueRecipient);
    expect(html).toContain("does not escrow funds");
    expect(html).toContain("Cancellation does not automatically return USDC");
  });

  it("includes availability reason and cancelled state when applicable", () => {
    const html = renderToStaticMarkup(
      <EventPassDetailsDisclosure
        {...baseProps}
        lifecycle="cancelled"
        availabilityReason="This Event Pass is sold out"
      />,
    );

    expect(html).toContain("Cancelled");
    expect(html).toContain("This Event Pass is sold out");
  });
});
