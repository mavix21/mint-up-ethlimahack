export type WalletBalance = {
  amount: string;
  symbol: string;
};

export type WalletBalances =
  | { native: WalletBalance; usdc: WalletBalance }
  | { error: string };

type WalletProjection =
  | { address: `0x${string}`; status: "ready" }
  | { status: "provisioning" };

export type MintUpWalletDependencies = {
  provisionWallet: () => Promise<WalletProjection>;
  readBalances: (address: `0x${string}`) => Promise<{
    native: WalletBalance;
    usdc: WalletBalance;
  }>;
};

export type MintUpWallet = {
  address: `0x${string}`;
  balances: WalletBalances;
  recovery: {
    provider: "Openfort";
    method: "better-auth";
    requiresIdentityProof: true;
  };
};

export class WalletLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletLoadError";
  }
}

export async function loadMintUpWallet({
  provisionWallet,
  readBalances,
}: MintUpWalletDependencies): Promise<MintUpWallet> {
  let projection: WalletProjection;
  try {
    projection = await provisionWallet();
  } catch {
    throw new WalletLoadError(
      "We could not prepare your Mint Up Wallet. Try again in a moment.",
    );
  }

  if (projection.status === "provisioning") {
    throw new WalletLoadError(
      "Your Mint Up Wallet is still being prepared. Try again shortly.",
    );
  }

  let balances: WalletBalances;
  try {
    balances = await readBalances(projection.address);
  } catch {
    balances = {
      error:
        "Balances are temporarily unavailable. Check the network and try again.",
    };
  }

  return {
    address: projection.address,
    balances,
    recovery: {
      provider: "Openfort",
      method: "better-auth",
      requiresIdentityProof: true,
    },
  };
}
