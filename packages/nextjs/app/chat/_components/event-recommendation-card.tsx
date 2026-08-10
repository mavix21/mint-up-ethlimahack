import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  MapPinIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "~~/components/ui/badge";
import { Button } from "~~/components/ui/button";
import { cn } from "~~/lib/utils";

type EventRecommendation = {
  title: string;
  host: string;
  date: string;
  time: string;
  location: string;
  distance: string;
  price: string;
  match: string;
  spotsLeft: number;
  tags: readonly string[];
  artwork: string;
  featured?: boolean;
};

function EventRecommendationCard({ event }: { event: EventRecommendation }) {
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_oklch(0_0_0/0.04),0_12px_40px_oklch(0_0_0/0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_1px_2px_oklch(0_0_0/0.04),0_20px_48px_oklch(0_0_0/0.08)] dark:bg-card/80",
        event.featured && "border-primary/40 ring-1 ring-primary/10",
      )}
    >
      <div
        className={cn(
          "relative h-24 overflow-hidden border-b p-4 sm:h-28",
          event.artwork,
        )}
      >
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,oklch(1_0_0/0.24),transparent_80%)]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="rounded-2xl border border-white/30 bg-white/85 px-3 py-2 text-center text-neutral-950 shadow-sm backdrop-blur dark:bg-neutral-950/80 dark:text-white">
            <span className="block text-[10px] font-bold tracking-[0.16em] uppercase">
              Aug
            </span>
            <span className="block font-heading text-2xl leading-6 font-black">
              15
            </span>
          </div>
          <Badge className="border-white/30 bg-white/85 text-neutral-900 shadow-sm backdrop-blur hover:bg-white/85 dark:bg-neutral-950/80 dark:text-white">
            {event.match} match
          </Badge>
        </div>
        <div className="absolute right-4 bottom-3 left-4 h-px bg-white/30" />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Hosted by {event.host}
          </p>
          <h3 className="text-[15px] leading-5 font-semibold tracking-[-0.01em]">
            {event.title}
          </h3>
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDaysIcon className="size-3.5" />
            <span className="font-medium text-foreground">{event.date}</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock3Icon className="size-3.5" />
            <span>{event.time}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
            <span className="ml-auto shrink-0 text-[11px]">
              {event.distance}
            </span>
          </p>
        </div>

        <div className="my-4 flex flex-wrap gap-1.5">
          {event.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="mt-auto border-t pt-3">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Event Pass</p>
              <p className="font-heading text-lg font-bold tracking-tight">
                {event.price}
              </p>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <UsersIcon className="size-3" />
              {event.spotsLeft} left
            </p>
          </div>
          <Button type="button" className="w-full justify-between" size="sm">
            Get pass
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheckIcon className="size-3" />
            Protected USDC payment
          </p>
        </div>
      </div>
    </article>
  );
}

export { EventRecommendationCard };
export type { EventRecommendation };
