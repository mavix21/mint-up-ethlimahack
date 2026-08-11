import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassResale } from "../../../../../lib/event-pass-resale-api";

type Context = { params: Promise<{ resaleId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to finish this listing." },
      { status: 401 },
    );
  const { resaleId } = await params;
  if (!resaleId || resaleId.length > 200)
    return Response.json(
      { message: "Invalid listing reference." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassResale, { resaleId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      { message: "We couldn't verify the listing yet. Try again." },
      { status: 409 },
    );
  }
}
