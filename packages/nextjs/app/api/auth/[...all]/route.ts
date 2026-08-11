import { handler } from "~~/lib/auth-server";
import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";

export const GET = handler.GET;

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (
    pathname.endsWith("/siwe/nonce") ||
    pathname.endsWith("/siwe/get-nonce") ||
    pathname.endsWith("/siwe/verify")
  ) {
    let body: { chainId?: unknown };
    try {
      body = await request.clone().json();
    } catch {
      return Response.json(
        { message: "Solicitud SIWE no válida" },
        { status: 400 },
      );
    }
    if (body.chainId !== eventPassEnvironment.chainId) {
      return Response.json(
        { message: "La wallet está conectada a una chain no compatible" },
        { status: 400 },
      );
    }
  }
  return handler.POST(request);
}
