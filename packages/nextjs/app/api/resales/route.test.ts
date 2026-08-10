import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthMutation, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthMutation: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthMutation, isAuthenticated }));
import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://mint-up.xyz/api/resales", {
    method: "POST",
    body: JSON.stringify(body),
  });

const validRequest = {
  passId: "42",
  buyerEmail: "gianna@example.com",
  price: "25.50",
  idempotencyKey: "12345678-1234-1234-1234-123456789abc",
};

describe("prepare Event Pass resale API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires authentication", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST(request(validRequest))).status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.0000001", "one"])(
    "rejects invalid human price %s before production preparation",
    async price => {
      const response = await POST(request({ ...validRequest, price }));
      expect(response.status).toBe(400);
      expect(fetchAuthMutation).not.toHaveBeenCalled();
    },
  );

  it("converts the human price and returns safe create or replace details", async () => {
    fetchAuthMutation.mockResolvedValue({
      resaleId: "private-resale-0001",
      kind: "replace",
      buyerName: "Gianna",
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(request(validRequest));

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      passId: "42",
      buyerEmail: "gianna@example.com",
      priceAmountSubunits: "25500000",
      chainId: 421614,
      idempotencyKey: validRequest.idempotencyKey,
    });
    expect(await response.json()).toEqual({
      resaleId: "private-resale-0001",
      kind: "replace",
      buyerName: "Gianna",
      expiresAt: Date.UTC(2030, 0, 1),
    });
  });

  it("uses one generic actionable response for an ineligible buyer", async () => {
    fetchAuthMutation.mockRejectedValue(
      new Error("event_pass_recipient_unavailable"),
    );

    const response = await POST(request(validRequest));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "recipient_unavailable",
    });
  });
});
