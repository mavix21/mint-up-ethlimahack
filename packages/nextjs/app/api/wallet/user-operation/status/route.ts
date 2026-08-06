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
      { message: "Sign in to view this action." },
      { status: 401 },
    );
  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json({ message: "Request is too large." }, { status: 413 });
  const parsed = operationStatusSchema.safeParse(body.value);
  if (!parsed.success)
    return Response.json(
      { message: "Invalid operation reference." },
      { status: 400 },
    );
  try {
    return Response.json(
      await fetchAuthAction(getPimlicoUserOperationStatus, {
        userOperationHash: parsed.data.userOperationHash as Hex,
      }),
    );
  } catch {
    return Response.json(
      { message: "Operation status is unavailable." },
      { status: 503 },
    );
  }
}
