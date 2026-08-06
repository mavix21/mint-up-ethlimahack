import { beforeEach, describe, expect, it, vi } from "vitest";
const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";
const url = "https://mint-up.xyz/api/wallet/user-operation/submit";
const request = (body: string) => new Request(url, { method: "POST", body });
const operation = {
  sender: "0x1111111111111111111111111111111111111111",
  nonce: "0x0",
  callData: "0x12",
  callGasLimit: "0x1",
  verificationGasLimit: "0x2",
  preVerificationGas: "0x3",
  maxFeePerGas: "0x4",
  maxPriorityFeePerGas: "0x5",
  signature: "0x",
};
describe("submit sponsored user operation API", () => {
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
  it("forwards the signature and frozen unsigned operation", async () => {
    const body = { preparationId: "p", signature: "0xab", operation };
    fetchAuthAction.mockResolvedValue({ userOperationHash: "0x12" });
    expect((await POST(request(JSON.stringify(body)))).status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), body);
  });
  it("sanitizes backend failures", async () => {
    fetchAuthAction.mockRejectedValue(new Error("provider secret"));
    const response = await POST(
      request(JSON.stringify({ preparationId: "p", signature: "0xab" })),
    );
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
