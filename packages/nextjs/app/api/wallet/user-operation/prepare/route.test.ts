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
  it("forwards the purpose-specific empty request", async () => {
    fetchAuthAction.mockResolvedValue({ preparationId: "p" });
    expect((await POST(request())).status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {});
  });
  it("sanitizes backend failures", async () => {
    fetchAuthAction.mockRejectedValue(new Error("PIMLICO_API_KEY=secret"));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
