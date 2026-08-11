import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import type { Hex } from "../../../../../lib/pimlico-user-operation-api";
import { getPimlicoUserOperationStatus } from "../../../../../lib/pimlico-user-operation-api";
import {
  operationStatusSchema,
  readBoundedJson,
} from "../../../../../lib/pimlico-user-operation-route";

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para ver esta acción." },
      { status: 401 },
    );
  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json(
      { message: "La solicitud es demasiado grande." },
      { status: 413 },
    );
  const parsed = operationStatusSchema.safeParse(body.value);
  if (!parsed.success)
    return Response.json(
      { message: "Referencia de operación no válida." },
      { status: 400 },
    );
  try {
    return Response.json(
      await fetchAuthAction(getPimlicoUserOperationStatus, {
        userOperationHash: parsed.data.userOperationHash as Hex,
      }),
    );
  } catch (error) {
    const retryable =
      error instanceof Error &&
      error.message.includes("Sponsorship provider temporarily unavailable");
    return Response.json(
      {
        message: retryable
          ? "El estado de la operación no está disponible temporalmente."
          : "No se pudo verificar la inclusión de la operación.",
      },
      { status: retryable ? 503 : 409 },
    );
  }
}
