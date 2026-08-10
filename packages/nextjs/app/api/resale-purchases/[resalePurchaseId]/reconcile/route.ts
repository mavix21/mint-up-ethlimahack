import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassResalePurchase } from "../../../../../lib/event-pass-resale-api";

type Context = { params: Promise<{ resalePurchaseId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to finish this purchase." },
      { status: 401 },
    );
  const { resalePurchaseId } = await params;
  if (!resalePurchaseId || resalePurchaseId.length > 200)
    return Response.json(
      { message: "Invalid purchase reference." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassResalePurchase, {
      resalePurchaseId,
    });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      { message: "We couldn't verify the purchase yet. Try again." },
      { status: 409 },
    );
  }
}
