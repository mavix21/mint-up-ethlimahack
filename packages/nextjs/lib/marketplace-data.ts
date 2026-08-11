import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cacheLife, cacheTag } from "next/cache";

import { listEventPassMarketplace } from "./event-pass-resale-api";
import { resaleMarketplaceSchema } from "./marketplace";

export async function listPassResales() {
  "use cache";
  cacheLife({ stale: 5, revalidate: 5, expire: 15 });
  cacheTag("event-pass-resales");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return [];
  try {
    return resaleMarketplaceSchema.parse(
      await fetchQuery(listEventPassMarketplace, {}, { url }),
    );
  } catch {
    return [];
  }
}
