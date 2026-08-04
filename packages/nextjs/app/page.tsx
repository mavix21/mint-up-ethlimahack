import { fetchQuery } from "convex/nextjs";
import { CalendarXIcon } from "lucide-react";

import { EventCard } from "~~/components/events/EventCard";
import { getEventListingCardViewModel } from "~~/components/events/event-listing-card-model";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~~/components/ui/empty";
import { mintUpApi } from "~~/lib/mint-up-api";

export const instant = false;

export default async function Home() {
  "use cache";
  // Server render time is intentionally shared by every card in this response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const result = await fetchQuery(
    mintUpApi.eventDiscovery.discover,
    {
      filters: { platforms: ["mintup"] },
      paginationOpts: { numItems: 24, cursor: null },
    },
    { url: process.env.NEXT_PUBLIC_CONVEX_URL },
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Upcoming events
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Public events hosted directly on Mint Up, ready for onchain passes.
        </p>
      </header>

      {result.page.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.page.map(event => (
            <EventCard
              key={event._id}
              event={getEventListingCardViewModel(event, now)}
            />
          ))}
        </div>
      ) : (
        <Empty className="min-h-72 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarXIcon />
            </EmptyMedia>
            <EmptyTitle>No upcoming events</EmptyTitle>
            <EmptyDescription>
              There are no public Mint Up events scheduled right now. Check back
              soon for new events and onchain passes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
