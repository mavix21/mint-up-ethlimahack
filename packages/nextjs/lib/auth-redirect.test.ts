import { describe, expect, it } from "vitest";
import { getLocalRedirect } from "./auth-redirect";

describe("getLocalRedirect", () => {
  it("allows local callback paths", () => {
    expect(getLocalRedirect("/account?tab=passes")).toBe("/account?tab=passes");
  });

  it.each([
    null,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
  ])("rejects a non-local callback: %s", callback => {
    expect(getLocalRedirect(callback)).toBe("/account");
  });
});
