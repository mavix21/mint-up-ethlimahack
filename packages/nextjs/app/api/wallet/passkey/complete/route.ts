import { z } from "zod";

import { fetchAuthAction, isAuthenticated } from "~~/lib/auth-server";
import { completeWalletPasskeyRegistration } from "../../../../../lib/wallet-passkey-api";

const registration = z.object({
  accountAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  credential: z
    .object({
      id: z.string().min(1),
      rawId: z.string().min(1),
      type: z.literal("public-key"),
      clientExtensionResults: z.record(z.string(), z.unknown()),
      response: z
        .object({
          attestationObject: z.string().min(1),
          clientDataJSON: z.string().min(1),
        })
        .passthrough(),
    })
    .passthrough(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Sign in to secure Event Passes." },
      { status: 401 },
    );
  }

  const parsed = registration.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid passkey response." },
      { status: 400 },
    );
  }

  try {
    return Response.json(
      await fetchAuthAction(completeWalletPasskeyRegistration, {
        response: parsed.data.credential,
        browserAddress: parsed.data.accountAddress,
      }),
    );
  } catch {
    return Response.json(
      { message: "Passkey registration could not be verified." },
      { status: 409 },
    );
  }
}
