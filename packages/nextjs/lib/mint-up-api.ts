import {
  anyApi,
  type FunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { StreamArgs, SyncStreamsReturnValue } from "@convex-dev/agent";
import type { UIMessage } from "@convex-dev/agent/react";
import type { UIDataTypes } from "ai";

type EventLocation =
  | { kind: "custom"; label: string }
  | {
      kind: "resolved";
      venueName?: string;
      address: string;
      countryCode: string;
    };

type EventPlace =
  | {
      kind: "online";
      audience: { kind: "global" } | { kind: "market"; marketAreaId: string };
    }
  | { kind: "physical"; location: EventLocation }
  | { kind: "hybrid"; location: EventLocation };

export interface MintUpEvent {
  _id: string;
  name: string;
  startTime: number;
  endTime: number;
  timezone: string;
  platform: "mintup";
  source: { kind: "firstParty" };
  place: EventPlace;
  image?: { kind: "url"; url: string };
  organizer?: {
    name: string;
    url?: string;
    image?: string | { kind: "url"; url: string };
  };
}

type DiscoverFirstPartyEvents = FunctionReference<
  "query",
  "public",
  {
    filters: { platforms: ["mintup"] };
    paginationOpts: { numItems: number; cursor: null };
  },
  {
    page: MintUpEvent[];
    isDone: boolean;
    continueCursor: string;
  }
>;

type ListEventPassOffers = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  unknown
>;

type GetEventPassOffer = FunctionReference<
  "query",
  "public",
  { eventId: string },
  unknown
>;

export type SearchEventsInput = {
  startTimeAfter?: number;
  startTimeBefore?: number;
  formats?: ("online" | "in-person" | "hybrid")[];
  marketAreaSlug?: string;
  districtSlug?: string;
  categorySlugs?: string[];
  priceKinds?: ("free" | "paid" | "unknown")[];
  maxBudgetUsd?: number;
  near?: { lat: number; lng: number; radiusKm: number };
  locale?: "en" | "es";
  limit?: number;
};

export type MintiEvent = {
  eventId: string;
  title: string;
  startTime: number;
  endTime: number;
  timezone: string;
  format: "online" | "in-person" | "hybrid";
  platform: "luma" | "eventbrite" | "meetup" | "other" | "mintup";
  organizerName?: string;
  location?: {
    label?: string;
    venueName?: string;
    address?: string;
    district?: string;
  };
  distanceKm?: number;
  price: {
    kinds: ("free" | "paid" | "unknown")[];
    minUsd?: number;
    maxUsd?: number;
  };
  availability: "available" | "waitlist" | "closed" | "unknown";
  categories: { slug: string; name: string }[];
  imageUrl?: string;
  url: string;
};

export type SearchEventsResult = {
  unresolvedFilters: string[];
  events: MintiEvent[];
};

type MintiTools = {
  searchEvents: {
    input: SearchEventsInput;
    output: SearchEventsResult;
  };
};

export type MintiMessage = UIMessage<unknown, UIDataTypes, MintiTools>;

type CreateMintiThread = FunctionReference<
  "mutation",
  "public",
  Record<string, never>,
  string
>;

export type MintiThread = {
  threadId: string;
  createdAt: number;
};

type ListMintiThreads = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  MintiThread[]
>;

type ListMintiMessages = FunctionReference<
  "query",
  "public",
  {
    threadId: string;
    paginationOpts: PaginationOptions;
    streamArgs?: StreamArgs;
  },
  PaginationResult<MintiMessage> & { streams: SyncStreamsReturnValue }
>;

type SendMintiMessage = FunctionReference<
  "action",
  "public",
  { threadId: string; prompt: string },
  null
>;

interface MintUpPublicApi {
  eventDiscovery: {
    discover: DiscoverFirstPartyEvents;
  };
  eventPassOffers: {
    list: ListEventPassOffers;
    getByEventId: GetEventPassOffer;
  };
  minti: {
    createThread: CreateMintiThread;
    listThreads: ListMintiThreads;
    listMessages: ListMintiMessages;
    sendMessage: SendMintiMessage;
  };
}

// This checked-in function reference is the narrow cross-repository contract.
export const mintUpApi = anyApi as unknown as MintUpPublicApi;
