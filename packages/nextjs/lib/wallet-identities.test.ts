import { describe, expect, it } from "vitest";

import { createWalletOptions } from "./wallet-identities";

describe("verified wallet selector", () => {
  it("keeps the embedded wallet and every verified external wallet distinct", () => {
    expect(
      createWalletOptions("0x1111111111111111111111111111111111111111", [
        {
          address: "0x2222222222222222222222222222222222222222",
          chainId: 421614,
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          chainId: 421614,
        },
      ]),
    ).toEqual([
      {
        id: "embedded:0x1111111111111111111111111111111111111111",
        kind: "embedded",
        address: "0x1111111111111111111111111111111111111111",
      },
      {
        id: "linked:421614:0x2222222222222222222222222222222222222222",
        kind: "linked",
        address: "0x2222222222222222222222222222222222222222",
        chainId: 421614,
      },
      {
        id: "linked:421614:0x3333333333333333333333333333333333333333",
        kind: "linked",
        address: "0x3333333333333333333333333333333333333333",
        chainId: 421614,
      },
    ]);
  });

  it("rejects malformed wallet projections instead of presenting them as verified", () => {
    expect(() =>
      createWalletOptions("0x1111111111111111111111111111111111111111", [
        { address: "not-an-address", chainId: 421614 },
      ]),
    ).toThrow("Invalid verified wallet projection");
  });
});
