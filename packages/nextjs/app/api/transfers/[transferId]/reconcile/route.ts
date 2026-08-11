import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassTransfer } from "../../../../../lib/event-pass-transfer-api";

type Context = { params: Promise<{ transferId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para finalizar esta transferencia." },
      { status: 401 },
    );

  const { transferId } = await params;
  if (!transferId || transferId.length > 200)
    return Response.json(
      { message: "Referencia de transferencia no válida." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassTransfer, { transferId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      {
        message:
          "Aún no pudimos verificar la transferencia. Inténtalo de nuevo.",
      },
      { status: 409 },
    );
  }
}
