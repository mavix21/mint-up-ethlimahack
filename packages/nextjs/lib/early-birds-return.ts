import type { PurchaseStatus } from "./event-pass-purchase-api";

export const EARLY_BIRDS_RETURN_PARAM = "earlybirds";
export const EARLY_BIRDS_RETURN_VALUE = "return";
export const EARLY_BIRDS_LOCALES = ["en", "es"] as const;

type EarlyBirdsLocale = (typeof EARLY_BIRDS_LOCALES)[number];

function isSupportedLocale(segment: string): segment is EarlyBirdsLocale {
  return (EARLY_BIRDS_LOCALES as readonly string[]).includes(segment);
}

export function resolveEarlyBirdsReturnDestination(
  value: string | null | undefined,
  trustedOrigins: readonly string[],
): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (!trustedOrigins.includes(url.origin)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (!isSupportedLocale(segments[0] ?? "")) return null;
  const isSafeRoute =
    segments.length === 1 ||
    (segments.length === 2 && segments[1] === "early-birds");
  if (!isSafeRoute) return null;

  const clean = new URL(url.origin);
  clean.pathname = url.pathname;
  clean.searchParams.set(EARLY_BIRDS_RETURN_PARAM, EARLY_BIRDS_RETURN_VALUE);
  return clean.toString();
}

export function getEventPassHref(
  eventId: string,
  returnTo?: string | null,
): string {
  const base = `/passes/${encodeURIComponent(eventId)}`;
  return returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
}

export function getEarlyBirdsRedirectUrl(
  returnTo: string | null | undefined,
  status: PurchaseStatus["status"] | undefined,
  locallyConfirmed: boolean,
): string | null {
  return returnTo && status === "confirmed" && locallyConfirmed
    ? returnTo
    : null;
}
