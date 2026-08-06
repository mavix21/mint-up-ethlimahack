import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { preparePimlicoUserOperation } from "../../../../../lib/pimlico-user-operation-api";
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
  if (body.value !== null)
    return Response.json(
      { message: "Invalid preparation request." },
      { status: 400 },
    );
  try {
    return Response.json(
      await fetchAuthAction(preparePimlicoUserOperation, {}),
    );
  } catch {
    return Response.json(
      { message: "The sponsored action could not be prepared." },
      { status: 409 },
    );
  }
}
