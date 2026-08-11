import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({
  fetchAuthAction,
  isAuthenticated,
}));
import { POST } from "./route";

const context = {
  params: Promise.resolve({
    resalePurchaseId: "resale-purchase-0001",
  }),
};
const request = () => new Request("https://mint-up.xyz", { method: "POST" });

describe("reconcile public Pass resale purchase API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("returns success only after production verification completes", async () => {
    fetchAuthAction.mockResolvedValue(null);

    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resalePurchaseId: "resale-purchase-0001",
    });
  });

  it("returns Retry-safe failure while verification is incomplete", async () => {
    fetchAuthAction.mockRejectedValue(new Error("not included"));

    const response = await POST(request(), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "We couldn't verify the purchase yet. Try again.",
    });
  });

  it("returns an unavailable result when another buyer completed the purchase", async () => {
    fetchAuthAction.mockRejectedValue(
      new Error("event_pass_resale_unavailable"),
    );

    const response = await POST(request(), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "listing_unavailable",
      message:
        "This Pass resale is no longer available. Another buyer may have completed it first. You won't be charged.",
    });
  });
});
