import { describe, expect, it } from "@jest/globals";
import { resolveEventPassEnvironment } from "../../../nextjs/contracts/eventPassEnvironment";

describe("Event Pass environment configuration", () => {
  it("selects complete local and Sepolia values and rejects invalid environments", () => {
    expect(resolveEventPassEnvironment({ environment: "local" })).toMatchObject(
      {
        chainId: 412346,
        eventPassAddress: "0xab8e440727a38bbb180f7032ca4a8009e7b52b80",
        usdcAddress: "0x75e0e92a79880bd81a69f72983d03c75e2b33dc8",
      },
    );

    expect(
      resolveEventPassEnvironment({
        environment: "sepolia",
        eventPassAddress: "0x1111111111111111111111111111111111111111",
      }),
    ).toMatchObject({
      chainId: 421614,
      eventPassAddress: "0x1111111111111111111111111111111111111111",
      usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    });

    expect(() =>
      resolveEventPassEnvironment({ environment: "sepolia" }),
    ).toThrow("Arbitrum Sepolia Event Pass address");
    expect(() =>
      resolveEventPassEnvironment({ environment: "mainnet" }),
    ).toThrow("Unsupported Event Pass environment");
  });
});
