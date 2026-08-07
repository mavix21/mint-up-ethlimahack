import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticated = vi.fn(async () => true);
const fetchAuthMutation = vi.fn(async () => null);
const fetchAuthQuery = vi.fn(async () => ({
  status: "confirmed",
  transactionHash: `0x${"a".repeat(64)}`,
  pass: {
    passId: "42",
    eventId: "event-1",
    owner: "0x4444444444444444444444444444444444444444",
    issuedTicketId: "ticket-1",
  },
}));

vi.mock("~~/lib/auth-server", () => ({
  isAuthenticated,
  fetchAuthMutation,
  fetchAuthQuery,
}));

const context = { params: Promise.resolve({ purchaseId: "purchase-1" }) };

describe("purchase synchronization route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits only a transaction hash for independent verification", async () => {
    const { POST } = await import("./route");
    const transactionHash = `0x${"a".repeat(64)}`;
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/purchases/purchase-1", {
        method: "POST",
        body: JSON.stringify({ transactionHash, passId: "browser-claim" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      purchaseId: "purchase-1",
      transactionHash,
    });
  });

  it("submits UserOperation and inclusion hashes as separate evidence", async () => {
    const { POST } = await import("./route");
    const userOperationHash = `0x${"b".repeat(64)}`;
    const transactionHash = `0x${"c".repeat(64)}`;
    const response = await POST(
      new Request("https://passes.mint-up.xyz/api/purchases/purchase-1", {
        method: "POST",
        body: JSON.stringify({ userOperationHash, transactionHash }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(fetchAuthMutation).toHaveBeenCalledWith(expect.anything(), {
      purchaseId: "purchase-1",
      userOperationHash,
      transactionHash,
    });
  });

  it("returns chain synchronization separately from transaction submission", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://passes.mint-up.xyz/api/purchases/purchase-1"),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "confirmed",
      pass: { passId: "42" },
    });
  });

  it("does not expose purchase status without a session", async () => {
    isAuthenticated.mockResolvedValueOnce(false);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://passes.mint-up.xyz/api/purchases/purchase-1"),
      context,
    );

    expect(response.status).toBe(401);
    expect(fetchAuthQuery).not.toHaveBeenCalled();
  });
});
