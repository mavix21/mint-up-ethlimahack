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
    provisionWallet: vi.fn(async () => ({ address, status: "ready" }) as const),
    getNativeBalance: vi.fn(async () => 1_234_000_000_000_000n),
    getUsdcBalance: vi.fn(async () => 42_500_000n),
    nativeCurrency: { decimals: 18, symbol: "ETH" },
    ...overrides,
  };
}

describe("Openfort wallet provider boundary", () => {
  it("recovers the winning wallet after a concurrent provisioning conflict", async () => {
    const provisionWallet = vi
      .fn<MintUpWalletProvider["provisionWallet"]>()
      .mockRejectedValueOnce(
        new Error("Wallet provisioning is already in progress"),
      )
      .mockResolvedValue({ address, status: "ready" });
    const wait = vi.fn(async () => undefined);

    const wallet = await loadMintUpWallet(
      createMintUpWalletDependencies(provider({ provisionWallet }), { wait }),
    );

    expect(wallet.address).toBe(address);
    expect(provisionWallet).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(200);
  });

  it("projects the same address for repeated restored sessions", async () => {
    const gateway = provider();
    const dependencies = createMintUpWalletDependencies(gateway);

    const first = await loadMintUpWallet(dependencies);
    const restored = await loadMintUpWallet(dependencies);

    expect(first.address).toBe(address);
    expect(restored.address).toBe(address);
    expect(gateway.provisionWallet).toHaveBeenCalledTimes(2);
  });

  it("retrieves and formats native and USDC balances for the embedded address", async () => {
    const gateway = provider();
    const wallet = await loadMintUpWallet(
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

  it("rejects an invalid provider address without exposing it as a wallet", async () => {
    const result = loadMintUpWallet(
      createMintUpWalletDependencies(
        provider({
          provisionWallet: vi.fn(
            async () =>
              ({
                address: "provider-secret",
                status: "ready",
              }) as const,
          ),
        }),
      ),
    );

    await expect(result).rejects.toMatchObject({
      message:
        "We could not prepare your Mint Up Wallet. Try again in a moment.",
    });
  });
});
