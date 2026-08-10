import { describe, expect, it } from "vitest";

import { parseHumanUsdc } from "./event-pass-resale-schema";

describe("human USDC resale price", () => {
  it.each([
    ["1", "1000000"],
    ["2.5", "2500000"],
    ["0.000001", "1"],
    [" 12.340000 ", "12340000"],
  ])("converts %s without floating-point arithmetic", (price, subunits) => {
    expect(parseHumanUsdc(price)).toBe(subunits);
  });

  it.each(["", "0", "0.0", "-1", "+1", "1.", ".5", "1.0000001", "1,5", "NaN"])(
    "rejects malformed or non-positive price %s",
    price => {
      expect(() => parseHumanUsdc(price)).toThrow(
        "Enter a positive USDC price",
      );
    },
  );
});
