import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";

const context = {
  params: Promise.resolve({ resaleId: "private-resale-0001" }),
};

describe("reconcile Event Pass resale API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("reports success only after production verification", async () => {
    fetchAuthAction.mockResolvedValue(null);

    const response = await POST(new Request("https://mint-up.xyz"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resaleId: "private-resale-0001",
    });
  });

  it("returns concise retry state while verification is unavailable", async () => {
    fetchAuthAction.mockRejectedValue(new Error("private chain evidence"));

    const response = await POST(new Request("https://mint-up.xyz"), context);

    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("chain");
  });
});
