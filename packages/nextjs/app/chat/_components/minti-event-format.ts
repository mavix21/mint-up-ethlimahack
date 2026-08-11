import type { MintiEvent } from "~~/lib/mint-up-api";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatEventDate(event: MintiEvent) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  }).format(event.startTime);
}

export function formatEventTime(event: MintiEvent) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  });
  return `${formatter.format(event.startTime)} - ${formatter.format(event.endTime)}`;
}

export function formatEventPrice(event: MintiEvent) {
  const { kinds, minUsd, maxUsd } = event.price;
  const isOnlyFree = kinds.length === 1 && kinds[0] === "free";

  if (isOnlyFree && minUsd === undefined && maxUsd === undefined) return "Free";
  if (minUsd !== undefined && maxUsd !== undefined) {
    return minUsd === maxUsd
      ? usd.format(minUsd)
      : `${usd.format(minUsd)} - ${usd.format(maxUsd)}`;
  }
  if (minUsd !== undefined) return `From ${usd.format(minUsd)}`;
  if (maxUsd !== undefined) return `Up to ${usd.format(maxUsd)}`;
  if (kinds.includes("free") && kinds.includes("paid")) return "Free and paid";
  return "Price unavailable";
}

export function formatEventLocation(event: MintiEvent) {
  if (event.format === "online") return "Online";
  const location = event.location;
  return (
    location?.venueName ??
    location?.label ??
    location?.district ??
    location?.address ??
    "Location unavailable"
  );
}
