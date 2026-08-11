import { type FunctionReference, anyApi } from "convex/server";

import type {
  PrivateResaleOffer,
  PrivateResalePurchaseOffer,
  ResalePreparation,
  ResalePurchasePreparation,
  ResaleWithdrawalPreparation,
} from "./event-pass-resale-schema";

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

export const listPrivateResalePurchases = anyApi.eventPassResales
  .listForBuyer as FunctionReference<
  "query",
  "public",
  Record<string, never>,
  PrivateResalePurchaseOffer[]
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

export const reconcileEventPassResalePurchase = anyApi.eventPassResalePurchases
  .reconcile as FunctionReference<
  "action",
  "public",
  { resalePurchaseId: string },
  null
>;
