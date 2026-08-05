import { describe, expect, it, vi } from "vitest";

const get = vi.fn(
  async () =>
    new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 }),
);
const post = vi.fn(async (request: Request) => {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/siwe/nonce")) {
    return Response.json({ nonce: "freshnonce123" });
  }
  if (pathname.endsWith("/siwe/verify")) {
    const { signature } = await request.json();
    if (signature === "0xinvalid") {
      return Response.json(
        { message: "Invalid SIWE signature" },
        { status: 401 },
      );
    }
  }
  if (pathname.endsWith("/sign-out")) {
    return new Response(null, {
      status: 200,
      headers: {
        "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
      },
    });
  }
  return new Response(null, {
    status: 200,
    headers: {
      "set-cookie":
        "better-auth.session_token=passes-session; Path=/; HttpOnly; Secure; SameSite=Lax",
    },
  });
});

vi.mock("~~/lib/auth-server", () => ({ handler: { GET: get, POST: post } }));
vi.mock("~~/contracts/eventPassEnvironment", () => ({
  eventPassEnvironment: { chainId: 421614 },
}));

describe("Better Auth route adapter", () => {
  it("forwards Google callbacks to the shared Better Auth handler", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "https://passes.mint-up.xyz/api/auth/callback/google?code=code",
      ),
    );
    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledOnce();
  });

  it("forwards one-time-token verification responses without rewriting cookies", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "https://passes.mint-up.xyz/api/auth/cross-domain/one-time-token/verify",
        {
          method: "POST",
          headers: {
            origin: "https://passes.mint-up.xyz",
            "content-type": "application/json",
          },
          body: JSON.stringify({ token: "single-use-token" }),
        },
      ),
    );
    expect(response.headers.get("set-cookie")).toContain(
      "better-auth.session_token=passes-session",
    );
    expect(response.headers.get("set-cookie")).not.toMatch(/domain=/i);
  });

  it("forwards sign-out cookie clearing", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/auth/sign-out", {
        method: "POST",
      }),
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("forwards a fresh SIWE nonce without creating a session", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/auth/siwe/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: "0x1111111111111111111111111111111111111111",
          chainId: 421614,
        }),
      }),
    );

    expect(await response.json()).toEqual({ nonce: "freshnonce123" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("establishes a Passes session only after SIWE verification succeeds", async () => {
    const { POST } = await import("./route");
    const request = (signature: string) =>
      new Request("https://passes.mint-up.xyz/api/auth/siwe/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "mint-up.xyz wants you to sign in",
          signature,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chainId: 421614,
        }),
      });

    const rejected = await POST(request("0xinvalid"));
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("set-cookie")).toBeNull();

    const verified = await POST(request("0xvalid"));
    expect(verified.status).toBe(200);
    expect(verified.headers.get("set-cookie")).toContain(
      "better-auth.session_token=passes-session",
    );
  });

  it("rejects an unsupported SIWE chain before forwarding the proof", async () => {
    const { POST } = await import("./route");
    const forwardedCalls = post.mock.calls.length;
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/auth/siwe/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "wrong-chain SIWE message",
          signature: "0xvalid",
          walletAddress: "0x1111111111111111111111111111111111111111",
          chainId: 1,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(post).toHaveBeenCalledTimes(forwardedCalls);
  });
});
