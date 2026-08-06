"use server";

import { fetchAuthAction } from "~~/lib/auth-server";
import { type FunctionReference, anyApi } from "convex/server";

const createWalletRecoverySession = anyApi.passesIdentityActions
  .createWalletRecoverySession as FunctionReference<
  "action",
  "public",
  { sessionToken: string },
  { encryptionSession: string }
>;

export async function createOpenfortEncryptionSession(sessionToken: string) {
  const result = await fetchAuthAction(createWalletRecoverySession, {
    sessionToken,
  });
  return result.encryptionSession;
}
