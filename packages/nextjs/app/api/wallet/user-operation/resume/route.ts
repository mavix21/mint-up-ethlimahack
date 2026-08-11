import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { resumePimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";

export async function POST() {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para ver esta acción." },
      { status: 401 },
    );
  try {
    return Response.json(await fetchAuthAction(resumePimlicoUserOperation, {}));
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
