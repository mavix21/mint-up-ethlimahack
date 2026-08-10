import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(__dirname, "./page.tsx");
const pageSource = readFileSync(pagePath, "utf8");

describe("passes detail terse view", () => {
  it("shows terse primary view without sales window, remaining, recipient or escrow paragraph in primary", () => {
    // Primary view must not contain the verbose blocks directly — they belong in Details
    // The page should delegate sales window / remaining / status / recipient to EventPassDetailsDisclosure
    expect(pageSource).toContain("EventPassDetailsDisclosure");

    // Primary dl should not contain Availability or Exact price grid items
    expect(pageSource).not.toContain("Availability");
    expect(pageSource).not.toContain("Exact price");

    // Legacy escrow paragraph removed from primary
    expect(pageSource).not.toContain("Before you continue");
    expect(pageSource).not.toContain("Mint Up Passes does not escrow");

    // Sales window and Event status not rendered directly in page — only via disclosure props
    // Ensure page does not have standalone <strong>Sales window</strong> or Event status paragraph outside disclosure
    const salesWindowOccurrences = (pageSource.match(/Sales window/g) ?? [])
      .length;
    // Only prop names and disclosure component should reference sales window, not primary markup
    expect(salesWindowOccurrences).toBe(0);
  });

  it("uses Get Pass vocabulary and hides jargon in primary view", () => {
    // Get Pass is rendered via InlinePurchaseGate island (server-first island keeps client boundary deep)
    const gatePath = resolve(
      __dirname,
      "../../../components/passes/inline-purchase-gate.tsx",
    );
    const gateSource = readFileSync(gatePath, "utf8");
    expect(pageSource + gateSource).toContain("Get Pass");
    // Jargon banned from buyer view — page should not reference these in primary copy
    const banned = [
      "Smart account",
      "Kernel",
      "EntryPoint",
      "Bundler",
      "Paymaster",
      "Counterfactual",
      "Arbiscan",
    ];
    for (const term of banned) {
      expect(pageSource).not.toContain(term);
    }
  });

  it("Details disclosure aggregates required fields", () => {
    const disclosurePath = resolve(
      __dirname,
      "../../../components/passes/event-pass-details-disclosure.tsx",
    );
    const disclosureSource = readFileSync(disclosurePath, "utf8");
    expect(disclosureSource).toContain("ProtectedPaymentExplanation");
    expect(disclosureSource).toContain("Sales window");
    expect(disclosureSource).toContain("Remaining");
    expect(disclosureSource).toContain("Event status");
    expect(disclosureSource).toContain("Availability");
    expect(disclosureSource).not.toContain("revenueRecipient");
    expect(disclosureSource).not.toContain("Paid directly to organizer");
    expect(disclosureSource).not.toContain('"use client"');
  });
});
