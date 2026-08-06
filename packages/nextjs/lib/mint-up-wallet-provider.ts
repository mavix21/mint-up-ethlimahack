import {
  type MintUpWalletDependencies,
  type WalletBalance,
} from "~~/lib/mint-up-wallet";
import { formatUnits } from "viem";

export type MintUpWalletProvider = {
  getNativeBalance: (address: `0x${string}`) => Promise<bigint>;
  getUsdcBalance: (address: `0x${string}`) => Promise<bigint>;
  nativeCurrency: { decimals: number; symbol: string };
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

export function createMintUpWalletDependencies(
  provider: MintUpWalletProvider,
): MintUpWalletDependencies {
  return {
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
