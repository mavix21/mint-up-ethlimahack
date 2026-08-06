import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthAction, isAuthenticated } = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  isAuthenticated: vi.fn(),
}));

vi.mock("~~/lib/auth-server", () => ({ fetchAuthAction, isAuthenticated }));

import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://passes.mint-up.xyz/api/wallet/passkey/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("complete wallet passkey registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated.mockResolvedValue(true);
  });

  it("requires a valid Better Auth session", async () => {
    isAuthenticated.mockResolvedValue(false);

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });

  it("fails closed for malformed credential responses", async () => {
    const response = await POST(request({ accountAddress: "not-an-address" }));

    expect(response.status).toBe(400);
    expect(fetchAuthAction).not.toHaveBeenCalled();
  });

  it("forwards only the credential and independently derived address", async () => {
    const body = {
      accountAddress: "0x1111111111111111111111111111111111111111",
      credential: {
        id: "credential-id",
        rawId: "credential-id",
        type: "public-key",
        clientExtensionResults: {},
        response: {
          attestationObject: "attestation",
          clientDataJSON: "client-data",
        },
      },
    };
    fetchAuthAction.mockResolvedValue({ address: body.accountAddress });

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      response: body.credential,
      browserAddress: body.accountAddress,
    });
  });
});
