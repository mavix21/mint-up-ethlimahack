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
  "Pídele que proteja sus pases, luego comprueba el correo e inténtalo de nuevo.";
