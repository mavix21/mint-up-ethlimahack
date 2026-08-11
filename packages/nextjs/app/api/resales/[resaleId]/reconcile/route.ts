import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassResale } from "../../../../../lib/event-pass-resale-api";

type Context = { params: Promise<{ resaleId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para finalizar esta publicación." },
      { status: 401 },
    );
  const { resaleId } = await params;
  if (!resaleId || resaleId.length > 200)
    return Response.json(
      { message: "Referencia de publicación no válida." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassResale, { resaleId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      {
        message: "Aún no pudimos verificar la publicación. Inténtalo de nuevo.",
      },
      { status: 409 },
    );
  }
}
