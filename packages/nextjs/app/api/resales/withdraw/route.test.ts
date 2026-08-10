import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthMutation, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthMutation: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthMutation, isAuthenticated }));
import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://mint-up.xyz/api/resales/withdraw", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("prepare Event Pass resale withdrawal API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("prepares a sponsored withdrawal without payment inputs", async () => {
    fetchAuthMutation.mockResolvedValue({
      resaleId: "private-resale-withdraw-1",
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request({
        passId: "42",
        idempotencyKey: "12345678-1234-1234-1234-123456789abc",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      passId: "42",
      chainId: 421614,
      idempotencyKey: "12345678-1234-1234-1234-123456789abc",
    });
    expect(JSON.stringify(await response.json())).not.toContain("price");
  });
});
