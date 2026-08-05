import { describe, expect, it } from "vitest";

import { createMintUpSiweMessage } from "./siwe-message";

describe("Mint Up SIWE challenge", () => {
  it("binds the proof to the canonical domain, URI, signer, chain, and expiry", () => {
    const message = createMintUpSiweMessage({
      address: "0x1111111111111111111111111111111111111111",
      chainId: 421614,
      nonce: "freshnonce123",
      origin: "https://mint-up.xyz",
      expirationTime: new Date("2026-08-05T12:05:00.000Z"),
      issuedAt: new Date("2026-08-05T12:00:00.000Z"),
    });

    expect(message).toContain("mint-up.xyz wants you to sign in");
    expect(message).toContain("URI: https://mint-up.xyz");
    expect(message).toContain("Chain ID: 421614");
    expect(message).toContain("Nonce: freshnonce123");
    expect(message).toContain("Expiration Time: 2026-08-05T12:05:00.000Z");
  });
});
