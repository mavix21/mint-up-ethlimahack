import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { prepareEventPassRefund } from "../../../lib/event-pass-refund-api";
import { refundPreparationSchema } from "../../../lib/event-pass-refund-schema";
import { kernelAccountMatrix } from "../../../lib/kernel-account";
import { readBoundedJson } from "../../../lib/pimlico-user-operation-route";

const requestSchema = z
  .object({
    passId: z.string().min(1).max(100),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para recibir este reembolso." },
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
      { message: "Solicitud de reembolso no válida." },
      { status: 400 },
    );

  try {
    const preparation = await fetchAuthMutation(prepareEventPassRefund, {
      ...parsed.data,
      chainId: kernelAccountMatrix.chainId,
    });
    return Response.json(refundPreparationSchema.parse(preparation));
  } catch {
    return Response.json(
      {
        code: "refund_unavailable",
        message: "Este reembolso ya no está disponible.",
      },
      { status: 409 },
    );
  }
}
