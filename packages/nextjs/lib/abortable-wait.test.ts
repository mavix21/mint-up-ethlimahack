import { afterEach, describe, expect, it, vi } from "vitest";

import { abortableWait } from "./abortable-wait";

describe("abortable wait", () => {
  afterEach(() => vi.useRealTimers());

  it("removes its abort listener when the timer resolves", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    const pending = abortableWait(2_000, controller.signal);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBeUndefined();

    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
  });
});
