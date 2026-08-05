import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthenticated } from "~~/lib/auth-server";

const protectedPrefixes = ["/account", "/wallet", "/my-passes", "/check-in"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    !protectedPrefixes.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }

  if (await isAuthenticated()) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/wallet/:path*",
    "/my-passes/:path*",
    "/check-in/:path*",
  ],
};
