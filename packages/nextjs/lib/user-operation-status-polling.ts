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
  wait: () => Promise<void>;
  maxAttempts: number;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait();
    try {
      const result = await fetchStatus();
      if (result.status !== "pending") return result;
    } catch (error) {
      if (!isRetryable(error)) throw error;
    }
  }
  throw new Error(
    "Status polling timed out. The operation hash remains available below.",
  );
}
