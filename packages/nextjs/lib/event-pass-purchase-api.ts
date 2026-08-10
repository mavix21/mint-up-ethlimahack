import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const preparedPurchaseSchema = z
  .object({
    purchaseId: z.string().min(1),
    chainId: z.number().int().positive(),
    contractAddress: address,
    paymentAssetAddress: address,
    eventIdentifier: hash,
    buyerAddress: address,
    revenueRecipient: address,
    priceAmountSubunits: z.string().regex(/^[1-9]\d*$/),
    remaining: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    entryPointAddress: address.optional(),
  })
  .strict();

export const purchaseStatusSchema = z.object({
  status: z.enum([
    "awaitingSubmission",
    "submitted",
    "included",
    "synchronizing",
    "confirmed",
    "rejected",
    "expired",
    "dropped",
    "unknown",
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

// Distinct lifecycle for the sponsored purchase UI (prevents collapsing into ordinary tx state)
export const purchaseLifecycleStage = z.enum([
  "idle",
  "preparing",
  "prepared",
  "sponsoring",
  "signing",
  "submitting",
  "submitted",
  "included",
  "reconciling",
  "confirmed",
  "rejected",
  "expired",
  "dropped",
  "unknown",
  "cancelled",
  "failed",
]);

export type PurchaseLifecycleStage = z.infer<typeof purchaseLifecycleStage>;

export function initialPurchaseLifecycleStage(
  persistedStage: string | undefined,
  hasPurchaseId: boolean,
): PurchaseLifecycleStage {
  const stage = persistedStage === "confirming" ? "signing" : persistedStage;
  if (stage === "confirmed") return hasPurchaseId ? "reconciling" : "idle";
  if (stage === "included" || stage === "reconciling") return "reconciling";
  if (stage === "submitted") return "submitted";
  const parsed = purchaseLifecycleStage.safeParse(stage);
  return parsed.success ? parsed.data : "idle";
}

export function mapBackendStatusToLifecycle(
  status: z.infer<typeof purchaseStatusSchema>["status"],
): PurchaseLifecycleStage {
  switch (status) {
    case "awaitingSubmission":
      return "prepared";
    case "submitted":
      return "submitted"; // bundler acceptance
    case "included":
      return "included";
    case "synchronizing":
      return "reconciling";
    case "confirmed":
      return "confirmed";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    case "expiredOrDropped":
      return "expired";
    case "dropped":
      return "dropped";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

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
