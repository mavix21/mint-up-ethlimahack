import type { MintUpEvent } from "~~/lib/mint-up-api";
import {
  formatEventDate,
  formatEventTime,
  getCalendarDateKey,
} from "~~/lib/dates";

const mintUpWebUrl =
  process.env.MINT_UP_WEB_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://mint-up.xyz"
    : "http://localhost:3001");

export interface EventListingCardViewModel {
  title: string;
  imageUrl?: string;
  href: string;
  viewEventLabel: string;
  platform: MintUpEvent["platform"];
  platformLabel: string;
  venueName?: string;
  shortLocation: string;
  bylineLabel?: string;
  bylineHosts?: { name: string; image?: string; href?: string }[];
  dateLabel: string;
  timeLabel: string;
  locale: string;
  startTime: number;
  endTime: number;
  liveUntilTemplate?: string;
  liveLabel?: string;
}

function location(event: MintUpEvent) {
  if (event.place.kind === "online")
    return { shortLocation: "Online", venueName: undefined };
  const value = event.place.location;
  const text = value.kind === "resolved" ? value.address : value.label;
  const venueName = value.kind === "resolved" ? value.venueName : undefined;
  return { shortLocation: venueName ?? text, venueName };
}

export function getEventListingCardViewModel(
  event: MintUpEvent,
  now: number,
): EventListingCardViewModel {
  const locale = "en-US";
  const live = event.startTime <= now && event.endTime > now;
  const image = event.organizer?.image;
  const organizerImage =
    typeof image === "string"
      ? image
      : image?.kind === "url"
        ? image.url
        : undefined;
  let timeLabel = formatEventTime(
    locale,
    event.startTime,
    event.endTime,
    event.timezone,
  );
  if (live) {
    const end = formatEventTime(
      locale,
      event.endTime,
      undefined,
      event.timezone,
    );
    const endLabel =
      getCalendarDateKey(now, event.timezone) ===
      getCalendarDateKey(event.endTime, event.timezone)
        ? end
        : `${new Intl.DateTimeFormat(locale, { timeZone: event.timezone, weekday: "long" }).format(event.endTime)} ${end}`;
    timeLabel = `Until ${endLabel}`;
  }
  return {
    title: event.name,
    imageUrl: event.image?.url,
    href: `${mintUpWebUrl}/en/e/${event._id}`,
    viewEventLabel: "View event",
    platform: event.platform,
    platformLabel: "Mint Up",
    ...location(event),
    bylineLabel: event.organizer ? "Organized by" : undefined,
    bylineHosts: event.organizer
      ? [
          {
            name: event.organizer.name,
            ...(organizerImage ? { image: organizerImage } : {}),
          },
        ]
      : undefined,
    dateLabel: live
      ? "Live"
      : formatEventDate(locale, event.startTime, event.timezone),
    timeLabel,
    locale,
    startTime: event.startTime,
    endTime: event.endTime,
    liveUntilTemplate: live ? "Until {time}" : undefined,
    liveLabel: live ? "Live" : undefined,
  };
}
