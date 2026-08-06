import "server-only";

import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";
import { fetchAuthQuery } from "~~/lib/auth-server";
import { loadMintUpWallet, type MintUpWallet } from "~~/lib/mint-up-wallet";
import { createMintUpWalletDependencies } from "~~/lib/mint-up-wallet-provider";
import { createWalletOptions } from "~~/lib/wallet-identities";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";
import { type FunctionReference, anyApi } from "convex/server";
import { createPublicClient, erc20Abi, getAddress, http } from "viem";

const getSessionWallets = anyApi.passesIdentity
  .getSessionWallets as FunctionReference<
  "query",
  "public",
  Record<string, never>,
  {
    embeddedWallet: {
      address?: string;
      provider?: string;
      status: "provisioning" | "ready";
    } | null;
    linkedWallets: Array<{ address: string; chainId: number }>;
  }
>;

const chain =
  eventPassEnvironment.chainId === arbitrumNitro.id
    ? arbitrumNitro
    : arbitrumSepolia;

const client = createPublicClient({ chain, transport: http() });

const dependencies = createMintUpWalletDependencies({
  getNativeBalance: address => client.getBalance({ address }),
  getUsdcBalance: address =>
    client.readContract({
      abi: erc20Abi,
      address: eventPassEnvironment.usdcAddress,
      functionName: "balanceOf",
      args: [address],
    }),
  nativeCurrency: chain.nativeCurrency,
});

export function getMintUpWallet(address: string): Promise<MintUpWallet> {
  return loadMintUpWallet(getAddress(address) as `0x${string}`, dependencies);
}

export async function getMintUpWalletPageData() {
  const sessionWallets = await fetchAuthQuery(getSessionWallets, {});
  const embedded = sessionWallets.embeddedWallet;
  const registeredAddress =
    embedded?.status === "ready" &&
    embedded.provider === "openfort-client" &&
    embedded.address
      ? embedded.address
      : undefined;
  const wallet = registeredAddress
    ? await getMintUpWallet(registeredAddress)
    : null;
  return {
    wallet,
    walletOptions: createWalletOptions(
      wallet?.address,
      sessionWallets.linkedWallets,
    ),
  };
}
