import { createPublicClient, http } from "viem";

import {
  arbitrumNitro,
  arbitrumSepolia,
} from "../utils/scaffold-stylus/supportedChains";

export function createEventPassPublicClient(chainId: number) {
  const chain = chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
  if (chainId !== arbitrumNitro.id && chainId !== arbitrumSepolia.id) {
    throw new Error("Red de compra de Event Pass no compatible");
  }
  return createPublicClient({ chain, transport: http() });
}
