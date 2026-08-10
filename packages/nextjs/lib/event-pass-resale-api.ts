import { type FunctionReference, anyApi } from "convex/server";

import type {
  PrivateResaleOffer,
  ResalePreparation,
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
    buyerEmail: string;
    priceAmountSubunits: string;
    chainId: number;
    idempotencyKey: string;
  },
  ResalePreparation
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
