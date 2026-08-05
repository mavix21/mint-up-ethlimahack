import "server-only";

import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";
import { fetchAuthAction } from "~~/lib/auth-server";
import { loadMintUpWallet, type MintUpWallet } from "~~/lib/mint-up-wallet";
import { createMintUpWalletDependencies } from "~~/lib/mint-up-wallet-provider";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "~~/utils/scaffold-stylus/supportedChains";
import { type FunctionReference, anyApi } from "convex/server";
import { createPublicClient, erc20Abi, http } from "viem";

type ProvisionWalletResult = { address: string; status: "ready" };

const provisionEmbeddedWallet = anyApi.passesIdentityActions
  .provisionEmbeddedWallet as FunctionReference<
  "action",
  "public",
  Record<string, never>,
  ProvisionWalletResult
>;

const chain =
  eventPassEnvironment.chainId === arbitrumNitro.id
    ? arbitrumNitro
    : arbitrumSepolia;

const client = createPublicClient({ chain, transport: http() });

const dependencies = createMintUpWalletDependencies({
  provisionWallet: () => fetchAuthAction(provisionEmbeddedWallet, {}),
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

export function getMintUpWallet(): Promise<MintUpWallet> {
  return loadMintUpWallet(dependencies);
}
