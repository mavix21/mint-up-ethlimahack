import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";

describe("sponsored user operation resume API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("rejects unauthenticated requests", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST()).status).toBe(401);
  });

  it("asks the backend for the authenticated user's operation without a hash", async () => {
    fetchAuthAction.mockResolvedValue(null);
    expect((await POST()).status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("keeps temporary provider failures retryable", async () => {
    fetchAuthAction.mockRejectedValue(
      new Error("Sponsorship provider temporarily unavailable"),
    );
    expect((await POST()).status).toBe(503);
  });
});
