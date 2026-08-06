import { type FunctionReference, anyApi } from "convex/server";

import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";

type RecoverySession = { encryptionSession: string };
type RecoveryArgs = { sessionToken: string };

const createWalletRecoverySession = anyApi.passesIdentityActions
  .createWalletRecoverySession as FunctionReference<
  "action",
  "public",
  RecoveryArgs,
  RecoverySession
>;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }
  try {
    return Response.json(
      await fetchAuthAction(createWalletRecoverySession, {
        sessionToken: authorization.slice("Bearer ".length),
      }),
    );
  } catch {
    return Response.json(
      { message: "Wallet recovery could not be authorized." },
      { status: 503 },
    );
  }
}
