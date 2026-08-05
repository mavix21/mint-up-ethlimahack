import { describe, expect, it, vi } from "vitest";

import {
  WalletLoadError,
  loadMintUpWallet,
  type MintUpWalletDependencies,
} from "./mint-up-wallet";

const address = "0x1111111111111111111111111111111111111111" as const;

function dependencies(
  overrides: Partial<MintUpWalletDependencies> = {},
): MintUpWalletDependencies {
  return {
    provisionWallet: vi.fn(async () => ({ address, status: "ready" }) as const),
    readBalances: vi.fn(async () => ({
      native: { amount: "0.0123", symbol: "ETH" },
      usdc: { amount: "42.50", symbol: "USDC" },
    })),
    ...overrides,
  };
}

describe("Mint Up Wallet provider boundary", () => {
  it("recovers the same embedded wallet across repeated and concurrent sessions", async () => {
    const deps = dependencies();

    const wallets = await Promise.all([
      loadMintUpWallet(deps),
      loadMintUpWallet(deps),
      loadMintUpWallet(deps),
    ]);
    const restored = await loadMintUpWallet(deps);

    expect(wallets.map(wallet => wallet.address)).toEqual([
      address,
      address,
      address,
    ]);
    expect(restored.address).toBe(address);
  });

  it("returns the address, relevant balances, and accurate recovery metadata", async () => {
    const wallet = await loadMintUpWallet(dependencies());

    expect(wallet).toEqual({
      address,
      balances: {
        native: { amount: "0.0123", symbol: "ETH" },
        usdc: { amount: "42.50", symbol: "USDC" },
      },
      recovery: {
        provider: "Openfort",
        method: "better-auth",
        requiresIdentityProof: true,
      },
    });
  });

  it("keeps a ready wallet visible when balance retrieval fails", async () => {
    const wallet = await loadMintUpWallet(
      dependencies({
        readBalances: vi.fn(async () => {
          throw new Error("rpc.internal: upstream key leaked");
        }),
      }),
    );

    expect(wallet.address).toBe(address);
    expect(wallet.balances).toEqual({
      error:
        "Balances are temporarily unavailable. Check the network and try again.",
    });
  });

  it("turns provider failures into a safe actionable provisioning error", async () => {
    const result = loadMintUpWallet(
      dependencies({
        provisionWallet: vi.fn(async () => {
          throw new Error("Openfort secret sk_live_sensitive failed");
        }),
      }),
    );

    await expect(result).rejects.toEqual(
      new WalletLoadError(
        "We could not prepare your Mint Up Wallet. Try again in a moment.",
      ),
    );
    await expect(result).rejects.not.toThrow(/sk_live_sensitive/);
  });

  it("reports an in-progress wallet without exposing a provider error", async () => {
    const result = loadMintUpWallet(
      dependencies({
        provisionWallet: vi.fn(
          async () => ({ status: "provisioning" }) as const,
        ),
      }),
    );

    await expect(result).rejects.toEqual(
      new WalletLoadError(
        "Your Mint Up Wallet is still being prepared. Try again shortly.",
      ),
    );
  });
});
