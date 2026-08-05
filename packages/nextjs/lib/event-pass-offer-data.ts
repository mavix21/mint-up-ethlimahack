import "server-only";

import { cache } from "react";
import { fetchQuery } from "convex/nextjs";

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

export async function listEventPassOffers(now = Date.now()) {
  const response = fixtureEnabled()
    ? { offers: [eligibleOfferPayload] }
    : await fetchQuery(mintUpApi.eventPassOffers.list, {}, queryOptions());
  return parseOfferCatalog(response, now).filter(
    offer => offer.availability.kind === "available",
  );
}

export const getEventPassOffer = cache(async (eventId: string) => {
  const response = fixtureEnabled()
    ? eventId === eligibleOfferPayload.eventId
      ? eligibleOfferPayload
      : null
    : await fetchQuery(
        mintUpApi.eventPassOffers.getByEventId,
        { eventId },
        queryOptions(),
      );
  return response === null ? null : parseOffer(response);
});
