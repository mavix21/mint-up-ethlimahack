import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassRefund } from "../../../../../lib/event-pass-refund-api";

type Context = { params: Promise<{ refundId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to finish this refund." },
      { status: 401 },
    );
  const { refundId } = await params;
  if (!refundId || refundId.length > 200)
    return Response.json(
      { message: "Invalid refund reference." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassRefund, { refundId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      { message: "We couldn't verify the refund yet. Try again." },
      { status: 409 },
    );
  }
}
