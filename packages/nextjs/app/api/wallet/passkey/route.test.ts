import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthQuery, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthQuery: vi.fn(),
  isAuthenticated: vi.fn(),
}));

vi.mock("~~/lib/auth-server", () => ({ fetchAuthQuery, isAuthenticated }));

import { GET } from "./route";

describe("wallet passkey account API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("rejects requests without a valid Better Auth session", async () => {
    isAuthenticated.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetchAuthQuery).not.toHaveBeenCalled();
  });

  it("retrieves the current user's account without browser-supplied authority", async () => {
    fetchAuthQuery.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ account: null });
    expect(fetchAuthQuery).toHaveBeenCalledWith(expect.anything(), {});
  });
});
