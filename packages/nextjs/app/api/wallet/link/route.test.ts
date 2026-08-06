import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticated = vi.fn(async () => true);
const fetchAuthMutation = vi.fn(async () => ({
  nonce: "freshnonce123",
  expiresAt: 1_786_000_000_000,
}));
const fetchAuthAction = vi.fn(async () => "wallet-id");

vi.mock("~~/lib/auth-server", () => ({
  isAuthenticated,
  fetchAuthMutation,
  fetchAuthAction,
}));
vi.mock("~~/contracts/eventPassEnvironment", () => ({
  eventPassEnvironment: { chainId: 421614 },
}));

const address = "0x1111111111111111111111111111111111111111";

function request(body: unknown) {
  return new Request("https://passes.mint-up.xyz/api/wallet/link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("wallet linking route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not issue a linking challenge without an active session", async () => {
    isAuthenticated.mockResolvedValueOnce(false);
    const { POST } = await import("./route");

    const response = await POST(
      request({ action: "challenge", address, chainId: 421614 }),
    );

    expect(response.status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("issues a fresh authenticated challenge for the requested wallet", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({ action: "challenge", address, chainId: 421614 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nonce: "freshnonce123",
      expiresAt: 1_786_000_000_000,
    });
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      address,
      chainId: 421614,
    });
  });

  it("rejects challenges for unsupported chains", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({ action: "challenge", address, chainId: 1 }),
    );

    expect(response.status).toBe(400);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("distinguishes challenge service failures from rejected proofs", async () => {
    fetchAuthMutation.mockRejectedValueOnce(new Error("Convex unavailable"));
    const { POST } = await import("./route");
    const response = await POST(
      request({ action: "challenge", address, chainId: 421614 }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "Could not request a wallet challenge. Try again.",
    });
  });

  it("submits a signed proof through the authenticated linking action", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        action: "verify",
        address,
        chainId: 421614,
        message: "signed SIWE message",
        signature: `0x${"1".repeat(130)}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      address,
      chainId: 421614,
      message: "signed SIWE message",
      signature: `0x${"1".repeat(130)}`,
    });
  });

  it("submits a signed embedded-wallet proof through the client registration action", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        action: "verify",
        walletKind: "embedded",
        address,
        chainId: 421614,
        message: "signed embedded SIWE message",
        signature: `0x${"2".repeat(130)}`,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      address,
      chainId: 421614,
      message: "signed embedded SIWE message",
      signature: `0x${"2".repeat(130)}`,
    });
  });

  it("does not report a link when the proof is invalid or already consumed", async () => {
    fetchAuthAction.mockRejectedValueOnce(
      new Error("SIWE verification required"),
    );
    const { POST } = await import("./route");
    const response = await POST(
      request({
        action: "verify",
        address,
        chainId: 421614,
        message: "replayed SIWE message",
        signature: `0x${"1".repeat(130)}`,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Wallet verification failed. Request a new challenge.",
    });
  });
});
