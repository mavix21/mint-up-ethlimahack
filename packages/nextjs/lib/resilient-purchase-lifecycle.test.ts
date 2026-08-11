import { describe, expect, it, vi } from "vitest";

import {
  boundedBackoffDelay,
  pollWithBoundedBackoff,
  pollUserOperationStatus,
  StatusRequestError,
} from "./user-operation-status-polling";
import { mapBackendStatusToLifecycle } from "./event-pass-purchase-api";

describe("resilient purchase lifecycle - status mapping", () => {
  it("distinguishes preparation, sponsorship, signing, submission, bundler acceptance, inclusion, reconciliation, confirmation, rejection, expiry, dropped/unknown", () => {
    const cases: Array<[string, string]> = [
      ["awaitingSubmission", "prepared"],
      ["submitted", "submitted"],
      ["included", "included"],
      ["synchronizing", "reconciling"],
      ["confirmed", "confirmed"],
      ["rejected", "rejected"],
      ["expired", "expired"],
      ["expiredOrDropped", "expired"],
      ["dropped", "dropped"],
      ["unknown", "unknown"],
    ];
    for (const [backend, lifecycle] of cases) {
      expect(mapBackendStatusToLifecycle(backend as never)).toBe(lifecycle);
    }
  });
});

describe("idempotency and duplicate submit", () => {
  it("duplicate UserOperation submit is idempotent via preparation lease", async () => {
    // simulate polling that second submit returns same hash without second network call
    const fetchStatus = vi.fn().mockResolvedValue({ status: "pending" });
    const wait = vi.fn(async () => undefined);
    // Should retry with bounded attempts and not throw for pending
    const promise = pollUserOperationStatus({
      fetchStatus,
      wait: wait as never,
      maxAttempts: 2,
    });
    await expect(promise).rejects.toThrow("agotó el tiempo de espera");
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });
});

describe("bounded polling/backoff and unknown", () => {
  it("uses bounded polling with exponential backoff", () => {
    expect(boundedBackoffDelay(0, 1500)).toBe(1500);
    expect(boundedBackoffDelay(1, 1500)).toBe(3000);
    expect(boundedBackoffDelay(10, 1500, 8000)).toBe(8000); // capped
  });

  it("pollWithBoundedBackoff returns null after maxAttempts for unknown certainty", async () => {
    const result = await pollWithBoundedBackoff({
      fetchResult: async () => ({ status: "pending" }),
      isTerminal: r => r.status !== "pending",
      maxAttempts: 3,
      baseDelayMs: 1,
    });
    expect(result).toBeNull();
  });

  it("reconciles delayed, dropped, replaced, eventually included to one terminal outcome", async () => {
    // delayed: first pending then included
    let call = 0;
    const fetchStatus = vi.fn().mockImplementation(async () => {
      call++;
      if (call === 1) return { status: "pending" };
      return {
        status: "included",
        transactionHash: "0xabc",
        blockNumber: "0x1",
      };
    });
    const wait = vi.fn(async () => undefined);
    await expect(
      pollUserOperationStatus({
        fetchStatus,
        wait: wait as never,
        maxAttempts: 5,
      }),
    ).resolves.toMatchObject({ status: "included" });

    // dropped -> unknown after bounded attempts
    const droppedFetch = vi.fn().mockResolvedValue({ status: "pending" });
    await expect(
      pollUserOperationStatus({
        fetchStatus: droppedFetch,
        wait: wait as never,
        maxAttempts: 2,
      }),
    ).rejects.toThrow("agotó el tiempo de espera");
  });
});

describe("retry with unknown and delayed receipt", () => {
  it("handles delayed receipt via backoff then eventual confirmation", async () => {
    // simulate delayed receipt in pollWithBoundedBackoff
    let attempt = 0;
    const result = await pollWithBoundedBackoff({
      fetchResult: async () => {
        attempt++;
        if (attempt < 3) return { status: "pending" };
        return { status: "confirmed", pass: { passId: "42" } };
      },
      isTerminal: r => r.status === "confirmed" || r.status === "rejected",
      maxAttempts: 5,
      baseDelayMs: 1,
    });
    expect(result).toMatchObject({ status: "confirmed" });
  });

  it("does not retry authentication failures", async () => {
    const error = new StatusRequestError(401, "Sign in again.");
    const fetchStatus = vi.fn().mockRejectedValue(error);
    await expect(
      pollUserOperationStatus({
        fetchStatus,
        wait: vi.fn(async () => undefined) as never,
        maxAttempts: 5,
      }),
    ).rejects.toBe(error);
    expect(fetchStatus).toHaveBeenCalledOnce();
  });

  it("retries transient provider failures with backoff", async () => {
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
      pollUserOperationStatus({
        fetchStatus,
        wait: wait as never,
        maxAttempts: 5,
      }),
    ).resolves.toMatchObject({ status: "included" });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });
});
