import type {
  Hex,
  PrepareUserOperationResult,
  UserOperationDto,
} from "./pimlico-user-operation-api";

const bigintFields = [
  "nonce",
  "callGasLimit",
  "verificationGasLimit",
  "preVerificationGas",
  "maxFeePerGas",
  "maxPriorityFeePerGas",
  "paymasterVerificationGasLimit",
  "paymasterPostOpGasLimit",
] as const;

export function decodeUserOperation(dto: UserOperationDto) {
  const operation: Record<string, unknown> = { ...dto };
  for (const field of bigintFields) {
    if (dto[field] !== undefined) operation[field] = BigInt(dto[field]);
  }
  return operation;
}

export async function prepareSignAndSubmitUserOperation({
  prepare,
  signUserOperation,
  submit,
}: {
  prepare: () => Promise<PrepareUserOperationResult>;
  signUserOperation: (
    operation: ReturnType<typeof decodeUserOperation>,
  ) => Promise<Hex>;
  submit: (request: {
    preparationId: string;
    signature: Hex;
    operation: UserOperationDto;
  }) => Promise<{ userOperationHash: Hex }>;
}) {
  const prepared = await prepare();
  const signature = await signUserOperation(
    decodeUserOperation(prepared.operation),
  );
  return submit({
    preparationId: prepared.preparationId,
    operation: prepared.operation,
    signature,
  });
}
