import { createPublicClient, http } from "viem";

import {
  arbitrumNitro,
  arbitrumSepolia,
} from "../utils/scaffold-stylus/supportedChains";

export function createEventPassPublicClient(chainId: number) {
  const chain = chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
  if (chainId !== arbitrumNitro.id && chainId !== arbitrumSepolia.id) {
    throw new Error("Unsupported Event Pass purchase network");
  }
  return createPublicClient({ chain, transport: http() });
}
