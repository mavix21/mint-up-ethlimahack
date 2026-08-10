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

const purchaseConflictMessages: Record<string, string> = {
  event_pass_embedded_wallet_required:
    "Your embedded wallet does not match this purchase. Sign out and sign in again.",
  event_pass_not_found: "This Event Pass offer no longer exists.",
  event_pass_purchase_unavailable:
    "This Event Pass is not currently available for purchase.",
  event_pass_sold_out: "This Event Pass is sold out.",
};

function purchaseErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "string" && /^event_pass_[a-z_]+$/.test(data)) {
      return data;
    }
  }
  if (error instanceof Error) {
    return error.message.match(/event_pass_[a-z_]+/)?.[0];
  }
}

function conflictResponse(
  error: unknown,
  stage: "backend_preparation" | "contract_verification",
) {
  const code = purchaseErrorCode(error) ?? "event_pass_preparation_failed";
  console.error("Event Pass purchase preparation failed", {
    code,
    stage,
    error,
  });
  return Response.json(
    {
      code,
      message:
        purchaseConflictMessages[code] ??
        "This Event Pass could not be prepared. Refresh the offer and try again.",
      stage,
    },
    { status: 409 },
  );
}

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
  let offer: Awaited<ReturnType<typeof getEventPassOffer>>;
  try {
    offer = await getEventPassOffer(parsed.data.eventId);
  } catch (error) {
    console.error("Event Pass offer lookup failed", { error });
    return Response.json(
      {
        code: "event_pass_offer_lookup_failed",
        message: "The latest Event Pass offer could not be loaded. Try again.",
        stage: "offer_lookup",
      },
      { status: 409 },
    );
  }
  if (!offer || offer.availability.kind !== "available") {
    const message =
      offer?.availability.kind === "unavailable"
        ? offer.availability.reason
        : "This Event Pass offer is no longer available.";
    return Response.json(
      {
        code: "event_pass_offer_unavailable",
        message,
        stage: "offer_lookup",
      },
      { status: 409 },
    );
  }
  let validated: PreparedPurchase;
  try {
    const prepared = await fetchAuthMutation(preparePurchase, parsed.data);
    validated = preparedPurchaseSchema.parse(prepared);
  } catch (error) {
    return conflictResponse(error, "backend_preparation");
  }
  try {
    await verifyPreparedPurchaseAvailability(validated, {
      eventIdentifier: offer.eventIdentifier,
      priceAmountSubunits: offer.price.amountSubunits,
      revenueRecipient: offer.revenueRecipient,
      fundsReleaseAt: offer.startTime,
    });
    return Response.json(validated);
  } catch (error) {
    return conflictResponse(error, "contract_verification");
  }
}
