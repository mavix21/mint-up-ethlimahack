import { type FunctionReference, anyApi } from "convex/server";

import type { WalletPasskeyAccount } from "./kernel-account";

export const beginWalletPasskeyRegistration = anyApi.passkeyAccounts
  .begin as FunctionReference<
  "mutation",
  "public",
  Record<string, never>,
  Record<string, unknown>
>;

export const completeWalletPasskeyRegistration = anyApi.passkeyAccountActions
  .complete as FunctionReference<
  "action",
  "public",
  { response: Record<string, unknown>; browserAddress: string },
  { address: string }
>;

export const getWalletPasskeyAccount = anyApi.passkeyAccounts
  .get as FunctionReference<
  "query",
  "public",
  Record<string, never>,
  WalletPasskeyAccount | null
>;
