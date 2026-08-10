import { z } from "zod";

export const refundPreparationSchema = z.object({
  refundId: z.string().min(1),
  originalAmountSubunits: z.string().regex(/^\d+$/),
});

export type RefundPreparation = z.infer<typeof refundPreparationSchema>;
