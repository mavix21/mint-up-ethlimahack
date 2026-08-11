import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  MapPinIcon,
} from "lucide-react";

import { Badge } from "~~/components/ui/badge";
import { Button } from "~~/components/ui/button";
import type { MintiEvent } from "~~/lib/mint-up-api";
import {
  formatEventDate,
  formatEventLocation,
  formatEventPrice,
  formatEventTime,
} from "./minti-event-format";

const availabilityLabels: Record<MintiEvent["availability"], string> = {
  available: "Available",
  waitlist: "Waitlist",
  closed: "Closed",
  unknown: "Availability unknown",
};

export function EventRecommendationCard({ event }: { event: MintiEvent }) {
  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_oklch(0_0_0/0.04),0_12px_40px_oklch(0_0_0/0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_1px_2px_oklch(0_0_0/0.04),0_20px_48px_oklch(0_0_0/0.08)] dark:bg-card/80">
      <div className="relative h-28 overflow-hidden border-b bg-[radial-gradient(circle_at_78%_24%,oklch(0.91_0.22_129),transparent_30%),linear-gradient(135deg,oklch(0.24_0.04_151),oklch(0.43_0.11_145))]">
        {event.imageUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${JSON.stringify(event.imageUrl)})`,
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-black/10" />
        <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
          <Badge className="border-white/25 bg-black/65 text-white backdrop-blur hover:bg-black/65">
            {event.format}
          </Badge>
          <Badge className="border-white/25 bg-white/90 text-neutral-900 backdrop-blur hover:bg-white/90">
            {availabilityLabels[event.availability]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3">
          {event.organizerName ? (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Hosted by {event.organizerName}
            </p>
          ) : null}
          <h3 className="text-[15px] leading-5 font-semibold tracking-[-0.01em]">
            {event.title}
          </h3>
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDaysIcon className="size-3.5" />
            <span className="font-medium text-foreground">
              {formatEventDate(event)}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Clock3Icon className="size-3.5" />
            <span>{formatEventTime(event)}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{formatEventLocation(event)}</span>
            {event.distanceKm !== undefined ? (
              <span className="ml-auto shrink-0 text-[11px]">
                {event.distanceKm.toFixed(1)} km
              </span>
            ) : null}
          </p>
        </div>

        {event.categories.length > 0 ? (
          <div className="my-4 flex flex-wrap gap-1.5">
            {event.categories.map(category => (
              <Badge
                key={category.slug}
                variant="secondary"
                className="font-normal"
              >
                {category.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto border-t pt-3">
          <p className="mb-3 font-heading text-lg font-bold tracking-tight">
            {formatEventPrice(event)}
          </p>
          <Button
            render={
              <a href={event.url} target="_blank" rel="noopener noreferrer" />
            }
            nativeButton={false}
            className="w-full justify-between"
            size="sm"
          >
            View event
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </article>
  );
}
