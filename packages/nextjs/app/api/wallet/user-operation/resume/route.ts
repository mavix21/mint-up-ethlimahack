import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { resumePimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";

export async function POST() {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to view this action." },
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
          ? "Operation status is temporarily unavailable."
          : "Operation inclusion could not be verified.",
      },
      { status: retryable ? 503 : 409 },
    );
  }
}
