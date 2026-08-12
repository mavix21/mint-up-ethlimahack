import { getToken as getBetterAuthToken } from "@convex-dev/better-auth/utils";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { headers } from "next/headers.js";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

if (!convexUrl || !convexSiteUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CONVEX_SITE_URL are required for authentication.",
  );
}

const authConvexSiteUrl = convexSiteUrl;

async function getToken() {
  const requestHeaders = new Headers(await headers());
  requestHeaders.delete("content-length");
  requestHeaders.delete("transfer-encoding");
  requestHeaders.delete("x-forwarded-host");

  return (await getBetterAuthToken(authConvexSiteUrl, requestHeaders)).token;
}

export async function isAuthenticated() {
  return Boolean(await getToken());
}

export async function fetchAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"],
): Promise<FunctionReturnType<Query>> {
  return fetchQuery(query, args, { token: await getToken() });
}

export async function fetchAuthMutation<
  Mutation extends FunctionReference<"mutation">,
>(
  mutation: Mutation,
  args: Mutation["_args"],
): Promise<FunctionReturnType<Mutation>> {
  return fetchMutation(mutation, args, { token: await getToken() });
}

export async function fetchAuthAction<
  Action extends FunctionReference<"action">,
>(action: Action, args: Action["_args"]): Promise<FunctionReturnType<Action>> {
  return fetchAction(action, args, { token: await getToken() });
}

async function proxyAuthRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(
    requestUrl.pathname + requestUrl.search,
    authConvexSiteUrl,
  );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete("connection");
  requestHeaders.delete("content-length");
  requestHeaders.delete("transfer-encoding");
  requestHeaders.delete("x-forwarded-host");
  requestHeaders.set("accept-encoding", "application/json");
  requestHeaders.set("host", new URL(authConvexSiteUrl).host);
  requestHeaders.set("x-better-auth-forwarded-host", requestUrl.host);
  requestHeaders.set(
    "x-better-auth-forwarded-proto",
    requestUrl.protocol.replace(/:$/, ""),
  );

  return fetch(upstreamUrl, {
    method: request.method,
    headers: requestHeaders,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });
}

export const handler = {
  GET: proxyAuthRequest,
  POST: proxyAuthRequest,
};
