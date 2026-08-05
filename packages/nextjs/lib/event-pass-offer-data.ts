import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cacheLife, cacheTag } from "next/cache";

import { eligibleOfferPayload } from "../tests/fixtures/event-pass-offers";
import { parseOffer, parseOfferCatalog } from "./event-pass-offers";
import { mintUpApi } from "./mint-up-api";

function fixtureEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PASSES_E2E_FIXTURES === "1"
  );
}

function queryOptions() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required");
  return { url };
}

async function getCachedOfferCatalog() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag("event-pass-offers");
  try {
    return fixtureEnabled()
      ? { offers: [eligibleOfferPayload] }
      : await fetchQuery(mintUpApi.eventPassOffers.list, {}, queryOptions());
  } catch {
    return null;
  }
}

export async function listEventPassOffers() {
  "use cache";
  cacheLife({ stale: 1, revalidate: 1, expire: 2 });
  cacheTag("event-pass-offers-availability");
  try {
    const response = await getCachedOfferCatalog();
    return response === null
      ? []
      : parseOfferCatalog(response).filter(
          offer => offer.availability.kind === "available",
        );
  } catch {
    return [];
  }
}

async function getCachedEventPassOffer(eventId: string) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag("event-pass-offers", `event-pass-offer-${eventId}`);
  try {
    return fixtureEnabled()
      ? eventId === eligibleOfferPayload.eventId
        ? eligibleOfferPayload
        : null
      : await fetchQuery(
          mintUpApi.eventPassOffers.getByEventId,
          { eventId },
          queryOptions(),
        );
  } catch {
    return null;
  }
}

export async function getEventPassOffer(eventId: string) {
  "use cache";
  cacheLife({ stale: 1, revalidate: 1, expire: 2 });
  cacheTag(`event-pass-offer-availability-${eventId}`);
  try {
    const response = await getCachedEventPassOffer(eventId);
    return response === null ? null : parseOffer(response);
  } catch {
    return null;
  }
}
