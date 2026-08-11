import { type FunctionReference, anyApi } from "convex/server";

import type {
  PrivateResaleOffer,
  ResalePreparation,
  ResalePurchasePreparation,
  ResaleWithdrawalPreparation,
} from "./event-pass-resale-schema";

export type ResalePurchaseAccessStatus =
  | "eligible"
  | "account_unprotected"
  | "email_unverified"
  | "blocked"
  | "already_has_event_pass"
  | "unavailable";

export function eventPassResaleErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "string") return data;
  }
  if (error instanceof Error) {
    return error.message.match(/event_pass_resale_[a-z_]+/)?.[0];
  }
}

export const getEventPassResale = anyApi.eventPassResales
  .getByPassId as FunctionReference<
  "query",
  "public",
  { passId: string },
  PrivateResaleOffer | null
>;

export const prepareEventPassResale = anyApi.eventPassResales
  .prepare as FunctionReference<
  "mutation",
  "public",
  {
    passId: string;
    priceAmountSubunits: string;
    chainId: number;
    idempotencyKey: string;
  },
  ResalePreparation
>;

export const listEventPassMarketplace = anyApi.eventPassResales
  .listMarketplace as FunctionReference<
  "query",
  "public",
  Record<string, never>,
  unknown
>;

export const reconcileEventPassMarketplace = anyApi.eventPassResales
  .reconcileMarketplace as FunctionReference<
  "action",
  "public",
  Record<string, never>,
  null
>;

export const prepareEventPassResaleWithdrawal = anyApi.eventPassResales
  .prepareWithdrawal as FunctionReference<
  "mutation",
  "public",
  {
    passId: string;
    chainId: number;
    idempotencyKey: string;
  },
  ResaleWithdrawalPreparation
>;

export const reconcileEventPassResale = anyApi.eventPassResales
  .reconcile as FunctionReference<
  "action",
  "public",
  { resaleId: string },
  null
>;

export const prepareEventPassResalePurchase = anyApi.eventPassResalePurchases
  .prepare as FunctionReference<
  "mutation",
  "public",
  {
    passId: string;
    chainId: number;
    idempotencyKey: string;
  },
  ResalePurchasePreparation
>;

export const getEventPassResalePurchaseAccess = anyApi.eventPassResalePurchases
  .getPurchaseAccess as FunctionReference<
  "query",
  "public",
  { passId: string },
  { status: ResalePurchaseAccessStatus }
>;

export const reconcileEventPassResalePurchase = anyApi.eventPassResalePurchases
  .reconcile as FunctionReference<
  "action",
  "public",
  { resalePurchaseId: string },
  null
>;
