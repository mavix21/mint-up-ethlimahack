import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import type { Hex } from "../../../../../lib/pimlico-user-operation-api";
import { submitPimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";
import {
  readBoundedJson,
  submittedOperationSchema,
} from "../../../../../lib/pimlico-user-operation-route";

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
  const parsed = submittedOperationSchema.safeParse(body.value);
  if (!parsed.success)
    return Response.json(
      { message: "Operación firmada no válida." },
      { status: 400 },
    );
  try {
    return Response.json(
      await fetchAuthAction(submitPimlicoUserOperation, {
        preparationId: parsed.data.preparationId,
        signature: parsed.data.signature as Hex,
        operation: parsed.data.operation,
      }),
    );
  } catch {
    return Response.json(
      { message: "La operación firmada fue rechazada." },
      { status: 409 },
    );
  }
}
