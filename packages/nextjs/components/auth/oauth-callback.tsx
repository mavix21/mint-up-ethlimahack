"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getLocalRedirect } from "~~/lib/auth-redirect";

export function OAuthCallback() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const verificationToken = useRef<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("ott");
    if (!token) {
      setError("The sign-in token is missing or invalid.");
      return;
    }
    if (verificationToken.current === token) return;
    verificationToken.current = token;

    void fetch("/api/auth/cross-domain/one-time-token/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(response => {
        if (!response.ok)
          throw new Error(
            "Unable to complete sign-in. Request a new sign-in link.",
          );
        window.location.replace(
          getLocalRedirect(searchParams.get("callbackUrl")),
        );
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to complete sign-in.",
        );
      });
  }, [searchParams]);

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
      <h1 className="font-heading text-2xl font-bold">Signing you in</h1>
      <p
        className={`mt-3 text-sm ${error ? "text-error" : "text-base-content/70"}`}
      >
        {error ?? "Verifying your secure Mint Up handoff..."}
      </p>
    </div>
  );
}
