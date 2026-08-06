import { describe, expect, it, vi } from "vitest";

import { loadMintUpWallet } from "./mint-up-wallet";
import {
  createMintUpWalletDependencies,
  type MintUpWalletProvider,
} from "./mint-up-wallet-provider";

const address = "0x1111111111111111111111111111111111111111";

function provider(
  overrides: Partial<MintUpWalletProvider> = {},
): MintUpWalletProvider {
  return {
    getNativeBalance: vi.fn(async () => 1_234_000_000_000_000n),
    getUsdcBalance: vi.fn(async () => 42_500_000n),
    nativeCurrency: { decimals: 18, symbol: "ETH" },
    ...overrides,
  };
}

describe("Openfort wallet provider boundary", () => {
  it("retrieves and formats native and USDC balances for the embedded address", async () => {
    const gateway = provider();
    const wallet = await loadMintUpWallet(
      address,
      createMintUpWalletDependencies(gateway),
    );

    expect(gateway.getNativeBalance).toHaveBeenCalledWith(address);
    expect(gateway.getUsdcBalance).toHaveBeenCalledWith(address);
    expect(wallet.balances).toEqual({
      native: { amount: "0.001234", symbol: "ETH" },
      usdc: { amount: "42.5", symbol: "USDC" },
    });
    expect(wallet.recovery).toEqual({
      provider: "Openfort",
      method: "better-auth",
      requiresIdentityProof: true,
    });
  });
});
