import { describe, expect, it, vi } from "vitest";

import {
  pollUserOperationStatus,
  StatusRequestError,
} from "./user-operation-status-polling";

describe("user operation status polling", () => {
  it("retries transient provider failures before returning a terminal status", async () => {
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new StatusRequestError(503, "Unavailable"))
      .mockRejectedValueOnce(new TypeError("network failure"))
      .mockResolvedValueOnce({
        status: "included",
        transactionHash: "0x1234",
        blockNumber: "0x1",
      });
    const wait = vi.fn(async () => undefined);

    await expect(
      pollUserOperationStatus({ fetchStatus, wait, maxAttempts: 3 }),
    ).resolves.toMatchObject({ status: "included" });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(3);
  });

  it("does not retry authentication failures", async () => {
    const error = new StatusRequestError(401, "Sign in again.");
    const fetchStatus = vi.fn().mockRejectedValue(error);

    await expect(
      pollUserOperationStatus({
        fetchStatus,
        wait: vi.fn(async () => undefined),
        maxAttempts: 60,
      }),
    ).rejects.toBe(error);
    expect(fetchStatus).toHaveBeenCalledOnce();
  });

  it("ends repeated transient failures with a stable timeout", async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new TypeError("offline"));

    await expect(
      pollUserOperationStatus({
        fetchStatus,
        wait: vi.fn(async () => undefined),
        maxAttempts: 2,
      }),
    ).rejects.toThrow(
      "Status polling timed out. The operation hash remains available below.",
    );
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });
});
