import { describe, expect, it, vi } from "vitest";

import type { PrepareUserOperationResult } from "./pimlico-user-operation-api";
import { userOperationSchema } from "./pimlico-user-operation-schema";
import { prepareSignAndSubmitUserOperation } from "./pimlico-user-operation";

describe("sponsored user operation authorization", () => {
  it("rejects empty numeric quantities", () => {
    expect(() =>
      userOperationSchema.parse({
        sender: "0x1111111111111111111111111111111111111111",
        nonce: "0x",
        callData: "0x",
        callGasLimit: "0x1",
        verificationGasLimit: "0x2",
        preVerificationGas: "0x3",
        maxFeePerGas: "0x4",
        maxPriorityFeePerGas: "0x5",
        signature: "0x",
        paymaster: "0x2222222222222222222222222222222222222222",
        paymasterData: "0x",
        paymasterVerificationGasLimit: "0x6",
        paymasterPostOpGasLimit: "0x7",
      }),
    ).toThrow();
  });

  it("waits for preparation before signing and submits only the signature with the unchanged operation", async () => {
    let resolvePrepare!: (value: PrepareUserOperationResult) => void;
    const operation = {
      sender: "0x1111111111111111111111111111111111111111",
      nonce: "0x0",
      callData: "0x1234",
      callGasLimit: "0x1",
      verificationGasLimit: "0x2",
      preVerificationGas: "0x3",
      maxFeePerGas: "0x4",
      maxPriorityFeePerGas: "0x5",
      signature: "0x",
      paymaster: "0x2222222222222222222222222222222222222222",
      paymasterData: "0x",
      paymasterVerificationGasLimit: "0x6",
      paymasterPostOpGasLimit: "0x7",
    } as const;
    const prepare = vi.fn(
      () =>
        new Promise<PrepareUserOperationResult>(
          resolve => (resolvePrepare = resolve),
        ),
    );
    const signUserOperation = vi.fn(async decoded => {
      expect(decoded.nonce).toBe(0n);
      return "0xabcd" as const;
    });
    const submit = vi.fn(async () => ({
      userOperationHash: "0x1234" as const,
    }));

    const pending = prepareSignAndSubmitUserOperation({
      prepare,
      signUserOperation,
      submit,
    });
    await Promise.resolve();
    expect(signUserOperation).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();

    resolvePrepare({
      preparationId: "preparation-1",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation,
      expiresAt: 123,
    });
    await expect(pending).resolves.toEqual({ userOperationHash: "0x1234" });
    expect(signUserOperation).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith({
      preparationId: "preparation-1",
      signature: "0xabcd",
      operation,
    });
    expect(operation.signature).toBe("0x");
  });
});
