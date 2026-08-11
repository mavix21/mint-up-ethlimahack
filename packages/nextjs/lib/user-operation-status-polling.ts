import type { UserOperationStatusResult } from "./pimlico-user-operation-api";

export class StatusRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StatusRequestError";
  }
}

function isRetryable(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof StatusRequestError && error.status === 503)
  );
}

export async function pollUserOperationStatus({
  fetchStatus,
  wait,
  maxAttempts,
}: {
  fetchStatus: () => Promise<UserOperationStatusResult>;
  wait: (attempt: number) => Promise<void>;
  maxAttempts: number;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(attempt);
    try {
      const result = await fetchStatus();
      if (result.status !== "pending") return result;
    } catch (error) {
      if (!isRetryable(error)) throw error;
    }
  }
  throw new Error(
    "La consulta del estado agotó el tiempo de espera. El hash de la operación sigue disponible abajo.",
  );
}

export function boundedBackoffDelay(
  attempt: number,
  baseMs = 2000,
  maxMs = 15000,
) {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

export async function pollWithBoundedBackoff<T>({
  fetchResult,
  isTerminal,
  maxAttempts = 10,
  baseDelayMs = 2000,
  signal,
}: {
  fetchResult: () => Promise<T>;
  isTerminal: (result: T) => boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted)
      throw new DOMException("Polling stopped", "AbortError");
    try {
      const result = await fetchResult();
      if (isTerminal(result)) return result;
    } catch (error) {
      if (!isRetryable(error)) throw error;
    }
    const delay = boundedBackoffDelay(attempt, baseDelayMs);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Polling stopped", "AbortError"));
      });
    });
  }
  return null;
}
