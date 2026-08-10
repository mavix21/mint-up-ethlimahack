import { type FunctionReference, anyApi } from "convex/server";

import type { TransferPreparation } from "./event-pass-transfer-schema";

export const prepareEventPassTransfer = anyApi.eventPassTransfers
  .prepare as FunctionReference<
  "mutation",
  "public",
  {
    passId: string;
    recipientEmail: string;
    chainId: number;
    idempotencyKey: string;
  },
  TransferPreparation
>;

export const reconcileEventPassTransfer = anyApi.eventPassTransfers
  .reconcile as FunctionReference<
  "action",
  "public",
  { transferId: string },
  null
>;
