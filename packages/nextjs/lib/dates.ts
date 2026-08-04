export function getSafeTimeZone(timeZone?: string) {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return undefined;
  }
}

export function formatEventDate(locale: string, timestamp: number, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: getSafeTimeZone(timeZone),
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(timestamp));
}

export function getCalendarDateKey(timestamp: number, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getSafeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function formatEventTime(locale: string, startTime: number, endTime?: number, timeZone?: string) {
  const safeTimeZone = getSafeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const start = formatter.format(new Date(startTime));
  const zone = safeTimeZone
    ? new Intl.DateTimeFormat(locale, { timeZone: safeTimeZone, timeZoneName: "short" })
        .formatToParts(new Date(startTime))
        .find(part => part.type === "timeZoneName")?.value
    : undefined;
  if (!endTime) return zone ? `${start} ${zone}` : start;
  const end = formatter.format(new Date(endTime));
  const sameDay = getCalendarDateKey(startTime, safeTimeZone) === getCalendarDateKey(endTime, safeTimeZone);
  const endLabel = sameDay
    ? end
    : `${new Intl.DateTimeFormat(locale, { timeZone: safeTimeZone, day: "numeric", month: "short" }).format(endTime)}, ${end}`;
  return zone ? `${start} - ${endLabel} ${zone}` : `${start} - ${endLabel}`;
}
