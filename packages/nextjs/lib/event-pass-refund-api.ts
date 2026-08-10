import { type FunctionReference, anyApi } from "convex/server";

import type { RefundPreparation } from "./event-pass-refund-schema";

export const prepareEventPassRefund = anyApi.eventPassRefunds
  .prepare as FunctionReference<
  "mutation",
  "public",
  {
    passId: string;
    chainId: number;
    idempotencyKey: string;
  },
  RefundPreparation
>;

export const reconcileEventPassRefund = anyApi.eventPassRefunds
  .reconcile as FunctionReference<
  "action",
  "public",
  { refundId: string },
  null
>;
