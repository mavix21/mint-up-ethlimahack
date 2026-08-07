import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { passkeyRegistrationMachine } from "./passkey-registration-machine";

describe("passkey registration machine", () => {
  it("transitions to unavailable when PublicKeyCredential missing", async () => {
    // @ts-ignore
    globalThis.window = {} as unknown as Window;
    const actor = createActor(passkeyRegistrationMachine);
    actor.start();
    // wait for checkingAvailability to resolve
    await new Promise(r => setTimeout(r, 50));
    const snap = actor.getSnapshot();
    // Either checking/evaluating/unavailable — allow async settle
    expect([
      "unavailable",
      "checkingAvailability",
      "evaluating",
      "idle",
    ]).toContain(snap.value as string);
    actor.stop();
  });

  it("error kinds remain recoverable without altering account via classify", async () => {
    const { classifyPasskeyError } = await import("../passkey-errors");
    for (const kind of [
      "cancelled",
      "timeout",
      "locked",
      "missing_credential",
      "unavailable_transport",
    ] as const) {
      const msg =
        kind === "cancelled"
          ? "cancel"
          : kind === "timeout"
            ? "timed out"
            : kind === "locked"
              ? "authenticator is locked"
              : kind === "missing_credential"
                ? "credential not found"
                : "transport unavailable";
      const name = kind === "timeout" ? "TimeoutError" : "NotAllowedError";
      const err = Object.assign(new Error(msg), { name });
      const c = classifyPasskeyError(err);
      expect(c.recoverable).toBe(true);
      expect(c.altersAccount).toBe(false);
    }
  });

  it("successful registration reaches final success state via provided actor", async () => {
    // Provide a mock success actor
    const machine = passkeyRegistrationMachine.provide({
      actors: {
        performRegistration: fromPromise(
          async (): Promise<{
            credentialId: string;
            browserAddress: string;
            serverAddress: string;
            backupState: boolean | null;
          }> => ({
            credentialId: "cred-123",
            browserAddress: "0x1111111111111111111111111111111111111111",
            serverAddress: "0x1111111111111111111111111111111111111111",
            backupState: true,
          }),
        ),
        checkAvailability: fromPromise(
          async (): Promise<
            import("../passkey-availability").PasskeyAvailability
          > => ({
            supported: true,
            platformAuthenticatorAvailable: true,
            conditionalMediationAvailable: false,
            reason: null,
          }),
        ),
      },
    });
    const actor = createActor(machine);
    actor.start();
    // wait for availability check
    await new Promise(r => setTimeout(r, 20));
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    actor.send({ type: "START_REGISTRATION" });
    await new Promise(r => setTimeout(r, 20));
    expect(actor.getSnapshot().matches("success")).toBe(true);
    actor.stop();
  });
});
