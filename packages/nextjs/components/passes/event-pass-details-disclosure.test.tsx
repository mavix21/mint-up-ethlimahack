// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventPassDetailsDisclosure } from "./event-pass-details-disclosure";

const baseProps = {
  saleStartsAt: Date.UTC(2026, 6, 1),
  saleEndsAt: Date.UTC(2026, 7, 8, 14),
  timezone: "America/Lima",
  remaining: 37,
  capacity: 250,
  lifecycle: "scheduled" as const,
  availabilityReason: null as string | null,
};

describe("EventPassDetailsDisclosure", () => {
  it("explains Protected payment without exposing payment infrastructure", () => {
    const html = renderToStaticMarkup(
      <EventPassDetailsDisclosure {...baseProps} />,
    );

    expect(html).toContain("Protected payment");
    expect(html).toContain("full original price");
    expect(html).toContain("Sales window:");
    expect(html).toContain("37 of 250 remaining");
    expect(html).not.toContain("Paid directly to organizer");
    expect(html).not.toContain(
      "Cancellation does not automatically return USDC",
    );
    expect(html).not.toMatch(/0x[0-9a-f]{40}/i);
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
