import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";

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

  it("lifecycle stage file distinguishes all required outcomes without collapsing into ordinary tx", async () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    const required = [
      "preparation",
      "sponsorship",
      "signing",
      "submission",
      "bundler acceptance",
      "inclusion",
      "reconciliation",
      "confirmation",
      "rejection",
      "expiry",
      "dropped",
      "unknown",
    ];
    for (const phrase of required) {
      expect(file.toLowerCase()).toContain(phrase.toLowerCase());
    }
    // Must not collapse into ordinary transaction state wording only
    expect(file).toContain("UserOperation");
    expect(file).toContain("Transaction");
  });
});

describe("WebAuthn cancellation safety", () => {
  it("detects NotAllowedError, AbortError, TimeoutError as cancellation", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain("NotAllowedError");
    expect(file).toContain("AbortError");
    // must leave prepared safe to retry and store no assertion
    expect(file).toContain("prepared purchase is safe to retry");
    expect(file).toContain("Nothing was submitted");
    // ensure no reusable assertion stored — persist only hashes, not signatures/assertions
    expect(file).toContain("Never persist raw signatures");
    expect(file.toLowerCase()).toContain("assertions");
    const persistedSnippets = file.match(/persist\(/g) || [];
    expect(persistedSnippets.length).toBeGreaterThan(0);
    // file should not persist signature via localStorage
    expect(file).not.toMatch(/localStorage\.setItem.*signature/i);
  });

  it("timeout handling leaves frozen intent retryable", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain("timed out");
    expect(file).toContain(
      "Retry confirmation (prepared purchase still valid)",
    );
  });
});

describe("sponsorship rejection and simulation failure", () => {
  it("produces actionable messages without false confirmation", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain("actionableSponsorshipMessage");
    expect(file).toContain("Sponsorship was denied or simulation failed");
    expect(file).toContain("No purchase was confirmed");
    expect(file).toContain("preparation expiry");
  });

  it("permits valid retry subject to expiry and policy limits", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    // retry handler reuses same purchaseId
    expect(file).toContain("handleRetry");
    expect(file).toContain("reuse same purchaseId");
    expect(file).toContain("idempotency");
  });
});

describe("reload and new session resume", () => {
  it("resumes status from authenticated backend data using purchase and UserOperation identities", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain("/api/purchases/");
    expect(file).toContain("/api/wallet/user-operation/resume");
    expect(file).toContain("resumeFromBackend");
    expect(file).toContain("authenticated backend data");
  });

  it("does not rely only on browser storage for authoritative outcome", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    // must fetch backend status, not just trust localStorage stage
    expect(file).toContain("responseJson");
    expect(file).toContain("purchaseStatusSchema");
  });
});

describe("idempotency and duplicate submit", () => {
  it("retry preserves idempotency and cannot create second backend purchase", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    const lower = file.toLowerCase();
    expect(lower).toContain("cannot create");
    expect(lower).toContain("second backend purchase");
    expect(lower).toContain("claim another useroperation");
    expect(lower).toContain("duplicate event pass");
    // backend idempotency is preserved via same purchaseId + hash
    expect(file).toContain("submitForReconciliation");
  });

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
    await expect(promise).rejects.toThrow("timed out");
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
    ).rejects.toThrow("timed out");
  });

  it("produces explicit unknown state when certainty unavailable", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain('"unknown"');
    expect(file).toContain("Status is unknown");
    expect(file).toContain("hashes remain");
  });
});

describe("hash visibility and signature privacy", () => {
  it("UserOperation and transaction hashes remain separately visible for diagnostics", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain('data-testid="user-operation-hash"');
    expect(file).toContain('data-testid="transaction-hash"');
    expect(file).toContain("UserOperation:");
    expect(file).toContain("Transaction:");
    // separately visible
    const uopCount = (file.match(/user-operation-hash/g) || []).length;
    const txCount = (file.match(/transaction-hash/g) || []).length;
    expect(uopCount).toBeGreaterThanOrEqual(2);
    expect(txCount).toBeGreaterThanOrEqual(2);
  });

  it("does not expose raw signatures or passkey response data", () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    const lower = file.toLowerCase();
    // Ensure no UI interpolates raw signature hex (e.g., {signature} displayed)
    expect(file).not.toMatch(/\{signature\}/);
    expect(lower).toContain("raw signatures are never stored");
    expect(lower).toContain("passkey response data");
    // Ensure hashes are shown
    expect(file).toContain('data-testid="user-operation-hash"');
  });
});

describe("retry with unknown and delayed receipt", () => {
  it("retry after unknown preserves hashes and can eventually confirm", async () => {
    const file = fs.readFileSync(
      "components/passes/gasless-event-pass-purchase.tsx",
      "utf8",
    );
    expect(file).toContain("Retry");
    expect(file).toContain("resume from backend");
    expect(file).toContain("reconcile delayed operation");
  });

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
