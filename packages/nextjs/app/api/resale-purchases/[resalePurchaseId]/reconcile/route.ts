import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import {
  eventPassResaleErrorCode,
  reconcileEventPassResalePurchase,
} from "../../../../../lib/event-pass-resale-api";

type Context = { params: Promise<{ resalePurchaseId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para finalizar esta compra." },
      { status: 401 },
    );
  const { resalePurchaseId } = await params;
  if (!resalePurchaseId || resalePurchaseId.length > 200)
    return Response.json(
      { message: "Referencia de compra no válida." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassResalePurchase, {
      resalePurchaseId,
    });
    return Response.json({ status: "verified" });
  } catch (error) {
    if (eventPassResaleErrorCode(error) === "event_pass_resale_unavailable") {
      return Response.json(
        {
          code: "listing_unavailable",
          message:
            "Esta reventa de Event Pass ya no está disponible. Es posible que otro comprador la haya completado primero. No se te cobrará.",
        },
        { status: 409 },
      );
    }
    return Response.json(
      { message: "Aún no pudimos verificar la compra. Inténtalo de nuevo." },
      { status: 409 },
    );
  }
}
