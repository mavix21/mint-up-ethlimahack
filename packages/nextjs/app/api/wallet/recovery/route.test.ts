import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticated = vi.fn(async () => true);
const fetchAuthAction = vi.fn(async () => ({
  encryptionSession: "encryption-session-1",
}));

vi.mock("~~/lib/auth-server", () => ({
  isAuthenticated,
  fetchAuthAction,
}));

function request(token = "better-auth-session") {
  return new Request("https://passes.mint-up.xyz/api/wallet/recovery", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("wallet recovery route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an authenticated Shield encryption session", async () => {
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      sessionToken: "better-auth-session",
    });
    expect(await response.json()).toEqual({
      encryptionSession: "encryption-session-1",
    });
  });

  it("rejects unauthenticated recovery", async () => {
    isAuthenticated.mockResolvedValueOnce(false);
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });

  it("requires a Better Auth bearer token", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/wallet/recovery", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });

  it("does not expose backend recovery failures", async () => {
    fetchAuthAction.mockRejectedValueOnce(new Error("shield-secret"));
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "Wallet recovery could not be authorized.",
    });
  });
});
