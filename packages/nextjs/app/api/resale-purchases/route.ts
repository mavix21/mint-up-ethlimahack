import { z } from "zod";

import { fetchAuthMutation, isAuthenticated } from "~~/lib/auth-server";
import { prepareEventPassResalePurchase } from "../../../lib/event-pass-resale-api";
import { resalePurchasePreparationSchema } from "../../../lib/event-pass-resale-schema";
import { kernelAccountMatrix } from "../../../lib/kernel-account";
import { readBoundedJson } from "../../../lib/pimlico-user-operation-route";

const requestSchema = z
  .object({
    passId: z.string().min(1).max(100),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();

function resaleErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "string") return data;
  }
  if (error instanceof Error) {
    return error.message.match(/event_pass_resale_[a-z_]+/)?.[0];
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return Response.json(
      { message: "Sign in to buy this Event Pass." },
      { status: 401 },
    );

  const body = await readBoundedJson(request);
  if ("oversized" in body)
    return Response.json({ message: "Request is too large." }, { status: 413 });
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success)
    return Response.json(
      { message: "Invalid purchase request." },
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
    if (resaleErrorCode(error) === "event_pass_resale_unavailable") {
      return Response.json(
        {
          code: "listing_unavailable",
          message:
            "This Pass resale is unavailable to your account. Check that your email is verified and that you don't already have an Event Pass for this Event. If you still need help, contact Mint Up support.",
        },
        { status: 409 },
      );
    }
    console.error("Pass resale purchase preparation failed", { error });
    return Response.json(
      {
        code: "purchase_temporarily_unavailable",
        message: "We couldn't start this purchase. Try again.",
      },
      { status: 503 },
    );
  }
}
