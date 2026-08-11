// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketplaceResalePurchaseStatus } from "./marketplace-resale-purchase-status";

describe("Marketplace resale onboarding status", () => {
  it.each([
    ["email_unverified", "Verify your email", "verification message"],
    ["blocked", "cannot make purchases", "Contact Mint Up support"],
    [
      "already_has_event_pass",
      "already have an active Event Pass",
      "My passes",
    ],
    ["unavailable", "no longer available", "Back to Marketplace"],
  ] as const)(
    "explains %s without internal details",
    (status, reason, action) => {
      const html = renderToStaticMarkup(
        <MarketplaceResalePurchaseStatus status={status} />,
      );

      expect(html).toContain(reason);
      expect(html).toContain(action);
      expect(html.toLowerCase()).not.toMatch(
        /wallet|gas|hash|transaction|seller|token|0x/,
      );
    },
  );
});
