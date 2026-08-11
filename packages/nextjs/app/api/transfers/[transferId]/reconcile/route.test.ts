import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));
import { POST } from "./route";

const request = new Request(
  "https://mint-up.xyz/api/transfers/jh712transferintent/reconcile",
  { method: "POST" },
);
const context = {
  params: Promise.resolve({ transferId: "jh712transferintent" }),
};

describe("reconcile Event Pass transfer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires authentication", async () => {
    isAuthenticated.mockResolvedValue(false);
    expect((await POST(request, context)).status).toBe(401);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });

  it("reports success only after production reconciliation", async () => {
    fetchAuthAction.mockResolvedValue(null);

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      transferId: "jh712transferintent",
    });
  });

  it("returns a concise retry failure without backend details", async () => {
    fetchAuthAction.mockRejectedValue(new Error("receipt secret"));

    const response = await POST(request, context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Aún no pudimos verificar la transferencia. Inténtalo de nuevo.",
    });
  });
});
