import { describe, expect, it } from "vitest";

import type { PurchaseStatus } from "./event-pass-purchase-api";
import {
  EARLY_BIRDS_RETURN_PARAM,
  EARLY_BIRDS_RETURN_VALUE,
  getEarlyBirdsRedirectUrl,
  getEventPassHref,
  resolveEarlyBirdsReturnDestination,
} from "./early-birds-return";

const trustedOrigins = ["https://mint-up.xyz"];

describe("resolveEarlyBirdsReturnDestination", () => {
  it("accepts a localized Mint Up home destination", () => {
    expect(
      resolveEarlyBirdsReturnDestination(
        "https://mint-up.xyz/en/?earlybirds=return",
        trustedOrigins,
      ),
    ).toBe("https://mint-up.xyz/en/?earlybirds=return");
  });

  it("accepts an /early-birds localized route", () => {
    expect(
      resolveEarlyBirdsReturnDestination(
        "https://mint-up.xyz/es/early-birds",
        trustedOrigins,
      ),
    ).toBe("https://mint-up.xyz/es/early-birds?earlybirds=return");
  });

  it.each([
    "https://mint-up.xyz/en/",
    "https://mint-up.xyz/es/",
    "https://mint-up.xyz/en/early-birds",
    "https://mint-up.xyz/es/early-birds",
  ])("adds the navigation hint to %s", destination => {
    const resolved = resolveEarlyBirdsReturnDestination(
      destination,
      trustedOrigins,
    );
    expect(resolved).not.toBeNull();
    expect(new URL(resolved!).searchParams.get(EARLY_BIRDS_RETURN_PARAM)).toBe(
      EARLY_BIRDS_RETURN_VALUE,
    );
  });

  it.each([
    null,
    undefined,
    "",
    "not-a-url",
    "https://evil.example/en/",
    "https://mint-up.xyz.evil.example/en/",
    "http://mint-up.xyz/en/",
    "https://mint-up.xyz/account",
    "https://mint-up.xyz/en/account",
    "https://mint-up.xyz/en/home",
    "https://mint-up.xyz/en/early-birds/admin",
    "https://mint-up.xyz/en/early-birds%2F..%2Fadmin",
    "//mint-up.xyz/en/",
    "javascript:alert(1)",
    "https://user:pass@mint-up.xyz/en/",
  ])("rejects an untrusted or unsafe destination: %s", destination => {
    expect(
      resolveEarlyBirdsReturnDestination(destination, trustedOrigins),
    ).toBeNull();
  });

  it("strips query parameters other than the navigation hint", () => {
    expect(
      resolveEarlyBirdsReturnDestination(
        "https://mint-up.xyz/en/early-birds?next=https://evil.example",
        trustedOrigins,
      ),
    ).toBe("https://mint-up.xyz/en/early-birds?earlybirds=return");
  });

  it("rejects a destination without a supported locale prefix", () => {
    expect(
      resolveEarlyBirdsReturnDestination(
        "https://mint-up.xyz/",
        trustedOrigins,
      ),
    ).toBeNull();
  });

  it("preserves a supplied participant locale in the returned URL", () => {
    const resolved = resolveEarlyBirdsReturnDestination(
      "https://mint-up.xyz/es/",
      trustedOrigins,
    );
    expect(resolved).toBe("https://mint-up.xyz/es/?earlybirds=return");
  });

  it("only trusts origins it is configured with", () => {
    expect(
      resolveEarlyBirdsReturnDestination("https://mint-up.xyz/en/", [
        "https://passes.example",
      ]),
    ).toBeNull();
  });
});

describe("getEventPassHref", () => {
  it("returns the plain event pass path without a return destination", () => {
    expect(getEventPassHref("event_eth_lima_2026")).toBe(
      "/passes/event_eth_lima_2026",
    );
  });

  it("appends an encoded return destination", () => {
    const href = getEventPassHref(
      "event_eth_lima_2026",
      "https://mint-up.xyz/en/?earlybirds=return",
    );
    expect(href.startsWith("/passes/event_eth_lima_2026?returnTo=")).toBe(true);
    const url = new URL(href, "https://passes.local");
    expect(url.searchParams.get("returnTo")).toBe(
      "https://mint-up.xyz/en/?earlybirds=return",
    );
  });

  it("round-trips through the resolver when read back from the URL", () => {
    const href = getEventPassHref(
      "event_eth_lima_2026",
      "https://mint-up.xyz/en/",
    );
    const url = new URL(href, "https://passes.local");
    expect(
      resolveEarlyBirdsReturnDestination(
        url.searchParams.get("returnTo"),
        trustedOrigins,
      ),
    ).toBe("https://mint-up.xyz/en/?earlybirds=return");
  });

  it("escapes the event id", () => {
    expect(getEventPassHref("eth/lima")).toBe("/passes/eth%2Flima");
  });
});

describe("getEarlyBirdsRedirectUrl", () => {
  const returnTo = "https://mint-up.xyz/en/?earlybirds=return";

  it("redirects to the destination only on a confirmed acquisition", () => {
    expect(getEarlyBirdsRedirectUrl(returnTo, "confirmed", true)).toBe(
      returnTo,
    );
  });

  it.each<PurchaseStatus["status"] | undefined>([
    "awaitingSubmission",
    "synchronizing",
    "rejected",
    undefined,
  ])("does not redirect on %s", status => {
    expect(getEarlyBirdsRedirectUrl(returnTo, status, true)).toBeNull();
  });

  it("does not redirect when the local purchase is not confirmed", () => {
    expect(getEarlyBirdsRedirectUrl(returnTo, "confirmed", false)).toBeNull();
  });

  it("does not redirect without a validated destination", () => {
    expect(getEarlyBirdsRedirectUrl(null, "confirmed", true)).toBeNull();
    expect(getEarlyBirdsRedirectUrl(undefined, "confirmed", true)).toBeNull();
  });
});
