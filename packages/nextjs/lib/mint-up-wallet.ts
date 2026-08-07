export type WalletBalance = {
  amount: string;
  symbol: string;
};

export type WalletBalances =
  { native: WalletBalance; usdc: WalletBalance } | { error: string };

export type MintUpWalletDependencies = {
  readBalances: (address: `0x${string}`) => Promise<{
    native: WalletBalance;
    usdc: WalletBalance;
  }>;
};

export type MintUpWallet = {
  address: `0x${string}`;
  balances: WalletBalances;
  recovery: {
    provider: "SmartAccount";
    method: "passkey";
    requiresIdentityProof: true;
  };
};

export async function loadMintUpWallet(
  address: `0x${string}`,
  { readBalances }: MintUpWalletDependencies,
): Promise<MintUpWallet> {
  let balances: WalletBalances;
  try {
    balances = await readBalances(address);
  } catch {
    balances = {
      error:
        "Balances are temporarily unavailable. Check the network and try again.",
    };
  }

  return {
    address,
    balances,
    recovery: {
      provider: "SmartAccount",
      method: "passkey",
      requiresIdentityProof: true,
    },
  };
}
