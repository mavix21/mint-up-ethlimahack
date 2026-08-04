"use client";

import { CalendarIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatEventDate, formatEventTime, getCalendarDateKey, getSafeTimeZone } from "~~/lib/dates";
import { cn } from "~~/lib/utils";

interface EventCardScheduleLabelsProps {
  locale: string;
  startTime: number;
  endTime: number;
  dateLabel: string;
  timeLabel: string;
  liveUntilTemplate?: string;
}
const subscribe = () => () => {};
const getViewerTimeZone = () => getSafeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
const getServerTimeZone = () => undefined;

function EventCardDateTime({
  locale,
  startTime,
  endTime,
  timeZone,
  className,
}: {
  locale: string;
  startTime: number;
  endTime?: number;
  timeZone?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <CalendarIcon className="text-muted-foreground mt-0.75 size-4 shrink-0" />
      <div className="flex flex-col">
        <span className="font-medium">{formatEventDate(locale, startTime, timeZone)}</span>
        <span className="text-muted-foreground">{formatEventTime(locale, startTime, endTime, timeZone)}</span>
      </div>
    </div>
  );
}

function EventCardScheduleLabels({
  locale,
  startTime,
  endTime,
  dateLabel,
  timeLabel,
  liveUntilTemplate,
}: EventCardScheduleLabelsProps) {
  const timeZone = useSyncExternalStore(subscribe, getViewerTimeZone, getServerTimeZone);
  const viewerDateLabel = timeZone
    ? liveUntilTemplate
      ? dateLabel
      : formatEventDate(locale, startTime, timeZone)
    : dateLabel;
  let viewerTimeLabel = timeLabel;
  if (timeZone && liveUntilTemplate) {
    const endLabel = formatEventTime(locale, endTime, undefined, timeZone);
    const localEndLabel =
      // The live label must compare against the viewer's current local date.
      // eslint-disable-next-line react-hooks/purity
      getCalendarDateKey(Date.now(), timeZone) === getCalendarDateKey(endTime, timeZone)
        ? endLabel
        : `${new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(endTime)} ${endLabel}`;
    viewerTimeLabel = liveUntilTemplate.replace("{time}", localEndLabel);
  } else if (timeZone) viewerTimeLabel = formatEventTime(locale, startTime, endTime, timeZone);
  return (
    <>
      <div className="font-medium">{viewerDateLabel}</div>
      <div className="text-muted-foreground">{viewerTimeLabel}</div>
    </>
  );
}

export { EventCardDateTime, EventCardScheduleLabels };
export type { EventCardScheduleLabelsProps };
