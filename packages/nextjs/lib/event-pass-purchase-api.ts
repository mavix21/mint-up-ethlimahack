import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const preparedPurchaseSchema = z.object({
  purchaseId: z.string().min(1),
  chainId: z.number().int().positive(),
  contractAddress: address,
  paymentAssetAddress: address,
  eventIdentifier: hash,
  buyerAddress: address,
  revenueRecipient: address,
  priceAmountSubunits: z.string().regex(/^\d+$/),
  remaining: z.number().int().positive(),
  expiresAt: z.number().finite(),
  entryPointAddress: address.optional(),
});

export const purchaseStatusSchema = z.object({
  status: z.enum([
    "awaitingSubmission",
    "submitted",
    "included",
    "synchronizing",
    "confirmed",
    "rejected",
    "expiredOrDropped",
  ]),
  transactionHash: hash.optional(),
  userOperationHash: hash.optional(),
  failure: z.string().optional(),
  pass: z
    .object({
      passId: z.string().regex(/^\d+$/),
      eventId: z.string().min(1),
      owner: address,
      issuedTicketId: z.string().min(1),
    })
    .optional(),
});

export type PreparedPurchase = z.infer<typeof preparedPurchaseSchema>;
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

export async function responseJson<T>(
  response: Response,
  schema: z.ZodType<T>,
) {
  const value: unknown = await response.json();
  if (!response.ok) {
    const result = z.object({ message: z.string() }).safeParse(value);
    throw new Error(
      result.success ? result.data.message : "Purchase request failed",
    );
  }
  return schema.parse(value);
}
