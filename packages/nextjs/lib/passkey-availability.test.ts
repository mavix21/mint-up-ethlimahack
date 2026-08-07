import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  availabilityMessage,
  getPasskeyAvailability,
  isAvailabilityBlocking,
  isWebAuthnSupported,
} from "./passkey-availability";

describe("passkey availability", () => {
  const original = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    // @ts-ignore
    globalThis.window = original;
  });

  it("detects unsupported browser when PublicKeyCredential missing", async () => {
    // @ts-ignore
    globalThis.window = {} as unknown as Window & typeof globalThis;
    expect(isWebAuthnSupported()).toBe(false);
    const avail = await getPasskeyAvailability();
    expect(avail.supported).toBe(false);
    expect(avail.reason).toBe("unsupported_browser");
    expect(isAvailabilityBlocking(avail)).toBe(true);
    expect(availabilityMessage(avail)).toMatch(/not supported/i);
  });

  it("detects platform authenticator unavailable", async () => {
    // @ts-ignore
    globalThis.window = {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => false,
        isConditionalMediationAvailable: async () => true,
      },
    } as unknown as Window & typeof globalThis;
    const avail = await getPasskeyAvailability();
    expect(avail.supported).toBe(true);
    expect(avail.platformAuthenticatorAvailable).toBe(false);
    expect(isAvailabilityBlocking(avail)).toBe(true);
    expect(availabilityMessage(avail)).toMatch(/No platform authenticator/i);
  });

  it("supported when PublicKeyCredential present and platform available", async () => {
    // @ts-ignore
    globalThis.window = {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
        isConditionalMediationAvailable: async () => false,
      },
    } as unknown as Window & typeof globalThis;
    const avail = await getPasskeyAvailability();
    expect(avail.supported).toBe(true);
    expect(isAvailabilityBlocking(avail)).toBe(false);
  });
});
