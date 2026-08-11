const REQUEST_TIMEOUT_MESSAGE = "La solicitud agotó el tiempo de espera";

export async function fetchWithTimeout(
  fetchFn: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new Error(REQUEST_TIMEOUT_MESSAGE)),
    timeoutMs,
  );

  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });

  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
