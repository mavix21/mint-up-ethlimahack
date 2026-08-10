import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthMutation, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthMutation: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthMutation, isAuthenticated }));
import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://mint-up.xyz/api/transfers", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("prepare Event Pass transfer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires authentication", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST(request({}))).status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("normalizes input through production and returns only safe recipient details", async () => {
    fetchAuthMutation.mockResolvedValue({
      transferId: "jh712transferintent",
      recipientName: "Gianna",
      expiresAt: Date.UTC(2030, 0, 1),
    });

    const response = await POST(
      request({
        passId: "42",
        recipientEmail: "  GIANNA@EXAMPLE.COM ",
        idempotencyKey: "12345678-1234-1234-1234-123456789abc",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      passId: "42",
      recipientEmail: "  GIANNA@EXAMPLE.COM ",
      chainId: 421614,
      idempotencyKey: "12345678-1234-1234-1234-123456789abc",
    });
    expect(await response.json()).toEqual({
      transferId: "jh712transferintent",
      recipientName: "Gianna",
      expiresAt: Date.UTC(2030, 0, 1),
    });
  });

  it("uses one generic actionable response for unavailable recipients", async () => {
    fetchAuthMutation.mockRejectedValue(
      new Error("event_pass_recipient_unavailable"),
    );

    const response = await POST(
      request({
        passId: "42",
        recipientEmail: "unknown@example.com",
        idempotencyKey: "12345678-1234-1234-1234-123456789abc",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "recipient_unavailable",
      message:
        "Ask them to secure their passes, then check the email and try again.",
    });
  });

  it("sanitizes all other backend failures", async () => {
    fetchAuthMutation.mockRejectedValue(new Error("secret backend detail"));

    const response = await POST(
      request({
        passId: "42",
        recipientEmail: "person@example.com",
        idempotencyKey: "12345678-1234-1234-1234-123456789abc",
      }),
    );

    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
