import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

import { successDialogMachine } from "./success-dialog-machine";

describe("success dialog machine - auto-redirect timer", () => {
  it("starts open and auto-redirects after ~2s", async () => {
    vi.useFakeTimers();
    const actor = createActor(successDialogMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe("open");
    vi.advanceTimersByTime(1999);
    expect(actor.getSnapshot().value).toBe("open");
    vi.advanceTimersByTime(1);
    // after 2000, should transition to redirecting (final state, so done)
    expect(actor.getSnapshot().value).toBe("redirecting");
    actor.stop();
    vi.useRealTimers();
  });

  it("View passes immediately transitions to redirecting and cancels timer", () => {
    vi.useFakeTimers();
    const actor = createActor(successDialogMachine);
    actor.start();
    actor.send({ type: "VIEW_PASSES" });
    expect(actor.getSnapshot().value).toBe("redirecting");
    vi.advanceTimersByTime(5000);
    expect(actor.getSnapshot().value).toBe("redirecting");
    actor.stop();
    vi.useRealTimers();
  });

  it("CLOSE immediately transitions to redirecting", () => {
    vi.useFakeTimers();
    const actor = createActor(successDialogMachine);
    actor.start();
    actor.send({ type: "CLOSE" });
    expect(actor.getSnapshot().value).toBe("redirecting");
    actor.stop();
    vi.useRealTimers();
  });

  it("exposes open -> redirecting states for temporal celebration with skip affordance", () => {
    const actor = createActor(successDialogMachine);
    actor.start();
    expect(actor.getSnapshot().matches("open")).toBe(true);
    actor.send({ type: "VIEW_PASSES" });
    expect(actor.getSnapshot().matches("redirecting")).toBe(true);
    actor.stop();
  });
});
