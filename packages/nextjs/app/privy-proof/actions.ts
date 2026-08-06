"use server";

import { fetchAuthAction } from "~~/lib/auth-server";
import { type FunctionReference, anyApi } from "convex/server";

type SignProofArgs = {
  walletId: string;
  message: string;
  authorizationSignature: string;
  requestExpiry: number;
};

type ProofWallet = {
  walletId: string;
  address: string;
};

const provisionPrivyProofWallet = anyApi.passesIdentityActions
  .provisionPrivyProofWallet as FunctionReference<
  "action",
  "public",
  Record<string, never>,
  ProofWallet
>;

const signPrivyProofMessage = anyApi.passesIdentityActions
  .signPrivyProofMessage as FunctionReference<
  "action",
  "public",
  SignProofArgs,
  string
>;

export async function submitPrivyProofSignature(args: SignProofArgs) {
  return fetchAuthAction(signPrivyProofMessage, args);
}

export async function provisionPrivyProofWalletForBrowserUser() {
  return fetchAuthAction(provisionPrivyProofWallet, {});
}
