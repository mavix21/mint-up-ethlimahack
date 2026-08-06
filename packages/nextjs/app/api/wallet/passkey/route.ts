import { fetchAuthQuery, isAuthenticated } from "~~/lib/auth-server";
import { getWalletPasskeyAccount } from "../../../../lib/wallet-passkey-api";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Sign in to view your account." },
      { status: 401 },
    );
  }

  try {
    const account = await fetchAuthQuery(getWalletPasskeyAccount, {});
    return Response.json({ account });
  } catch {
    return Response.json({ message: "Account unavailable." }, { status: 503 });
  }
}
