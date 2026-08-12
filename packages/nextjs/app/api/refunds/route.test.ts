import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthMutation, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthMutation: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthMutation, isAuthenticated }));
import { POST } from "./route";

const validRequest = {
  passId: "42",
  idempotencyKey: "12345678-1234-1234-1234-123456789abc",
};
const request = (body: unknown) =>
  new Request("https://mint-up.xyz/api/refunds", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("prepare Event Pass refund API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires authentication", async () => {
    isAuthenticated.mockResolvedValue(false);

    expect((await POST(request(validRequest))).status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("prepares only the pass and current chain from the server", async () => {
    fetchAuthMutation.mockResolvedValue({
      refundId: "event-pass-refund-0001",
      originalAmountSubunits: "25000000",
      requiresReconciliation: false,
    });

    const response = await POST(request(validRequest));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      refundId: "event-pass-refund-0001",
      originalAmountSubunits: "25000000",
      requiresReconciliation: false,
    });
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      ...validRequest,
      chainId: 421614,
    });
  });

  it("rejects browser-supplied owner, amount, and chain", async () => {
    const response = await POST(
      request({
        ...validRequest,
        chainId: 1,
        owner: "changed",
        originalAmountSubunits: "1",
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("returns a concise unavailable response", async () => {
    fetchAuthMutation.mockRejectedValue(
      new Error("event_pass_refund_unavailable: secret"),
    );

    const response = await POST(request(validRequest));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "refund_unavailable",
      message: "Este reembolso ya no está disponible.",
    });
  });
});
