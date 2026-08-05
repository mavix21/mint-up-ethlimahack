import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthenticated } from "~~/lib/auth-server";
import { proxy } from "./proxy";

vi.mock("~~/lib/auth-server", () => ({ isAuthenticated: vi.fn() }));

describe("Passes route protection", () => {
  beforeEach(() => {
    vi.mocked(isAuthenticated).mockReset();
    vi.mocked(isAuthenticated).mockResolvedValue(false);
  });

  it("leaves public and handoff callback routes available without a session", async () => {
    for (const url of [
      "https://passes.mint-up.xyz/",
      "https://passes.mint-up.xyz/auth/callback?ott=token",
    ]) {
      const response = await proxy(new NextRequest(url));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
    expect(isAuthenticated).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated protected request and preserves its destination", async () => {
    const response = await proxy(
      new NextRequest("https://passes.mint-up.xyz/account?tab=passes"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://passes.mint-up.xyz/login?callbackUrl=%2Faccount%3Ftab%3Dpasses",
    );
  });

  it("allows a protected request with a valid session", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const response = await proxy(
      new NextRequest("https://passes.mint-up.xyz/account"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects an expired session even when a cookie is still present", async () => {
    const response = await proxy(
      new NextRequest("https://passes.mint-up.xyz/account", {
        headers: { cookie: "better-auth.session_token=expired" },
      }),
    );
    expect(response.status).toBe(307);
    expect(isAuthenticated).toHaveBeenCalledOnce();
  });
});
