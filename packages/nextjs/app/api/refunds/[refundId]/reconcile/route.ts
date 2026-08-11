import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassRefund } from "../../../../../lib/event-pass-refund-api";

type Context = { params: Promise<{ refundId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para finalizar este reembolso." },
      { status: 401 },
    );
  const { refundId } = await params;
  if (!refundId || refundId.length > 200)
    return Response.json(
      { message: "Referencia de reembolso no válida." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassRefund, { refundId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      { message: "Aún no pudimos verificar el reembolso. Inténtalo de nuevo." },
      { status: 409 },
    );
  }
}
