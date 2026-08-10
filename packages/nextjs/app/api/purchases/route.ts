import { type FunctionReference, anyApi } from "convex/server";
import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { getEventPassOffer } from "~~/lib/event-pass-offer-data";
import {
  type PreparedPurchase,
  preparedPurchaseSchema,
} from "../../../lib/event-pass-purchase-api";
import { verifyPreparedPurchaseAvailability } from "../../../lib/event-pass-purchase-server";

type PrepareArgs = {
  eventId: string;
  buyerAddress: string;
  idempotencyKey: string;
};

const preparePurchase = anyApi.eventPassPurchases.prepare as FunctionReference<
  "mutation",
  "public",
  PrepareArgs,
  PreparedPurchase
>;

const prepareArgs = z.object({
  eventId: z.string().min(1),
  buyerAddress: preparedPurchaseSchema.shape.buyerAddress,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Sign in to purchase this Event Pass." },
      { status: 401 },
    );
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return Response.json(
      { message: "Invalid purchase request." },
      { status: 400 },
    );
  }
  const parsed = prepareArgs.safeParse(value);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid purchase request." },
      { status: 400 },
    );
  }
  try {
    const offer = await getEventPassOffer(parsed.data.eventId);
    if (!offer || offer.availability.kind !== "available")
      throw new Error("Protected offer is unavailable");
    const prepared = await fetchAuthMutation(preparePurchase, parsed.data);
    const validated = preparedPurchaseSchema.parse(prepared);
    await verifyPreparedPurchaseAvailability(validated, {
      eventIdentifier: offer.eventIdentifier,
      priceAmountSubunits: offer.price.amountSubunits,
      revenueRecipient: offer.revenueRecipient,
      fundsReleaseAt: offer.startTime,
    });
    return Response.json(validated);
  } catch {
    return Response.json(
      {
        message:
          "This Event Pass is no longer available. Refresh the offer and try again.",
      },
      { status: 409 },
    );
  }
}
