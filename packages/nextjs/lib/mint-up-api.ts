import { anyApi, type FunctionReference } from "convex/server";

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

interface MintUpPublicApi {
  eventDiscovery: {
    discover: DiscoverFirstPartyEvents;
  };
  eventPassOffers: {
    list: ListEventPassOffers;
    getByEventId: GetEventPassOffer;
  };
}

// This checked-in function reference is the narrow cross-repository contract.
export const mintUpApi = anyApi as unknown as MintUpPublicApi;
