import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { beginWalletPasskeyRegistration } from "../../../../../lib/wallet-passkey-api";

export async function POST() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Inicia sesión para proteger tus Event Passes." },
      { status: 401 },
    );
  }

  try {
    return Response.json(
      await fetchAuthMutation(beginWalletPasskeyRegistration, {}),
    );
  } catch {
    return Response.json(
      { message: "No se pudo iniciar el registro de la passkey." },
      { status: 409 },
    );
  }
}
