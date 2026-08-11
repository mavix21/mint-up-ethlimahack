import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { prepareEventPassResaleWithdrawal } from "../../../../lib/event-pass-resale-api";
import { resaleWithdrawalPreparationSchema } from "../../../../lib/event-pass-resale-schema";
import { kernelAccountMatrix } from "../../../../lib/kernel-account";
import { readBoundedJson } from "../../../../lib/pimlico-user-operation-route";

const requestSchema = z
  .object({
    passId: z.string().min(1).max(100),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para retirar esta publicación." },
      { status: 401 },
    );
  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json(
      { message: "La solicitud es demasiado grande." },
      { status: 413 },
    );
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success)
    return Response.json(
      { message: "Solicitud de publicación no válida." },
      { status: 400 },
    );

  try {
    const prepared = await fetchAuthMutation(prepareEventPassResaleWithdrawal, {
      ...parsed.data,
      chainId: kernelAccountMatrix.chainId,
    });
    return Response.json(resaleWithdrawalPreparationSchema.parse(prepared));
  } catch {
    return Response.json(
      { message: "Esta publicación ya no se puede retirar." },
      { status: 409 },
    );
  }
}
