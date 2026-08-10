import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";

const request = (body = "") =>
  new Request("https://mint-up.xyz/api/wallet/user-operation/prepare", {
    method: "POST",
    body: body || undefined,
  });

describe("prepare sponsored user operation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });
  it("rejects unauthenticated requests", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects malformed requests", async () => {
    expect((await POST(request("{}"))).status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects oversized requests", async () => {
    expect((await POST(request("x".repeat(16_385)))).status).toBe(413);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("forwards the purchaseId", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation: {
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
      },
      expiresAt: Date.UTC(2030, 0, 1),
    });
    expect(
      (
        await POST(
          request(
            JSON.stringify({ purchaseId: "wn77amvf1xcsn49m9a8ttzhhq98c0cnf" }),
          ),
        )
      ).status,
    ).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      purchaseId: "wn77amvf1xcsn49m9a8ttzhhq98c0cnf",
    });
  });
  it("forwards a transferId", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation: {
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
      },
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request(JSON.stringify({ transferId: "jh712transferintent" })),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      transferId: "jh712transferintent",
    });
  });
  it("forwards a resaleId", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation: {
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
      },
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request(JSON.stringify({ resaleId: "private-resale-0001" })),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resaleId: "private-resale-0001",
    });
  });
  it("forwards a resalePurchaseId", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation: {
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
      },
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request(
        JSON.stringify({
          resalePurchaseId: "private-resale-purchase-0001",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resalePurchaseId: "private-resale-purchase-0001",
    });
  });
  it("forwards a refundId", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      chainId: 421614,
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      operation: {
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
      },
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request(JSON.stringify({ refundId: "event-pass-refund-0001" })),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      refundId: "event-pass-refund-0001",
    });
  });
  it("rejects ambiguous intent references", async () => {
    const response = await POST(
      request(
        JSON.stringify({ purchaseId: "purchase", transferId: "transfer" }),
      ),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects an ambiguous resale intent reference", async () => {
    const response = await POST(
      request(JSON.stringify({ transferId: "transfer", resaleId: "resale" })),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects an ambiguous resale purchase intent reference", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          purchaseId: "purchase",
          resalePurchaseId: "resale-purchase",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects an ambiguous refund intent reference", async () => {
    const response = await POST(
      request(JSON.stringify({ transferId: "transfer", refundId: "refund" })),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects an incompatible prepared operation response", async () => {
    fetchAuthAction.mockResolvedValue({
      preparationId: "p",
      operation: { callData: "0x1234" },
    });
    const response = await POST(
      request(
        JSON.stringify({ purchaseId: "wn77amvf1xcsn49m9a8ttzhhq98c0cnf" }),
      ),
    );
    expect(response.status).toBe(409);
  });
  it("sanitizes backend failures", async () => {
    fetchAuthAction.mockRejectedValue(new Error("PIMLICO_API_KEY=secret"));
    const response = await POST(
      request(
        JSON.stringify({ purchaseId: "wn77amvf1xcsn49m9a8ttzhhq98c0cnf" }),
      ),
    );
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
