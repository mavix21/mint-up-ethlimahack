import {
  fetchAuthAction,
  fetchAuthMutation,
  isAuthenticated,
} from "~~/lib/auth-server";
import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";
import { type FunctionReference, anyApi } from "convex/server";

type ChallengeResult = { nonce: string; expiresAt: number };
type WalletLinkArgs = { address: string; chainId: number };
type CompleteWalletLinkArgs = WalletLinkArgs & {
  message: string;
  signature: string;
};

const beginWalletLink = anyApi.passesIdentity
  .beginWalletLink as FunctionReference<
  "mutation",
  "public",
  WalletLinkArgs,
  ChallengeResult
>;
const completeWalletLink = anyApi.passesIdentityActions
  .completeWalletLink as FunctionReference<
  "action",
  "public",
  CompleteWalletLinkArgs,
  string
>;

function walletArgs(value: unknown): WalletLinkArgs | null {
  if (!value || typeof value !== "object") return null;
  const { address, chainId } = value as Record<string, unknown>;
  if (
    typeof address !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(address) ||
    typeof chainId !== "number" ||
    !Number.isSafeInteger(chainId) ||
    chainId <= 0
  ) {
    return null;
  }
  return { address, chainId };
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: "Autenticación requerida" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Solicitud no válida" }, { status: 400 });
  }
  const args = walletArgs(body);
  if (!args || args.chainId !== eventPassEnvironment.chainId) {
    return Response.json({ message: "Wallet no válida" }, { status: 400 });
  }

  if (body.action === "challenge") {
    try {
      return Response.json(await fetchAuthMutation(beginWalletLink, args));
    } catch {
      return Response.json(
        {
          message:
            "No se pudo solicitar un desafío para la wallet. Inténtalo de nuevo.",
        },
        { status: 503 },
      );
    }
  }
  if (
    body.action === "verify" &&
    typeof body.message === "string" &&
    body.message.length > 0 &&
    typeof body.signature === "string" &&
    /^0x[0-9a-fA-F]+$/.test(body.signature)
  ) {
    try {
      await fetchAuthAction(completeWalletLink, {
        ...args,
        message: body.message,
        signature: body.signature,
      });
      return Response.json({ success: true });
    } catch {
      return Response.json(
        {
          message:
            "La verificación de la wallet falló. Solicita un nuevo desafío.",
        },
        { status: 400 },
      );
    }
  }

  return Response.json({ message: "Solicitud no válida" }, { status: 400 });
}
