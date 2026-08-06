import "server-only";

import { createPublicClient, getAddress, http, parseAbi } from "viem";

import { eventPassEnvironment } from "../contracts/eventPassEnvironment";
import {
  arbitrumNitro,
  arbitrumSepolia,
} from "../utils/scaffold-stylus/supportedChains";
import type { PreparedPurchase } from "./event-pass-purchase-api";

const availabilityAbi = parseAbi([
  "function config() view returns (address administrator, address usdc, bool paused)",
  "function eventInfo(bytes32 event_id) view returns (address revenue_recipient, uint64 price, uint32 maximum_supply, uint32 issued_supply, uint64 sale_start, uint64 sale_end, bool sales_enabled, bool transfers_enabled, bool cancelled, address check_in_operator)",
]);

export async function verifyPreparedPurchaseAvailability(
  purchase: PreparedPurchase,
) {
  if (
    purchase.chainId !== eventPassEnvironment.chainId ||
    getAddress(purchase.contractAddress) !==
      getAddress(eventPassEnvironment.eventPassAddress) ||
    getAddress(purchase.paymentAssetAddress) !==
      getAddress(eventPassEnvironment.usdcAddress)
  ) {
    throw new Error("Prepared purchase uses an unsupported network");
  }
  const chain =
    purchase.chainId === arbitrumNitro.id ? arbitrumNitro : arbitrumSepolia;
  const client = createPublicClient({ chain, transport: http() });
  const [config, event, block] = await Promise.all([
    client.readContract({
      address: purchase.contractAddress,
      abi: availabilityAbi,
      functionName: "config",
    }),
    client.readContract({
      address: purchase.contractAddress,
      abi: availabilityAbi,
      functionName: "eventInfo",
      args: [purchase.eventIdentifier as `0x${string}`],
    }),
    client.getBlock(),
  ]);
  const [, usdc, paused] = config;
  const [
    revenueRecipient,
    price,
    maximumSupply,
    issuedSupply,
    saleStart,
    saleEnd,
    salesEnabled,
    ,
    cancelled,
  ] = event;
  if (
    getAddress(usdc) !== getAddress(purchase.paymentAssetAddress) ||
    getAddress(revenueRecipient) !== getAddress(purchase.revenueRecipient) ||
    price !== BigInt(purchase.priceAmountSubunits) ||
    paused ||
    !salesEnabled ||
    cancelled ||
    issuedSupply >= maximumSupply ||
    block.timestamp < saleStart ||
    block.timestamp >= saleEnd
  ) {
    throw new Error("Prepared purchase is no longer available onchain");
  }
}
