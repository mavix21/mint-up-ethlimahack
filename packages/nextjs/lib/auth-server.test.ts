import { afterEach, beforeAll, expect, it, vi } from "vitest";

const convexSiteUrl = "https://auth.example.com";

vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        cookie: "better-auth.session_token=test",
        "x-forwarded-host": "passes.mint-up.xyz",
      }),
  ),
}));

let authServer: typeof import("./auth-server");

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://convex.example.com");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", convexSiteUrl);
  authServer = await import("./auth-server");
});

afterEach(() => vi.restoreAllMocks());

it("proxies browser auth without overriding Convex routing", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 200 }));

  await authServer.handler.GET(
    new Request("https://passes.mint-up.xyz/api/auth/get-session", {
      headers: { "x-forwarded-host": "passes.mint-up.xyz" },
    }),
  );

  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  const requestHeaders = new Headers(init?.headers);
  expect(url.toString()).toBe(`${convexSiteUrl}/api/auth/get-session`);
  expect(requestHeaders.get("x-forwarded-host")).toBeNull();
  expect(requestHeaders.get("x-better-auth-forwarded-host")).toBe(
    "passes.mint-up.xyz",
  );
});

it("fetches server auth without overriding Convex routing", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ token: "test-token" }));

  await expect(authServer.isAuthenticated()).resolves.toBe(true);

  const [, init] = fetchSpy.mock.calls[0] ?? [];
  const requestHeaders = new Headers(init?.headers);
  expect(requestHeaders.get("host")).toBe(new URL(convexSiteUrl).host);
  expect(requestHeaders.get("x-forwarded-host")).toBeNull();
});
