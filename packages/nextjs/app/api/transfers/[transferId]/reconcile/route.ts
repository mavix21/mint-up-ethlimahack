import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { reconcileEventPassTransfer } from "../../../../../lib/event-pass-transfer-api";

type Context = { params: Promise<{ transferId: string }> };

export async function POST(_request: Request, { params }: Context) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to finish this transfer." },
      { status: 401 },
    );

  const { transferId } = await params;
  if (!transferId || transferId.length > 200)
    return Response.json(
      { message: "Invalid transfer reference." },
      { status: 400 },
    );

  try {
    await fetchAuthAction(reconcileEventPassTransfer, { transferId });
    return Response.json({ status: "verified" });
  } catch {
    return Response.json(
      { message: "We couldn't verify the transfer yet. Try again." },
      { status: 409 },
    );
  }
}
