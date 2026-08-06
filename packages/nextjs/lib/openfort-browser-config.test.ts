import { describe, expect, it } from "vitest";

import { resolveOpenfortBrowserConfig } from "./openfort-browser-config";

describe("Openfort browser configuration", () => {
  it("enables an already configured wallet without a recovery endpoint", () => {
    expect(
      resolveOpenfortBrowserConfig({
        publishableKey: "pk_test_mint_up",
        shieldPublishableKey: "shield_public_mint_up",
      }),
    ).toEqual({
      publishableKey: "pk_test_mint_up",
      shieldPublishableKey: "shield_public_mint_up",
      recoveryEndpoint: undefined,
      feeSponsorshipId: undefined,
    });
  });

  it("stays disabled when a required public key is absent", () => {
    expect(
      resolveOpenfortBrowserConfig({
        publishableKey: "pk_test_mint_up",
      }),
    ).toBeNull();
  });
});
