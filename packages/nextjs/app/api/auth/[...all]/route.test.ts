import { describe, expect, it, vi } from "vitest";

const get = vi.fn(
  async () =>
    new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 }),
);
const post = vi.fn(async (request: Request) => {
  const pathname = new URL(request.url).pathname;
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
});
