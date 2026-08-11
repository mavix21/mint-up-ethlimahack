import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { prepareEventPassResale } from "../../../lib/event-pass-resale-api";
import {
  parseHumanUsdc,
  resalePreparationSchema,
} from "../../../lib/event-pass-resale-schema";
import { kernelAccountMatrix } from "../../../lib/kernel-account";
import { readBoundedJson } from "../../../lib/pimlico-user-operation-route";

const requestSchema = z
  .object({
    passId: z.string().min(1).max(100),
    price: z.string().min(1).max(86),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Inicia sesión para crear esta oferta." },
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
      { message: "Comprueba el precio en USDC." },
      { status: 400 },
    );

  let priceAmountSubunits: string;
  try {
    priceAmountSubunits = parseHumanUsdc(parsed.data.price);
  } catch {
    return Response.json(
      { message: "Ingresa un precio en USDC positivo con hasta 6 decimales." },
      { status: 400 },
    );
  }

  try {
    const prepared = await fetchAuthMutation(prepareEventPassResale, {
      passId: parsed.data.passId,
      priceAmountSubunits,
      chainId: kernelAccountMatrix.chainId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return Response.json(resalePreparationSchema.parse(prepared));
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error && error.message.includes("resale_unavailable")
            ? "El precio no debe superar tu pago protegido."
            : "No pudimos preparar esta publicación. Inténtalo de nuevo.",
      },
      { status: 409 },
    );
  }
}
