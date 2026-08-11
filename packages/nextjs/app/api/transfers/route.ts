import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { prepareEventPassTransfer } from "../../../lib/event-pass-transfer-api";
import {
  recipientUnavailableMessage,
  transferPreparationSchema,
} from "../../../lib/event-pass-transfer-schema";
import { kernelAccountMatrix } from "../../../lib/kernel-account";
import { readBoundedJson } from "../../../lib/pimlico-user-operation-route";

const requestSchema = z
  .object({
    passId: z.string().min(1).max(100),
    recipientEmail: z
      .string()
      .max(320)
      .refine(value => z.email().safeParse(value.trim()).success),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para transferir este Event Pass." },
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
      { message: "Comprueba el correo del destinatario e inténtalo de nuevo." },
      { status: 400 },
    );

  try {
    const prepared = await fetchAuthMutation(prepareEventPassTransfer, {
      ...parsed.data,
      chainId: kernelAccountMatrix.chainId,
    });
    return Response.json(transferPreparationSchema.parse(prepared));
  } catch (error) {
    const recipientUnavailable =
      error instanceof Error &&
      error.message.includes("event_pass_recipient_unavailable");
    return Response.json(
      recipientUnavailable
        ? {
            code: "recipient_unavailable",
            message: recipientUnavailableMessage,
          }
        : {
            message:
              "No pudimos preparar la transferencia. Inténtalo de nuevo.",
          },
      { status: 409 },
    );
  }
}
