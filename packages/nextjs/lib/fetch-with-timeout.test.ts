import { describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-with-timeout";

describe("fetchWithTimeout", () => {
  it("aborts a request that never responds", async () => {
    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    await expect(
      fetchWithTimeout(fetchFn, "/api/purchases/purchase-1", {}, 1),
    ).rejects.toThrow("La solicitud agotó el tiempo de espera");
  });

  it("propagates cancellation from the purchase flow", async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const pending = fetchWithTimeout(
      fetchFn,
      "/api/purchases/purchase-1",
      { signal: controller.signal },
      1_000,
    );

    controller.abort(new DOMException("Polling stopped", "AbortError"));

    await expect(pending).rejects.toThrow("Polling stopped");
  });
});
