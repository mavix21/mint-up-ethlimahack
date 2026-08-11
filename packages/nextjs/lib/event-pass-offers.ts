import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const eventIdentifier = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const offerSchema = z
  .object({
    eventId: z.string().min(1),
    ticketTypeId: z.string().min(1),
    ticketTypeKind: z.literal("eventPass"),
    eventIdentifier,
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    startTime: z.number().finite(),
    endTime: z.number().finite(),
    timezone: z.string().min(1),
    location: z.string().min(1),
    organizerName: z.string().min(1).optional(),
    publication: z.enum(["published", "unpublished"]),
    lifecycle: z.enum(["scheduled", "cancelled"]),
    configuration: z.enum(["active", "inactive"]),
    contractSales: z.enum(["enabled", "disabled"]),
    onchainTicketTypeCount: z.number().int().nonnegative(),
    paymentAsset: z.string().min(1),
    paymentAssetDecimals: z.number().int().nonnegative(),
    pricing: z.enum(["fixed", "flexible", "free"]),
    priceAmountSubunits: z.string().regex(/^\d+$/),
    pricePhaseCount: z.number().int().nonnegative(),
    approval: z.enum(["immediate", "required"]),
    saleStartsAt: z.number().finite(),
    saleEndsAt: z.number().finite(),
    capacity: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
    availability: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("available") }).strict(),
      z
        .object({
          kind: z.literal("unavailable"),
          reason: z.string().min(1),
        })
        .strict(),
    ]),
    revenueRecipient: address,
  })
  .strict()
  .superRefine((offer, context) => {
    if (offer.remaining > offer.capacity)
      context.addIssue({
        code: "custom",
        path: ["remaining"],
        message: "Remaining exceeds capacity",
      });
    if (offer.saleStartsAt >= offer.saleEndsAt)
      context.addIssue({
        code: "custom",
        path: ["saleEndsAt"],
        message: "Sales window is inverted",
      });
    if (offer.saleEndsAt > offer.startTime || offer.endTime <= offer.startTime)
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Event timing is incompatible",
      });
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: offer.timezone });
    } catch {
      context.addIssue({
        code: "custom",
        path: ["timezone"],
        message: "Timezone is invalid",
      });
    }
  });

const catalogSchema = z.object({ offers: z.array(offerSchema) }).strict();

type RawOffer = z.infer<typeof offerSchema>;

export type EventPassOffer = RawOffer & {
  price: { amountSubunits: string; asset: "USDC"; decimals: 6 };
  availability: { kind: "available" } | { kind: "unavailable"; reason: string };
};

function invalidResponse(error: z.ZodError): never {
  throw new Error("Invalid Mint Up Event Pass response", { cause: error });
}

function availability(
  offer: RawOffer,
  now: number,
): EventPassOffer["availability"] {
  if (offer.availability.kind === "unavailable") {
    const reasons: Record<string, string> = {
      cancelled: "Este evento fue cancelado",
      sales_disabled: "La venta de Event Pass no está activa",
      sale_not_started: "La venta aún no ha comenzado",
      sale_ended: "La venta ha finalizado",
      sold_out: "Este Event Pass está agotado",
    };
    return {
      kind: "unavailable",
      reason:
        reasons[offer.availability.reason] ??
        "Este Event Pass no está disponible",
    };
  }
  let reason: string | undefined;
  if (offer.publication !== "published") reason = "El evento no está publicado";
  else if (offer.lifecycle === "cancelled")
    reason = "Este evento fue cancelado";
  else if (offer.configuration !== "active")
    reason = "La venta de Event Pass no está activa";
  else if (offer.contractSales !== "enabled")
    reason = "Las ventas onchain están desactivadas";
  else if (offer.onchainTicketTypeCount !== 1)
    reason = "Se requiere exactamente una oferta de Event Pass";
  else if (offer.paymentAsset !== "USDC" || offer.paymentAssetDecimals !== 6)
    reason = "Solo se admite USDC";
  else if (offer.pricing === "flexible")
    reason = "No se admiten precios flexibles";
  else if (offer.pricing !== "fixed") reason = "Solo se admiten precios fijos";
  else if (offer.pricePhaseCount !== 0)
    reason = "No se admiten fases de precios";
  else if (offer.approval !== "immediate")
    reason = "No se admiten entradas que requieren aprobación";
  else if (now < offer.saleStartsAt) reason = "La venta aún no ha comenzado";
  else if (now >= offer.saleEndsAt) reason = "La venta ha finalizado";
  else if (offer.remaining === 0) reason = "Este Event Pass está agotado";
  return reason ? { kind: "unavailable", reason } : { kind: "available" };
}

export function parseOffer(value: unknown, now = Date.now()): EventPassOffer {
  const result = offerSchema.safeParse(value);
  if (!result.success) invalidResponse(result.error);
  const offer = result.data;
  return {
    ...offer,
    price: {
      amountSubunits: offer.priceAmountSubunits,
      asset: "USDC",
      decimals: 6,
    },
    availability: availability(offer, now),
  };
}

export function parseOfferCatalog(value: unknown, now = Date.now()) {
  const result = catalogSchema.safeParse(value);
  if (!result.success) invalidResponse(result.error);
  return result.data.offers.map(offer => parseOffer(offer, now));
}

export function formatUsdc(amountSubunits: string) {
  const amount = amountSubunits.padStart(7, "0");
  const integer = amount.slice(0, -6);
  const fraction = amount.slice(-6).replace(/0+$/, "");
  return `${integer}${fraction ? `.${fraction}` : ""} USDC`;
}
