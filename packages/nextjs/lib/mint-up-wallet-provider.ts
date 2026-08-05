import {
  type MintUpWalletDependencies,
  type WalletBalance,
} from "~~/lib/mint-up-wallet";
import { formatUnits, getAddress } from "viem";

type ProviderWallet = { address: string; status: "ready" };

export type MintUpWalletProvider = {
  provisionWallet: () => Promise<ProviderWallet>;
  getNativeBalance: (address: `0x${string}`) => Promise<bigint>;
  getUsdcBalance: (address: `0x${string}`) => Promise<bigint>;
  nativeCurrency: { decimals: number; symbol: string };
};

type ProviderOptions = {
  wait?: (milliseconds: number) => Promise<void>;
  provisioningAttempts?: number;
};

function displayBalance(
  value: bigint,
  decimals: number,
  precision: number,
  symbol: string,
): WalletBalance {
  const [integer, fraction = ""] = formatUnits(value, decimals).split(".");
  const visibleFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return {
    amount: visibleFraction ? `${integer}.${visibleFraction}` : integer,
    symbol,
  };
}

function isProvisioningConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("provisioning is already in progress")
  );
}

export function createMintUpWalletDependencies(
  provider: MintUpWalletProvider,
  {
    wait = milliseconds =>
      new Promise(resolve => setTimeout(resolve, milliseconds)),
    provisioningAttempts = 5,
  }: ProviderOptions = {},
): MintUpWalletDependencies {
  return {
    provisionWallet: async () => {
      for (let attempt = 0; attempt < provisioningAttempts; attempt += 1) {
        try {
          const wallet = await provider.provisionWallet();
          return {
            address: getAddress(wallet.address) as `0x${string}`,
            status: "ready",
          };
        } catch (error) {
          if (!isProvisioningConflict(error)) throw error;
          if (attempt === provisioningAttempts - 1) break;
          await wait(200 * 2 ** attempt);
        }
      }
      return { status: "provisioning" };
    },
    readBalances: async address => {
      const [nativeValue, usdcValue] = await Promise.all([
        provider.getNativeBalance(address),
        provider.getUsdcBalance(address),
      ]);
      return {
        native: displayBalance(
          nativeValue,
          provider.nativeCurrency.decimals,
          6,
          provider.nativeCurrency.symbol,
        ),
        usdc: displayBalance(usdcValue, 6, 2, "USDC"),
      };
    },
  };
}
