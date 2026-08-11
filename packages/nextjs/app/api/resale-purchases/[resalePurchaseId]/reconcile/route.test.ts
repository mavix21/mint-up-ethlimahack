import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));
vi.mock("~~/lib/auth-server", () => ({
  fetchAuthAction,
  isAuthenticated,
}));
import { POST } from "./route";

const context = {
  params: Promise.resolve({
    resalePurchaseId: "resale-purchase-0001",
  }),
};
const request = () => new Request("https://mint-up.xyz", { method: "POST" });

describe("reconcile public Pass resale purchase API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("returns success only after production verification completes", async () => {
    fetchAuthAction.mockResolvedValue(null);

    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      resalePurchaseId: "resale-purchase-0001",
    });
  });

  it("returns Retry-safe failure while verification is incomplete", async () => {
    fetchAuthAction.mockRejectedValue(new Error("not included"));

    const response = await POST(request(), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Aún no pudimos verificar la compra. Inténtalo de nuevo.",
    });
  });

  it("returns an unavailable result when another buyer completed the purchase", async () => {
    fetchAuthAction.mockRejectedValue(
      new Error("event_pass_resale_unavailable"),
    );

    const response = await POST(request(), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "listing_unavailable",
      message:
        "Esta reventa de Event Pass ya no está disponible. Es posible que otro comprador la haya completado primero. No se te cobrará.",
    });
  });
});
