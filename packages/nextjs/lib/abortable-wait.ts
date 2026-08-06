export function abortableWait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Polling stopped", "AbortError"));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      callback();
    };
    const abort = () =>
      finish(() => reject(new DOMException("Polling stopped", "AbortError")));
    const timer = setTimeout(() => finish(resolve), milliseconds);
    signal.addEventListener("abort", abort);
  });
}
