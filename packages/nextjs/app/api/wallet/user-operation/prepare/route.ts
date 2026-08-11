import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { preparePimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";
import { prepareUserOperationResultSchema } from "../../../../../lib/pimlico-user-operation-schema";
import { readBoundedJson } from "../../../../../lib/pimlico-user-operation-route";

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para enviar esta acción." },
      { status: 401 },
    );
  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json(
      { message: "La solicitud es demasiado grande." },
      { status: 413 },
    );
  if (typeof body.value !== "object" || body.value === null) {
    return Response.json(
      { message: "Solicitud de preparación no válida." },
      { status: 400 },
    );
  }
  const value = body.value as Record<string, unknown>;
  const purchaseId = value.purchaseId;
  const transferId = value.transferId;
  const resaleId = value.resaleId;
  const resalePurchaseId = value.resalePurchaseId;
  const refundId = value.refundId;
  const hasPurchaseId = typeof purchaseId === "string";
  const hasTransferId = typeof transferId === "string";
  const hasResaleId = typeof resaleId === "string";
  const hasResalePurchaseId = typeof resalePurchaseId === "string";
  const hasRefundId = typeof refundId === "string";
  if (
    Number(hasPurchaseId) +
      Number(hasTransferId) +
      Number(hasResaleId) +
      Number(hasResalePurchaseId) +
      Number(hasRefundId) !==
    1
  ) {
    return Response.json(
      { message: "Solicitud de preparación no válida." },
      { status: 400 },
    );
  }
  const intent = hasPurchaseId
    ? { purchaseId }
    : hasTransferId
      ? { transferId: transferId as string }
      : hasResaleId
        ? { resaleId: resaleId as string }
        : hasResalePurchaseId
          ? { resalePurchaseId: resalePurchaseId as string }
          : { refundId: refundId as string };
  try {
    const prepared = await fetchAuthAction(preparePimlicoUserOperation, intent);
    return Response.json(prepareUserOperationResultSchema.parse(prepared));
  } catch {
    return Response.json(
      { message: "No se pudo preparar la acción patrocinada." },
      { status: 409 },
    );
  }
}
