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
  new Request("https://mint-up.xyz/api/resale-purchases", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("prepare private resale purchase API", () => {
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
      resalePurchaseId: "private-resale-purchase-0001",
      priceAmountSubunits: "40000000",
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(request(validRequest));

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      ...validRequest,
      chainId: 421614,
    });
  });

  it("rejects browser-supplied economics and recipients", async () => {
    const response = await POST(
      request({
        ...validRequest,
        seller: "changed",
        priceAmountSubunits: "1",
        feeRecipient: "changed",
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("returns a concise stale-offer response", async () => {
    fetchAuthMutation.mockRejectedValue(
      new Error("event_pass_resale_unavailable"),
    );

    const response = await POST(request(validRequest));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "offer_unavailable" });
  });
});
