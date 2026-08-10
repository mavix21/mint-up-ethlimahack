import { z } from "zod";

export const transferPreparationSchema = z
  .object({
    transferId: z.string().min(1).max(200),
    recipientName: z.string().min(1).max(200),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type TransferPreparation = z.infer<typeof transferPreparationSchema>;

export const recipientUnavailableMessage =
  "Ask them to secure their passes, then check the email and try again.";
