import "server-only";

import { type FunctionReference, anyApi } from "convex/server";
import { z } from "zod";

import { fetchAuthQuery } from "~~/lib/auth-server";

// ─── Pass schema ────────────────────────────────────────────────────────────
// Mirrors convex/eventPassOwnerships.ts `pass` validator. `event` is optional
// to stay compatible with deployments that haven't enriched the query yet –
// when present it drives the grouping.
const passSchema = z.object({
  passId: z.string(),
  owner: z.object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    userId: z.string().optional(),
  }),
  validity: z.object({
    status: z.enum(["valid", "invalid"]),
  }),
  transfer: z.object({
    status: z.enum(["transferable", "transferred"]),
    transactionHash: z.string().optional(),
  }),
  cancellation: z.object({
    status: z.enum(["active", "cancelled"]),
  }),
  refund: z.object({
    status: z.enum(["unavailable", "available", "received"]),
  }),
  checkIn: z.object({ status: z.enum(["notRecorded", "recorded"]) }),
  history: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.enum(["purchased", "listed", "resold"]),
          occurredAt: z.number(),
          actor: z.object({
            name: z.string(),
            isCurrentUser: z.boolean(),
          }),
          amountSubunits: z.string(),
        }),
        z.object({
          kind: z.literal("transferred"),
          occurredAt: z.number(),
          actor: z.object({
            name: z.string(),
            isCurrentUser: z.boolean(),
          }),
          recipient: z.object({
            name: z.string(),
            isCurrentUser: z.boolean(),
          }),
        }),
      ]),
    )
    .default([]),
  // Enriched event metadata – optional for backwards compatibility.
  event: z
    .object({
      eventId: z.string().min(1),
      name: z.string().min(1),
      imageUrl: z.string().optional(),
      startTime: z.number().optional(),
      endTime: z.number().optional(),
      timezone: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
  eventId: z.string().min(1).optional(),
});

export type EventPassOwnership = z.infer<typeof passSchema>;

const listMineResponseSchema = z.object({
  passes: z.array(passSchema),
});

type ListMineArgs = Record<string, never>;
type ListMineResponse = { passes: EventPassOwnership[] };

const listMine = anyApi.eventPassOwnerships.listMine as FunctionReference<
  "query",
  "public",
  ListMineArgs,
  ListMineResponse
>;

export async function fetchMyPasses(): Promise<EventPassOwnership[]> {
  try {
    const raw = await fetchAuthQuery(listMine, {});
    const parsed = listMineResponseSchema.safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data.passes;
  } catch {
    return [];
  }
}

// ─── Grouping helper (pure, testable) ──────────────────────────────────────
export type PassGroup = {
  key: string;
  eventId?: string;
  name: string;
  imageUrl?: string;
  startTime?: number;
  timezone?: string;
  location?: string;
  passes: EventPassOwnership[];
};

export function groupPassesByEvent(passes: EventPassOwnership[]): PassGroup[] {
  if (passes.length === 0) return [];

  const map = new Map<string, PassGroup>();

  for (const pass of passes) {
    // Prefer enriched event metadata; fall back to bare eventId; last resort single bucket.
    const eventId = pass.event?.eventId ?? pass.eventId;
    const key = eventId ?? "__ungrouped__";
    const existing = map.get(key);
    if (existing) {
      existing.passes.push(pass);
      continue;
    }
    map.set(key, {
      key,
      eventId,
      name: pass.event?.name ?? (eventId ? eventId : "Event Passes"),
      imageUrl: pass.event?.imageUrl,
      startTime: pass.event?.startTime,
      timezone: pass.event?.timezone,
      location: pass.event?.location,
      passes: [pass],
    });
  }

  // Stable order: grouped events first (alpha), ungrouped last.
  const groups = [...map.values()];
  groups.sort((a, b) => {
    if (a.key === "__ungrouped__") return 1;
    if (b.key === "__ungrouped__") return -1;
    return a.name.localeCompare(b.name);
  });
  // Within each group sort by passId numeric order
  for (const g of groups) {
    g.passes.sort((x, y) => {
      const nx = Number(x.passId);
      const ny = Number(y.passId);
      if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
      return x.passId.localeCompare(y.passId);
    });
  }
  return groups;
}
