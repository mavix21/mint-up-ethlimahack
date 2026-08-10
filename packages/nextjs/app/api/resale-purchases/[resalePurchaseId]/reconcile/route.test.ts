import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";

const context = {
  params: Promise.resolve({
    resalePurchaseId: "private-resale-purchase-0001",
  }),
};

describe("reconcile private resale purchase API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("returns success only after production verification completes", async () => {
    fetchAuthAction.mockResolvedValue(null);

    const response = await POST(new Request("https://mint-up.xyz"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resalePurchaseId: "private-resale-purchase-0001",
    });
  });

  it("returns Retry-safe failure while verification is incomplete", async () => {
    fetchAuthAction.mockRejectedValue(new Error("not included"));

    const response = await POST(new Request("https://mint-up.xyz"), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "We couldn't verify the purchase yet. Try again.",
    });
  });
});
