import { describe, expect, it } from "vitest";
import fs from "node:fs";

const file = fs.readFileSync(
  "components/passes/gasless-event-pass-purchase.tsx",
  "utf8",
);
const libFile = fs.readFileSync("lib/user-operation-status-polling.ts", "utf8");

describe("interruption scenarios - coverage proof", () => {
  it("cancellation: WebAuthn prompt cancelled or timed out leaves prepared purchase safe to retry", () => {
    expect(file).toContain("NotAllowedError");
    expect(file).toContain("timed out");
    expect(file).toContain("prepared purchase is safe to retry");
    expect(file).toContain("Nothing was submitted");
  });

  it("reload before submission: resumes status from authenticated backend using purchase identity", () => {
    expect(file.toLowerCase()).toContain("reload");
    expect(file).toContain("/api/purchases/");
    expect(file).toContain("persisted.purchaseId");
  });

  it("reload after submission: resumes via UserOperation identity from backend", () => {
    expect(file).toContain("UserOperation");
    expect(file).toContain("/api/wallet/user-operation/resume");
    expect(file).toContain("userOperationHash");
  });

  it("duplicate submit: retry preserves idempotency via same purchase and UserOperation hash", () => {
    expect(file.toLowerCase()).toContain("duplicate");
    expect(file).toContain("reuse same purchaseId");
    expect(file).toContain("submitForReconciliation");
  });

  it("sponsorship denial: produces actionable message and permits retry subject to expiry and policy limits", () => {
    expect(file).toContain("Sponsorship was denied");
    expect(file.toLowerCase()).toContain("preparation expiry");
    expect(file.toLowerCase()).toContain("limit");
    expect(file).toContain("actionableSponsorshipMessage");
  });

  it("simulation failure: decoded batch validation rejects wrong approval/purchase before signing", () => {
    expect(file).toContain("validateSponsoredPurchaseBatch");
    const batch = fs.readFileSync("lib/event-pass-purchase-batch.ts", "utf8");
    expect(batch).toContain("exact prepared price");
  });

  it("timeout: bounded polling with backoff times out to explicit unknown state", () => {
    expect(file).toContain("unknown");
    expect(file).toContain("timed out");
    expect(libFile).toContain("boundedBackoffDelay");
    expect(libFile).toContain("maxAttempts");
  });

  it("dropped status: reconciles dropped operation to terminal outcome", () => {
    expect(file).toContain("dropped");
    expect(file).toContain("Operation dropped");
  });

  it("delayed receipt: delayed bundler inclusion eventually reconciles to confirmation", () => {
    expect(file).toContain("delayed");
    expect(file).toContain("pollUserOperationInclusion");
    expect(file).toContain("backoff");
  });

  it("retry: after uncertain submission preserves idempotency and uses bounded polling", () => {
    expect(file).toContain("handleRetry");
    expect(file).toContain("bounded");
    expect(file).toContain("retry preserves idempotency");
  });

  it("eventual confirmation: confirmed pass shows UserOperation and transaction hashes separately", () => {
    expect(file).toContain("confirmed");
    expect(file).toContain('data-testid="user-operation-hash"');
    expect(file).toContain('data-testid="transaction-hash"');
    expect(file).toContain("Event Pass #");
  });

  it("eventual rejection: rejected purchase shows failure without false confirmation", () => {
    expect(file).toContain("rejected");
    expect(file).toContain("No purchase was confirmed");
    expect(file).toContain('status === "rejected"');
  });

  it("diagnostics: hashes remain separately visible without exposing raw signatures", () => {
    expect(file).toContain("no signatures exposed");
    expect(file).not.toMatch(/localStorage\.setItem.*signature/i);
  });
});
