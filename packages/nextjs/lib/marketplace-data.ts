import "server-only";

import { fetchAction, fetchQuery } from "convex/nextjs";

import {
  listEventPassMarketplace,
  reconcileEventPassMarketplace,
} from "./event-pass-resale-api";
import { resaleMarketplaceSchema } from "./marketplace";

export async function listPassResales() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return [];
  try {
    await fetchAction(reconcileEventPassMarketplace, {}, { url });
    return resaleMarketplaceSchema.parse(
      await fetchQuery(listEventPassMarketplace, {}, { url }),
    );
  } catch {
    return [];
  }
}
