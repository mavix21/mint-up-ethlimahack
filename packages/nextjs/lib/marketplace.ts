import { z } from "zod";

const moneySchema = z
  .object({
    amountSubunits: z.string().regex(/^[1-9]\d*$/),
    denomination: z.literal("USDC"),
  })
  .strict();

export const resaleMarketplaceSchema = z.array(
  z
    .object({
      event: z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          startTime: z.number().finite(),
        })
        .strict(),
      listings: z.array(
        z
          .object({
            passId: z.string().min(1).max(100),
            ticketTypeName: z.string().min(1),
            price: moneySchema,
            originalProtectedPrice: moneySchema,
            offerKind: z.literal("pass_resale"),
          })
          .strict(),
      ),
    })
    .strict(),
);

type PrimaryOffer = {
  eventId: string;
  name: string;
  startTime: number;
  price: { amountSubunits: string };
};

export type MarketplaceGroup = {
  event: { id: string; name: string; startTime: number };
  offers: Array<
    | { kind: "event_pass_offer"; priceAmountSubunits: string; eventId: string }
    | {
        kind: "pass_resale";
        priceAmountSubunits: string;
        originalProtectedPriceAmountSubunits: string;
        passId: string;
        ticketTypeName: string;
      }
  >;
};

export function composeMarketplace(
  primaryOffers: PrimaryOffer[],
  resaleGroups: z.infer<typeof resaleMarketplaceSchema>,
): MarketplaceGroup[] {
  const groups = new Map<string, MarketplaceGroup>();
  for (const offer of primaryOffers) {
    const group = groups.get(offer.eventId) ?? {
      event: {
        id: offer.eventId,
        name: offer.name,
        startTime: offer.startTime,
      },
      offers: [],
    };
    group.offers.push({
      kind: "event_pass_offer",
      eventId: offer.eventId,
      priceAmountSubunits: offer.price.amountSubunits,
    });
    groups.set(offer.eventId, group);
  }
  for (const resaleGroup of resaleGroups) {
    const group = groups.get(resaleGroup.event.id) ?? {
      event: resaleGroup.event,
      offers: [],
    };
    group.offers.push(
      ...resaleGroup.listings.map(listing => ({
        kind: "pass_resale" as const,
        passId: listing.passId,
        ticketTypeName: listing.ticketTypeName,
        priceAmountSubunits: listing.price.amountSubunits,
        originalProtectedPriceAmountSubunits:
          listing.originalProtectedPrice.amountSubunits,
      })),
    );
    groups.set(resaleGroup.event.id, group);
  }
  return [...groups.values()]
    .map(group => ({
      ...group,
      offers: group.offers.toSorted((a, b) => {
        const left = BigInt(a.priceAmountSubunits);
        const right = BigInt(b.priceAmountSubunits);
        return left < right
          ? -1
          : left > right
            ? 1
            : a.kind.localeCompare(b.kind);
      }),
    }))
    .toSorted(
      (a, b) =>
        a.event.startTime - b.event.startTime ||
        a.event.id.localeCompare(b.event.id),
    );
}
