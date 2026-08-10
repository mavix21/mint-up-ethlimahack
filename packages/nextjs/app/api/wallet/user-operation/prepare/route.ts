import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { preparePimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";
import { prepareUserOperationResultSchema } from "../../../../../lib/pimlico-user-operation-schema";
import { readBoundedJson } from "../../../../../lib/pimlico-user-operation-route";

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to send this action." },
      { status: 401 },
    );
  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json({ message: "Request is too large." }, { status: 413 });
  if (
    typeof body.value !== "object" ||
    body.value === null ||
    !("purchaseId" in (body.value as Record<string, unknown>)) ||
    typeof (body.value as Record<string, unknown>).purchaseId !== "string"
  ) {
    return Response.json(
      { message: "Invalid preparation request." },
      { status: 400 },
    );
  }
  const purchaseId = (body.value as Record<string, unknown>)
    .purchaseId as string;
  try {
    const prepared = await fetchAuthAction(preparePimlicoUserOperation, {
      purchaseId,
    });
    return Response.json(prepareUserOperationResultSchema.parse(prepared));
  } catch {
    return Response.json(
      { message: "The sponsored action could not be prepared." },
      { status: 409 },
    );
  }
}
