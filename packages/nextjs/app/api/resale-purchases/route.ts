import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import {
  eventPassResaleErrorCode,
  prepareEventPassResalePurchase,
} from "../../../lib/event-pass-resale-api";
import { resalePurchasePreparationSchema } from "../../../lib/event-pass-resale-schema";
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
      { message: "Inicia sesión para comprar este Event Pass." },
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
      { message: "Solicitud de compra no válida." },
      { status: 400 },
    );

  try {
    const preparation = await fetchAuthMutation(
      prepareEventPassResalePurchase,
      {
        ...parsed.data,
        chainId: kernelAccountMatrix.chainId,
      },
    );
    return Response.json(resalePurchasePreparationSchema.parse(preparation));
  } catch (error) {
    if (eventPassResaleErrorCode(error) === "event_pass_resale_unavailable") {
      return Response.json(
        {
          code: "listing_unavailable",
          message:
            "Esta reventa de Event Pass no está disponible para tu cuenta. Comprueba que tu correo electrónico esté verificado y que aún no tengas un Event Pass para este evento. Si todavía necesitas ayuda, contacta al soporte de Mint Up.",
        },
        { status: 409 },
      );
    }
    console.error("Pass resale purchase preparation failed", { error });
    return Response.json(
      {
        code: "purchase_temporarily_unavailable",
        message: "No pudimos iniciar esta compra. Inténtalo de nuevo.",
      },
      { status: 503 },
    );
  }
}
