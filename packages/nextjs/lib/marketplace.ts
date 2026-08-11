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

export type MarketplaceGroup = {
  event: { id: string; name: string; startTime: number };
  offers: Array<{
    priceAmountSubunits: string;
    originalProtectedPriceAmountSubunits: string;
    passId: string;
    ticketTypeName: string;
  }>;
};

export function composeMarketplace(
  resaleGroups: z.infer<typeof resaleMarketplaceSchema>,
): MarketplaceGroup[] {
  return resaleGroups
    .map(resaleGroup => ({
      event: resaleGroup.event,
      offers: resaleGroup.listings.map(listing => ({
        passId: listing.passId,
        ticketTypeName: listing.ticketTypeName,
        priceAmountSubunits: listing.price.amountSubunits,
        originalProtectedPriceAmountSubunits:
          listing.originalProtectedPrice.amountSubunits,
      })),
    }))
    .filter(group => group.offers.length > 0)
    .map(group => ({
      ...group,
      offers: group.offers.toSorted((a, b) => {
        const left = BigInt(a.priceAmountSubunits);
        const right = BigInt(b.priceAmountSubunits);
        return left < right
          ? -1
          : left > right
            ? 1
            : a.passId.localeCompare(b.passId);
      }),
    }))
    .toSorted(
      (a, b) =>
        a.event.startTime - b.event.startTime ||
        a.event.id.localeCompare(b.event.id),
    );
}
