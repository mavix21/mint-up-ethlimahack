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
    "Tu wallet integrada no coincide con esta compra. Cierra sesión y vuelve a iniciarla.",
  event_pass_not_found: "Esta oferta de Event Pass ya no existe.",
  event_pass_purchase_unavailable:
    "Este Event Pass no está disponible para comprar en este momento.",
  event_pass_sold_out: "Este Event Pass está agotado.",
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
        "No se pudo preparar este Event Pass. Actualiza la oferta e inténtalo de nuevo.",
      stage,
    },
    { status: 409 },
  );
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Inicia sesión para comprar este Event Pass." },
      { status: 401 },
    );
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return Response.json(
      { message: "Solicitud de compra no válida." },
      { status: 400 },
    );
  }
  const parsed = prepareArgs.safeParse(value);
  if (!parsed.success) {
    return Response.json(
      { message: "Solicitud de compra no válida." },
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
        message:
          "No se pudo cargar la oferta más reciente de Event Pass. Inténtalo de nuevo.",
        stage: "offer_lookup",
      },
      { status: 409 },
    );
  }
  if (!offer || offer.availability.kind !== "available") {
    const message =
      offer?.availability.kind === "unavailable"
        ? offer.availability.reason
        : "Esta oferta de Event Pass ya no está disponible.";
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
