import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes = z.string().regex(/^0x[0-9a-fA-F]*$/);
const quantity = z.string().regex(/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/);

export const userOperationSchema = z
  .object({
    sender: address,
    nonce: quantity,
    callData: bytes,
    callGasLimit: quantity,
    verificationGasLimit: quantity,
    preVerificationGas: quantity,
    maxFeePerGas: quantity,
    maxPriorityFeePerGas: quantity,
    signature: z.literal("0x"),
    factory: address.optional(),
    factoryData: bytes.optional(),
    paymaster: address,
    paymasterData: bytes,
    paymasterVerificationGasLimit: quantity,
    paymasterPostOpGasLimit: quantity,
  })
  .strict();

export const prepareUserOperationResultSchema = z
  .object({
    preparationId: z.string().min(1),
    chainId: z.literal(421614),
    entryPoint: address,
    operation: userOperationSchema,
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type UserOperationDto = z.infer<typeof userOperationSchema>;
export type PrepareUserOperationResult = z.infer<
  typeof prepareUserOperationResultSchema
>;
