import type { MintiEvent } from "~~/lib/mint-up-api";

const usd = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatEventDate(event: MintiEvent) {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  }).format(event.startTime);
}

export function formatEventTime(event: MintiEvent) {
  const formatter = new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  });
  return `${formatter.format(event.startTime)} - ${formatter.format(event.endTime)}`;
}

export function formatEventPrice(event: MintiEvent) {
  const { kinds, minUsd, maxUsd } = event.price;
  const isOnlyFree = kinds.length === 1 && kinds[0] === "free";

  if (isOnlyFree && minUsd === undefined && maxUsd === undefined)
    return "Gratis";
  if (minUsd !== undefined && maxUsd !== undefined) {
    return minUsd === maxUsd
      ? usd.format(minUsd)
      : `${usd.format(minUsd)} - ${usd.format(maxUsd)}`;
  }
  if (minUsd !== undefined) return `Desde ${usd.format(minUsd)}`;
  if (maxUsd !== undefined) return `Hasta ${usd.format(maxUsd)}`;
  if (kinds.includes("free") && kinds.includes("paid"))
    return "Gratis y de pago";
  return "Precio no disponible";
}

export function formatEventLocation(event: MintiEvent) {
  if (event.format === "online") return "En línea";
  const location = event.location;
  return (
    location?.venueName ??
    location?.label ??
    location?.district ??
    location?.address ??
    "Ubicación no disponible"
  );
}
