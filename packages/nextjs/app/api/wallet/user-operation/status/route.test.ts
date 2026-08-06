import { beforeEach, describe, expect, it, vi } from "vitest";
const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";
const request = (body: string) =>
  new Request("https://mint-up.xyz/api/wallet/user-operation/status", {
    method: "POST",
    body,
  });
describe("sponsored user operation status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });
  it("rejects unauthenticated requests", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST(request("{}"))).status).toBe(401);
  });
  it("rejects malformed requests", async () => {
    expect((await POST(request("{}"))).status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });
  it("rejects oversized requests", async () => {
    expect((await POST(request("x".repeat(16_385)))).status).toBe(413);
  });
  it("forwards only the operation hash", async () => {
    const body = { userOperationHash: "0x1234" };
    fetchAuthAction.mockResolvedValue({ status: "pending" });
    expect((await POST(request(JSON.stringify(body)))).status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), body);
  });
  it("sanitizes backend failures", async () => {
    fetchAuthAction.mockRejectedValue(new Error("provider secret"));
    const response = await POST(
      request(JSON.stringify({ userOperationHash: "0x1234" })),
    );
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
