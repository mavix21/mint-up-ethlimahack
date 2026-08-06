import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { beginWalletPasskeyRegistration } from "../../../../../lib/wallet-passkey-api";

export async function POST() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Sign in to secure Event Passes." },
      { status: 401 },
    );
  }

  try {
    return Response.json(
      await fetchAuthMutation(beginWalletPasskeyRegistration, {}),
    );
  } catch {
    return Response.json(
      { message: "Could not start passkey registration." },
      { status: 409 },
    );
  }
}
