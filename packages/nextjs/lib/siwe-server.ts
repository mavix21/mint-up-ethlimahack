import "server-only";

import { resolveEarlyBirdsReturnDestination } from "./early-birds-return";

export function getMintUpSiweOrigin() {
  const configuredOrigin =
    process.env.MINT_UP_WEB_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://mint-up.xyz"
      : "http://localhost:3001");
  return new URL(configuredOrigin).origin;
}

export function resolveMintUpReturnDestination(
  value: string | null | undefined,
) {
  return resolveEarlyBirdsReturnDestination(value, [getMintUpSiweOrigin()]);
}
