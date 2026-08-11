import type { Metadata } from "next";
import Image from "next/image";
import { CalendarClockIcon, CompassIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "~~/components/ui/button";
import { MintiChat } from "./_components/minti-chat";

export const metadata: Metadata = {
  title: "Ask Minti",
  description:
    "Discover events, meet your people, and secure an Event Pass through Mint Up.",
};

function ChatHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground">
          <CompassIcon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">
            Minti event assistant
          </h2>
          <p className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            Current event index
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="hidden items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
          <ShieldCheckIcon className="size-3 text-primary-foreground" />
          Approval required to purchase
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Conversation details"
          disabled
        >
          <CalendarClockIcon />
        </Button>
      </div>
    </header>
  );
}

function Welcome() {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/15 p-1.5 shadow-lg shadow-primary/10 ring-1 ring-primary/20">
        <Image
          src="/logo.png"
          alt="Minti"
          width={48}
          height={48}
          className="size-full object-contain"
          priority
        />
      </div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        Find your next room.
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Tell me what you want to learn, who you want to meet, and when
        you&apos;re free. I&apos;ll search the current events around you.
      </p>
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-152 overflow-hidden bg-background md:h-[calc(100dvh-4.5rem)]">
      <MintiChat welcome={<Welcome />} header={<ChatHeader />} />
    </div>
  );
}
