import "server-only";

import { parseAbi } from "viem";

import { eventPassEnvironment } from "../contracts/eventPassEnvironment";
import { fetchAuthQuery } from "./auth-server";
import { getCurrentEventPassResaleListing } from "./event-pass-resale-api";
import { createEventPassPublicClient } from "./event-pass-public-client";
import {
  type ResaleListing,
  resaleListingSchema,
} from "./event-pass-resale-schema";

const configAbi = parseAbi([
  "function config() view returns (address administrator, address usdc, address authorization_signer, address fee_recipient, uint16 primary_fee_bps, uint16 resale_fee_bps, bool paused)",
]);

export function getEventPassResaleNow() {
  return Date.now();
}

export async function isEventPassResaleContractActive() {
  try {
    const config = await createEventPassPublicClient(
      eventPassEnvironment.chainId,
    ).readContract({
      address: eventPassEnvironment.eventPassAddress,
      abi: configAbi,
      functionName: "config",
    });
    return !config[6];
  } catch {
    return false;
  }
}

export async function fetchCurrentResaleListing(
  passId: string,
): Promise<ResaleListing | null> {
  try {
    const result = await fetchAuthQuery(getCurrentEventPassResaleListing, {
      passId,
    });
    return result === null ? null : resaleListingSchema.parse(result);
  } catch {
    return null;
  }
}
