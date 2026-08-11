import { z } from "zod";

const humanUsdcPattern = /^\d+(?:\.\d{1,6})?$/;

export function parseHumanUsdc(value: string) {
  const price = value.trim();
  if (!humanUsdcPattern.test(price))
    throw new Error("Enter a positive USDC price with up to 6 decimals.");

  const [integer, fraction = ""] = price.split(".");
  const subunits = BigInt(`${integer}${fraction.padEnd(6, "0")}`);
  if (subunits <= 0n)
    throw new Error("Enter a positive USDC price with up to 6 decimals.");
  return subunits.toString();
}

export const resalePreparationSchema = z
  .object({
    resaleId: z.string().min(1).max(200),
    kind: z.enum(["create", "replace"]),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const resaleWithdrawalPreparationSchema = z
  .object({
    resaleId: z.string().min(1).max(200),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const resaleListingSchema = z
  .object({
    status: z.enum(["actionable", "unavailable"]),
    event: z
      .object({
        name: z.string().min(1),
        startTime: z.number().finite(),
      })
      .strict(),
    price: z
      .object({
        amount: z.string().regex(/^\d+(?:\.\d+)?$/),
        denomination: z.literal("USDC"),
      })
      .strict(),
    protection: z.literal("original_price_only"),
  })
  .strict();

export const resalePurchasePreparationSchema = z
  .object({
    resalePurchaseId: z.string().min(1).max(200),
    priceAmountSubunits: z.string().regex(/^[1-9]\d*$/),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type ResalePreparation = z.infer<typeof resalePreparationSchema>;
export type ResaleWithdrawalPreparation = z.infer<
  typeof resaleWithdrawalPreparationSchema
>;
export type ResaleListing = z.infer<typeof resaleListingSchema>;
export type ResalePurchasePreparation = z.infer<
  typeof resalePurchasePreparationSchema
>;

export function resaleEconomics(priceAmountSubunits: string) {
  const price = BigInt(priceAmountSubunits);
  const fee = (price * 900n) / 10_000n;
  return { fee: fee.toString(), net: (price - fee).toString() };
}
