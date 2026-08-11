import { fetchAuthQuery, isAuthenticated } from "~~/lib/auth-server";
import { getWalletPasskeyAccount } from "../../../../lib/wallet-passkey-api";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Inicia sesión para ver tu cuenta." },
      { status: 401 },
    );
  }

  try {
    const account = await fetchAuthQuery(getWalletPasskeyAccount, {});
    return Response.json({ account });
  } catch {
    return Response.json(
      { message: "La cuenta no está disponible." },
      { status: 503 },
    );
  }
}
