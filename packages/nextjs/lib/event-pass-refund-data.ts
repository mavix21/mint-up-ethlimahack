import "server-only";

import { parseAbi } from "viem";

import { eventPassEnvironment } from "../contracts/eventPassEnvironment";
import { createEventPassPublicClient } from "./event-pass-public-client";

const refundInfoAbi = parseAbi([
  "function passRefundInfo(uint64 pass_id) view returns (uint64 original_price, bool refunded, bool refund_available)",
]);

export async function fetchEventPassRefundAmount(passId: string) {
  try {
    const [originalPrice] = await createEventPassPublicClient(
      eventPassEnvironment.chainId,
    ).readContract({
      address: eventPassEnvironment.eventPassAddress,
      abi: refundInfoAbi,
      functionName: "passRefundInfo",
      args: [BigInt(passId)],
    });
    return originalPrice.toString();
  } catch {
    return null;
  }
}
