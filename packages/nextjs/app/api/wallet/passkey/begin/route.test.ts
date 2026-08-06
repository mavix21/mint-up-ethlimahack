import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthMutation, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthMutation: vi.fn(),
  isAuthenticated: vi.fn(),
}));

vi.mock("~~/lib/auth-server", () => ({ fetchAuthMutation, isAuthenticated }));

import { POST } from "./route";

describe("begin wallet passkey registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires a valid Better Auth session", async () => {
    isAuthenticated.mockResolvedValue(false);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(fetchAuthMutation).not.toHaveBeenCalled();
  });

  it("requests server-generated registration options for the session user", async () => {
    fetchAuthMutation.mockResolvedValue({ challenge: "server-challenge" });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "server-challenge" });
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {});
  });
});
