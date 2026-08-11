import { type FunctionReference, anyApi } from "convex/server";
import { z } from "zod";

import {
  fetchAuthMutation,
  fetchAuthQuery,
  isAuthenticated,
} from "~~/lib/auth-server";
import {
  type PurchaseStatus,
  purchaseStatusSchema,
} from "../../../../lib/event-pass-purchase-api";

type PurchaseIdArgs = { purchaseId: string };
type SubmitArgs = PurchaseIdArgs & {
  transactionHash?: string;
  userOperationHash?: string;
};

const submitPurchase = anyApi.eventPassPurchases.submit as FunctionReference<
  "mutation",
  "public",
  SubmitArgs,
  null
>;
const getPurchaseStatus = anyApi.eventPassPurchases
  .getStatus as FunctionReference<
  "query",
  "public",
  PurchaseIdArgs,
  PurchaseStatus
>;
const transactionHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const submission = z.object({
  transactionHash,
  userOperationHash: transactionHash,
});

type Context = { params: Promise<{ purchaseId: string }> };

async function purchaseIdFrom(context: Context) {
  const { purchaseId } = await context.params;
  return z.string().min(1).safeParse(purchaseId);
}

export async function GET(_request: Request, context: Context) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Autenticación requerida." },
      { status: 401 },
    );
  }
  const parsed = await purchaseIdFrom(context);
  if (!parsed.success) {
    return Response.json({ message: "Compra no válida." }, { status: 400 });
  }
  try {
    const status = await fetchAuthQuery(getPurchaseStatus, {
      purchaseId: parsed.data,
    });
    return Response.json(purchaseStatusSchema.parse(status));
  } catch {
    return Response.json({ message: "Compra no encontrada." }, { status: 404 });
  }
}

export async function POST(request: Request, context: Context) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Autenticación requerida." },
      { status: 401 },
    );
  }
  const purchaseId = await purchaseIdFrom(context);
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    value = null;
  }
  const body = submission.safeParse(value);
  if (!purchaseId.success || !body.success) {
    return Response.json(
      { message: "Transacción no válida." },
      { status: 400 },
    );
  }
  try {
    await fetchAuthMutation(submitPurchase, {
      purchaseId: purchaseId.data,
      ...body.data,
    });
    return Response.json({ accepted: true });
  } catch {
    return Response.json(
      { message: "No se pudo sincronizar la transacción." },
      { status: 409 },
    );
  }
}
