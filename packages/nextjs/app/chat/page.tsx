import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowUpIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  CompassIcon,
  HistoryIcon,
  MapPinIcon,
  MessageSquarePlusIcon,
  PaperclipIcon,
  SearchIcon,
  ShieldCheckIcon,
  TicketCheckIcon,
} from "lucide-react";

import { Bubble, BubbleContent } from "~~/components/ui/bubble";
import { Button } from "~~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "~~/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "~~/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "~~/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "~~/components/ui/message-scroller";

import {
  EventRecommendationCard,
  type EventRecommendation,
} from "./_components/event-recommendation-card";

export const metadata: Metadata = {
  title: "Ask Minti",
  description:
    "Discover events, meet your people, and secure an Event Pass through Mint Up.",
};

const recommendations: readonly EventRecommendation[] = [
  {
    title: "AI Agents for Onchain Communities",
    host: "Ethereum Lima",
    date: "Saturday, August 15",
    time: "3:00 PM - 5:30 PM",
    location: "Cultural Station, Miraflores",
    distance: "0.8 km",
    price: "18 USDC",
    match: "98%",
    spotsLeft: 12,
    tags: ["AI", "Ethereum", "Workshop"],
    artwork:
      "bg-[radial-gradient(circle_at_78%_24%,oklch(0.91_0.22_129),transparent_30%),linear-gradient(135deg,oklch(0.24_0.04_151),oklch(0.43_0.11_145))]",
    featured: true,
  },
  {
    title: "Builders Sunset: ZK, AI & Pisco",
    host: "Web3 Peru",
    date: "Saturday, August 15",
    time: "6:00 PM - 9:00 PM",
    location: "Rooftop 404, Miraflores",
    distance: "1.4 km",
    price: "10 USDC",
    match: "94%",
    spotsLeft: 21,
    tags: ["Networking", "ZK", "Social"],
    artwork:
      "bg-[radial-gradient(circle_at_20%_15%,oklch(0.84_0.18_78),transparent_32%),linear-gradient(140deg,oklch(0.35_0.16_25),oklch(0.49_0.19_320))]",
  },
  {
    title: "Solana x AI Consumer Apps Meetup",
    host: "Superteam Peru",
    date: "Saturday, August 15",
    time: "2:30 PM - 4:30 PM",
    location: "Pardo Tech Hub, Miraflores",
    distance: "1.1 km",
    price: "Free",
    match: "89%",
    spotsLeft: 8,
    tags: ["AI", "Solana", "Demos"],
    artwork:
      "bg-[radial-gradient(circle_at_80%_15%,oklch(0.83_0.17_190),transparent_32%),linear-gradient(140deg,oklch(0.24_0.1_292),oklch(0.43_0.17_280))]",
  },
];

const conversations = [
  { title: "AI events this weekend", active: true },
  { title: "Design meetups in Barranco", active: false },
  { title: "ETH Lima side events", active: false },
];

function MintiAvatar() {
  return (
    <MessageAvatar className="size-9 self-start bg-primary/15 p-1 shadow-sm ring-4 ring-background">
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-full object-contain"
      />
    </MessageAvatar>
  );
}

function ConversationSidebar() {
  return (
    <aside className="hidden min-h-0 flex-col border-r bg-muted/25 lg:flex">
      <div className="border-b p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start bg-background shadow-xs"
        >
          <MessageSquarePlusIcon data-icon="inline-start" />
          New conversation
          <span className="ml-auto text-[10px] text-muted-foreground">⌘ K</span>
        </Button>
      </div>

      <nav aria-label="Recent conversations" className="min-h-0 flex-1 p-2">
        <div className="mb-2 flex items-center gap-2 px-2 pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <HistoryIcon className="size-3.5" />
          Recent
        </div>
        <ul className="space-y-0.5">
          {conversations.map(conversation => (
            <li key={conversation.title}>
              <button
                type="button"
                className={`w-full truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  conversation.active
                    ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-foreground/5"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                {conversation.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="m-3 rounded-2xl border bg-background/70 p-3 shadow-xs">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
            <TicketCheckIcon className="size-3.5" />
          </span>
          Event wallet ready
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Your passes and protected payments stay together.
        </p>
      </div>
    </aside>
  );
}

function ChatComposer() {
  return (
    <div className="relative z-10 border-t bg-background/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
      <form className="mx-auto max-w-3xl" aria-label="Ask Minti">
        <InputGroup className="min-h-14 rounded-2xl border-border bg-background shadow-[0_1px_2px_oklch(0_0_0/0.05),0_8px_30px_oklch(0_0_0/0.06)] has-[textarea]:rounded-2xl">
          <InputGroupTextarea
            aria-label="Message Minti"
            placeholder="Ask about events, people, places, or your budget..."
            className="max-h-32 min-h-12 py-3.5 text-sm"
            rows={1}
          />
          <InputGroupAddon
            align="block-end"
            className="justify-between px-2.5 pb-2"
          >
            <div className="flex items-center gap-0.5">
              <InputGroupButton
                type="button"
                size="icon-sm"
                aria-label="Attach a file"
              >
                <PaperclipIcon />
              </InputGroupButton>
              <InputGroupButton type="button" size="sm" className="px-2">
                <MapPinIcon />
                Miraflores
                <ChevronDownIcon className="size-3" />
              </InputGroupButton>
            </div>
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="default"
              aria-label="Send message"
              className="bg-foreground text-background hover:bg-foreground/85"
            >
              <ArrowUpIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Minti can make mistakes. Confirm event details before purchasing.
        </p>
      </form>
    </div>
  );
}

function ChatConversation() {
  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-5xl gap-7 px-4 py-8 sm:px-8 sm:py-10">
            <MessageScrollerItem>
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
                  you&apos;re free. I&apos;ll find the right events around you.
                </p>
              </div>
            </MessageScrollerItem>

            <MessageScrollerItem>
              <Message align="end" className="mx-auto max-w-3xl">
                <MessageContent>
                  <Bubble variant="secondary">
                    <BubbleContent className="rounded-[1.35rem] rounded-br-md bg-foreground px-4 py-3 text-background dark:bg-foreground dark:text-background">
                      I&apos;m free next Saturday from 2 to 10 PM. I want to
                      meet web3 people and learn something new about AI. I have
                      a budget of 30 USDC and I&apos;m near Miraflores. What
                      events do you recommend?
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageScrollerItem>

            <MessageScrollerItem>
              <Message className="mx-auto max-w-3xl">
                <MintiAvatar />
                <MessageContent>
                  <MessageHeader className="gap-2 px-0 text-foreground">
                    <span>Minti</span>
                    <span className="size-1 rounded-full bg-primary" />
                    <span className="font-normal text-muted-foreground">
                      Event concierge
                    </span>
                  </MessageHeader>
                  <Bubble variant="ghost">
                    <BubbleContent className="max-w-2xl text-[15px] leading-7">
                      I found three strong matches within 1.5 km. I prioritized
                      hands-on AI sessions and relaxed networking, and kept the
                      full plan under your 30 USDC budget.
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter className="mt-0.5 gap-1.5 px-0">
                    <CheckIcon className="size-3" />
                    Checked schedule, distance, availability, and price
                  </MessageFooter>
                </MessageContent>
              </Message>
            </MessageScrollerItem>

            <MessageScrollerItem>
              <div className="mx-auto max-w-5xl pl-0 sm:pl-10">
                <Marker variant="separator" className="mb-5 text-xs">
                  <MarkerIcon>
                    <SearchIcon />
                  </MarkerIcon>
                  <MarkerContent>3 best matches near Miraflores</MarkerContent>
                </Marker>
                <div className="grid gap-3 md:grid-cols-3">
                  {recommendations.map(event => (
                    <EventRecommendationCard key={event.title} event={event} />
                  ))}
                </div>
              </div>
            </MessageScrollerItem>

            <MessageScrollerItem scrollAnchor>
              <Message className="mx-auto max-w-3xl">
                <MintiAvatar />
                <MessageContent>
                  <Bubble variant="ghost">
                    <BubbleContent className="max-w-2xl text-[15px] leading-7">
                      My pick is{" "}
                      <strong>AI Agents for Onchain Communities</strong>.
                      It&apos;s the closest fit, leaves room in your budget, and
                      ends early enough to join the rooftop meetup afterward.
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="bottom-5 shadow-md" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export default function ChatPage() {
  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[38rem] overflow-hidden bg-background md:h-[calc(100dvh-4.5rem)]">
      <div className="grid size-full min-h-0 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <ConversationSidebar />
        <section
          aria-label="Event discovery conversation"
          className="flex min-h-0 min-w-0 flex-col"
        >
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground">
                <CompassIcon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">
                  AI events this weekend
                </h2>
                <p className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Live event inventory
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
                <ShieldCheckIcon className="size-3 text-primary-foreground" />
                Secure checkout
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Conversation details"
              >
                <CalendarClockIcon />
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <ChatConversation />
          </div>
          <ChatComposer />
        </section>
      </div>
    </div>
  );
}
