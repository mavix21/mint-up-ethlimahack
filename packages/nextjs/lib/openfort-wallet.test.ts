import { describe, expect, it } from "vitest";

import { selectOpenfortEoa } from "./openfort-wallet";

const first = {
  accountType: "Externally Owned Account",
  address: "0x1111111111111111111111111111111111111111",
  chainType: "EVM",
};
const second = {
  accountType: "Externally Owned Account",
  address: "0x2222222222222222222222222222222222222222",
  chainType: "EVM",
};

describe("Openfort wallet discovery", () => {
  it("reuses the first discovered EOA instead of creating another", () => {
    expect(selectOpenfortEoa([first, second])).toBe(first);
  });

  it("restores the registered EOA when the user has duplicate accounts", () => {
    expect(
      selectOpenfortEoa([first, second], second.address.toUpperCase()),
    ).toBe(second);
  });

  it("reuses a discovered EOA when the registered projection is stale", () => {
    expect(
      selectOpenfortEoa(
        [first, second],
        "0x3333333333333333333333333333333333333333",
      ),
    ).toBe(first);
  });
});
