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
    buyerName: z.string().min(1).max(200),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const resaleWithdrawalPreparationSchema = z
  .object({
    resaleId: z.string().min(1).max(200),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const privateResaleOfferSchema = z
  .object({
    role: z.enum(["seller", "buyer"]),
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

export type ResalePreparation = z.infer<typeof resalePreparationSchema>;
export type ResaleWithdrawalPreparation = z.infer<
  typeof resaleWithdrawalPreparationSchema
>;
export type PrivateResaleOffer = z.infer<typeof privateResaleOfferSchema>;

export const resaleRecipientUnavailableMessage =
  "Ask them to secure their passes, then check the email and try again.";
