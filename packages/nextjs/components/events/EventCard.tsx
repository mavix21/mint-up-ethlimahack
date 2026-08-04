import type { ReactNode } from "react";
import { ArrowRightIcon, CalendarIcon, MapPinIcon, RadioIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "~~/components/ui/button";
import { cn } from "~~/lib/utils";
import type { EventListingCardViewModel } from "./event-listing-card-model";
import {
  EventCardContent,
  EventCardImage,
  EventCardListContent,
  EventCardListImage,
  EventCardListRoot,
  EventCardListTitle,
  EventCardMediaRoot,
  EventCardTitle,
} from "./event-card";
import { EventCardScheduleLabels } from "./event-card-date-time";
import { EventCardHostsLine } from "./event-card-hosts";
import { PlatformLogo } from "./platform-logo";

interface EventCardProps {
  event: EventListingCardViewModel;
  prefetch?: boolean;
  className?: string;
}
interface EventListCardFrameProps extends EventCardProps {
  children: ReactNode;
}
function PlatformPill({ event }: { event: EventListingCardViewModel }) {
  return (
    <span className="bg-secondary text-secondary-foreground inline-flex h-5 w-fit items-center gap-1.5 rounded-full px-2 text-[11px] font-medium">
      <PlatformLogo platform={event.platform} className="size-4" />
      {event.platformLabel}
    </span>
  );
}
function LivePill({ label }: { label: string }) {
  return (
    <span className="bg-destructive/10 text-destructive inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-2 text-[11px] font-medium">
      <RadioIcon className="size-3" />
      {label}
    </span>
  );
}
function EventMeta({ event }: { event: EventListingCardViewModel }) {
  return (
    <div className="grid gap-2 text-xs sm:text-sm">
      <div className="flex items-start gap-2">
        <CalendarIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0 sm:size-4" />
        <div className="min-w-0">
          <EventCardScheduleLabels
            locale={event.locale}
            startTime={event.startTime}
            endTime={event.endTime}
            dateLabel={event.dateLabel}
            timeLabel={event.timeLabel}
            liveUntilTemplate={event.liveUntilTemplate}
          />
        </div>
      </div>
      <div className="flex items-start gap-2">
        <MapPinIcon className="text-muted-foreground size-3.5 shrink-0 sm:size-4" />
        <div className="min-w-0">
          <div className="font-medium">{event.venueName ?? event.shortLocation}</div>
        </div>
      </div>
    </div>
  );
}
function context(event: EventListingCardViewModel) {
  return { imageUrl: event.imageUrl, title: event.title };
}
function EventByline({ event }: { event: EventListingCardViewModel }) {
  return event.bylineHosts ? <EventCardHostsLine hosts={event.bylineHosts} label={event.bylineLabel} /> : null;
}
function EventDetails({ event }: { event: EventListingCardViewModel }) {
  return <EventMeta event={event} />;
}
function EventCta({ event, prefetch }: EventCardProps) {
  return (
    <Link href={event.href} prefetch={prefetch} className={cn(buttonVariants({ size: "sm" }), "mt-auto w-full")}>
      {event.viewEventLabel}
      <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
    </Link>
  );
}
function EventCardLink({ event, prefetch, children }: EventListCardFrameProps) {
  return event.bylineHosts?.some(host => host.href) ? (
    children
  ) : (
    <Link href={event.href} prefetch={prefetch} className="block h-full">
      {children}
    </Link>
  );
}
function EventListFrame({ event, className, children }: EventListCardFrameProps) {
  return (
    <EventCardListRoot className={cn("h-full sm:gap-4 sm:p-3", className)} context={context(event)}>
      {event.imageUrl ? (
        <EventCardListImage className="md:size-36">
          <div className="absolute bottom-2 left-2 hidden md:block">
            <PlatformPill event={event} />
          </div>
        </EventCardListImage>
      ) : null}
      <EventCardListContent className="gap-2 py-0.5 sm:py-1">
        {event.liveLabel ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
            <LivePill label={event.liveLabel} />
          </div>
        ) : null}
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {!event.imageUrl ? <PlatformPill event={event} /> : null}
          {event.liveLabel ? <LivePill label={event.liveLabel} /> : null}
        </div>
        {children}
      </EventCardListContent>
    </EventCardListRoot>
  );
}
function EventListTitle({ event, prefetch }: EventCardProps) {
  const title = <EventCardListTitle />;
  return event.bylineHosts?.some(host => host.href) ? (
    <Link href={event.href} prefetch={prefetch}>
      {title}
    </Link>
  ) : (
    title
  );
}
function EventListCardFrame(props: EventListCardFrameProps) {
  return (
    <EventCardLink {...props}>
      <EventListFrame {...props} />
    </EventCardLink>
  );
}
function EventActionListCardFrame(props: EventListCardFrameProps) {
  return <EventListFrame {...props} />;
}
function EventListCardContent({ event, prefetch }: EventCardProps) {
  return (
    <>
      <EventByline event={event} />
      <EventListTitle event={event} prefetch={prefetch} />
      <EventDetails event={event} />
    </>
  );
}
function EventMediaCardFrame({ event, prefetch, className }: EventCardProps) {
  const pills = !event.imageUrl || Boolean(event.liveLabel);
  return (
    <EventCardMediaRoot
      size="sm"
      className={cn("h-full gap-3 rounded-3xl p-2 sm:p-3", className)}
      context={context(event)}
    >
      {event.imageUrl ? (
        <EventCardImage aspectRatio="portrait" className="rounded-2xl bg-muted">
          <div className="absolute bottom-2 left-2">
            <PlatformPill event={event} />
          </div>
        </EventCardImage>
      ) : null}
      <EventCardContent className="flex min-w-0 flex-1 flex-col gap-2 px-1 py-0.5 sm:py-1">
        {pills ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {!event.imageUrl ? <PlatformPill event={event} /> : null}
            {event.liveLabel ? <LivePill label={event.liveLabel} /> : null}
          </div>
        ) : null}
        <EventByline event={event} />
        <EventCardTitle className="line-clamp-2 text-base leading-tight font-semibold sm:line-clamp-3" />
        <EventDetails event={event} />
        <EventCta event={event} prefetch={prefetch} />
      </EventCardContent>
    </EventCardMediaRoot>
  );
}
export function EventCard(props: EventCardProps) {
  return (
    <>
      <div className="sm:hidden">
        <EventListCard {...props} />
      </div>
      <div className="hidden h-full sm:block">
        <EventMediaCardFrame {...props} />
      </div>
    </>
  );
}
export function EventListCard(props: EventCardProps) {
  return (
    <EventListCardFrame {...props}>
      <EventListCardContent {...props} />
    </EventListCardFrame>
  );
}
export { EventActionListCardFrame, EventByline, EventDetails, EventListCardFrame, EventListTitle };
export type { EventCardProps, EventListCardFrameProps };
